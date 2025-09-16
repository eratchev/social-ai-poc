// app/api/story/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getProvider } from "@/lib/ai/providers"; // factory returning openai|anthropic|mock
import type { ProviderKind } from "@/lib/ai/providers";

/** Keep Node runtime */
export const runtime = "nodejs";

/** Request body schema */
const Body = z.object({
  roomCode: z.string().min(1),
  ownerHandle: z.string().min(1).default("devuser"),

  // creative knobs
  audience: z.string().optional(), // e.g. "kids-10-12" or "adults"
  style: z.string().optional(),    // e.g. "funny", "witty"
  tone: z.string().optional(),     // e.g. "wholesome", "snarky"

  // comic presets
  comicAudience: z.enum(["kids", "adults"]).default("kids"),

  // provider + panel count
  provider: z.enum(["openai", "anthropic", "mock"]).default(
    (process.env.AI_PROVIDER as ProviderKind) || "openai"
  ),
  panelCount: z.number().int().min(1).max(24).optional(), // default below

  // future: save toggle (we always save in this route)
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
    let room = await prisma.room.findUnique({
      where: { code: input.roomCode },
      select: { id: true },
    });
    if (!room) {
      room = await prisma.room.create({
        data: { code: input.roomCode, createdBy: user.id },
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

    // 5) Generate via provider (with timeout)
    const provider = getProvider(input.provider);
    const panelCount = input.panelCount ?? Math.min(6, Math.max(photos.length, 4)); // 4–6 is comic-y

    const photoArgs = photos.map((p) => ({ id: p.id, url: p.storageUrl }));

    console.log(
      `[story ${storyId}] generate start; photos=${photos.length}; provider=${input.provider}; panels=${panelCount}`
    );

    const { beats, panels, title, narrative, modelName } = await withTimeout(
      (async () => {
        // Beats
        const beats = await provider.genBeats({
          photos: photoArgs,
          audience: input.audience ?? (input.comicAudience === "kids" ? "kids-10-12" : "adults"),
          style: input.style ?? "funny",
          tone: input.tone ?? (input.comicAudience === "kids" ? "wholesome" : "witty"),
          // some providers may also accept comicAudience in the signature; harmless if ignored
          comicAudience: input.comicAudience as any,
        } as any);

        // Panels (short, bubble-first)
        const panels = await provider.genPanels({
          beats,
          photos: photoArgs,
          panelCount,
          comicAudience: input.comicAudience as any,
        } as any);

        // Narrative (very short blurb)
        const tn = await provider.genNarrative({
          beats,
          audience: input.audience ?? (input.comicAudience === "kids" ? "kids-10-12" : "adults"),
          style: input.style ?? "funny",
          tone: input.tone ?? (input.comicAudience === "kids" ? "wholesome" : "witty"),
          wordCount: 90,
          comicAudience: input.comicAudience as any,
        } as any);

        const modelName =
          typeof (provider as any).modelName === "function"
            ? (provider as any).modelName()
            : undefined;

        // Support both {title,narrative} and plain string narrative
        const title = (tn as any)?.title ?? "Untitled Comic";
        const narrative =
          (tn as any)?.narrative ?? (typeof tn === "string" ? tn : "");

        return { beats, panels, title, narrative, modelName };
      })(),
      45_000
    );

    console.log(`[story ${storyId}] generate done in ${Date.now() - started}ms`);

    // 6) Persist READY
    await prisma.story.update({
      where: { id: storyId },
      data: {
        title,
        narrative,
        beatsJson: beats as any,
        panelMap: panels as any,
        status: "READY",
        model: modelName,
        prompt: JSON.stringify({
          provider: input.provider,
          comicAudience: input.comicAudience,
          audience: input.audience,
          tone: input.tone,
          style: input.style,
          panelCount,
        }).slice(0, 2000),
        error: null,
      },
    });

    return NextResponse.json({ id: storyId, status: "READY" });
  } catch (err: any) {
    console.error("POST /api/story error", err?.message || err);
    // flip to ERROR if we already created a story row
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
