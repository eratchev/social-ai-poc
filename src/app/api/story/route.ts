// src/app/api/story/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getStoryProvider,
  resolveDefaultProvider,
  type ProviderKind,
} from "@/lib/ai/providers";
import { captionPhotosOpenAI } from "@/lib/ai/captions-openai";
import { getModelForQuality } from "@/lib/ai/config";

export const runtime = "nodejs";

/** Request body schema */
const Body = z.object({
  roomCode: z.string().min(1),
  ownerHandle: z.string().min(1).default("devuser"),

  // creative knobs
  audience: z.string().optional(), // e.g. "kids-10-12" or "adults"
  style: z.string().optional(),    // e.g. "funny", "witty"
  tone: z.string().optional(),     // e.g. "wholesome", "snarky"

  // comic preset
  comicAudience: z.enum(["kids", "adults"]).default("kids"),

  // NEW: quality preset
  quality: z.enum(["fast", "balanced", "premium"]).default("balanced"),

  // provider choice (optional; server resolves default from available API keys)
  provider: z.enum(["openai", "anthropic", "mock"]).optional(),

  // panel count (for comic feel keep small)
  panelCount: z.number().int().min(1).max(24).optional(),
});

/** Simple timeout wrapper */
async function withTimeout<T>(p: Promise<T>, ms = 45_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)
    ) as any,
  ]);
}

export async function POST(req: Request) {
  const started = Date.now();
  let storyId: string | null = null;

  try {
    const json = await req.json();
    const input = Body.parse(json);

    // 1) Ensure User
    const user = await prisma.user.upsert({
      where: { handle: input.ownerHandle },
      update: {},
      create: { handle: input.ownerHandle, displayName: input.ownerHandle },
      select: { id: true },
    });

    // 2) Ensure Room
    const code = input.roomCode.toUpperCase();
    let room = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!room) {
      room = await prisma.room.create({
        data: { code, createdBy: user.id },
        select: { id: true },
      });
    }

    // 3) Collect photos for this room
    const photos = await prisma.photo.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, storageUrl: true },
      take: 12, // cap
    });
    if (photos.length === 0) {
      return NextResponse.json({ error: "no_photos_in_room" }, { status: 400 });
    }

    // 4) Create Story row in PROCESSING
    const created = await prisma.story.create({
      data: {
        roomId: room.id,
        ownerId: user.id,
        title: "Generating…",
        narrative: "",
        beatsJson: [],
        panelMap: [],
        status: "PROCESSING",
        model: undefined,
        prompt: undefined,
        error: null,
      },
      select: { id: true },
    });
    storyId = created.id;

    // 5) Decide provider (user-selected or resolved by available keys)
    const chosen: ProviderKind =
      (input.provider as ProviderKind | undefined) ?? resolveDefaultProvider();
    const provider = getStoryProvider(chosen);

    // 6) Panel count heuristic: 4–6 (comic-y), clamped by photos
    const panelCount =
      input.panelCount ?? Math.min(6, Math.max(4, photos.length));

    // 7) Prepare photo args (+ captions if available)
    let photoArgs = photos.map((p) => ({
      id: p.id,
      url: p.storageUrl as string,
      caption: undefined as string | undefined,
    }));

    // Caption pass (batched best-effort; failure is non-fatal)
    try {
      const caps = await captionPhotosOpenAI(
        photos.map((p) => ({ id: p.id, url: p.storageUrl }))
      );
      const byId = new Map(caps.map((c) => [c.id, c]));
      photoArgs = photoArgs.map((p) => {
        const hit = byId.get(p.id);
        return hit?.caption ? { ...p, caption: hit.caption } : p;
      });

      // Persist new captions (best-effort)
      await prisma.$transaction(
        caps
          .filter((c) => c.caption)
          .map((c) =>
            prisma.photo.update({
              where: { id: c.id },
              data: { caption: c.caption },
            })
          )
      );
    } catch (e) {
      console.warn(
        "[captions] skipping due to error:",
        (e as Error)?.message || e
      );
    }

    // Common knobs derived from presets
    const promptAudience =
      input.audience ??
      (input.comicAudience === "kids" ? "kids-10-12" : "adults");
    const promptStyle = input.style ?? "funny";
    const promptTone =
      input.tone ?? (input.comicAudience === "kids" ? "wholesome" : "witty");

    // 8) Generate (with timeouts)
    const { beats, panels, title, narrative } = await withTimeout(
      (async () => {
        // Beats
        const beats = await provider.genBeats({
          photos: photoArgs,
          audience: promptAudience,
          style: promptStyle,
          tone: promptTone,
          comicAudience: input.comicAudience,
          quality: input.quality,
        } as any);

        // Panels
        const panels = await provider.genPanels({
          beats,
          photos: photoArgs,
          panelCount,
          comicAudience: input.comicAudience,
          quality: input.quality,
        } as any);

        // Narrative (very short blurb for comic vibe)
        const tn = await provider.genNarrative({
          beats,
          audience: promptAudience,
          style: promptStyle,
          tone: promptTone,
          wordCount: 90,
          comicAudience: input.comicAudience,
          quality: input.quality,
        } as any);

        const title = (tn as any)?.title ?? "Untitled Comic";
        const narrative =
          (tn as any)?.narrative ?? (typeof tn === "string" ? tn : "");

        return { beats, panels, title, narrative };
      })(),
      45_000
    );

    // 9) Persist READY — also record the concrete model resolved for the chosen preset
    const resolvedModel = getModelForQuality(chosen, input.quality);

    await prisma.story.update({
      where: { id: storyId },
      data: {
        title,
        narrative,
        beatsJson: beats as any,
        panelMap: panels as any,
        status: "READY",
        model: resolvedModel,
        prompt: JSON.stringify({
          provider: chosen,
          quality: input.quality,
          comicAudience: input.comicAudience,
          audience: input.audience,
          tone: input.tone,
          style: input.style,
          panelCount,
          startedAt: started,
        }).slice(0, 2000),
        error: null,
      },
    });

    return NextResponse.json({
      id: storyId,
      status: "READY",
      model: resolvedModel,
      settings: {
        provider: chosen,
        quality: input.quality,
        comicAudience: input.comicAudience,
        audience: input.audience ?? promptAudience,
        tone: input.tone ?? promptTone,
        style: input.style ?? promptStyle,
        panelCount,
      },
    });
  } catch (err: any) {
    console.error("POST /api/story error", err?.message || err);
    if (storyId) {
      try {
        await prisma.story.update({
          where: { id: storyId },
          data: {
            status: "ERROR",
            error: String(err?.message || err || "unknown_error").slice(0, 512),
          },
        });
      } catch (e) {
        console.error("Failed to mark story as ERROR", e);
      }
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
