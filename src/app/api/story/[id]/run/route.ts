import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getStoryProvider,
  resolveDefaultProvider,
  type ProviderKind,
  type TitleNarrative,
} from "@/lib/ai/providers";
import { captionPhotosOpenAI } from "@/lib/ai/captions-openai";
import { getModelForQuality } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

function getIdFromUrl(url: string): string | undefined {
  const match = new URL(url).pathname.match(/\/api\/story\/([^/]+)\/run$/);
  return match?.[1];
}

function withTimeout<T>(p: Promise<T>, ms = 45_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    }),
  ]);
}

export async function POST(req: Request) {
  const started = Date.now();
  let storyId: string | null = null;

  try {
    const id = getIdFromUrl(req.url);
    if (!id) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Fetch story
    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true, roomId: true, prompt: true, status: true },
    });
    if (!story) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (!story.prompt) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    storyId = story.id;

    // Parse params stored by init endpoint
    let params: {
      provider: ProviderKind;
      quality: "fast" | "balanced" | "premium";
      comicAudience: "kids" | "adults";
      audience: string;
      tone: string;
      style: string;
      panelCount: number;
    };
    try {
      params = JSON.parse(story.prompt);
    } catch {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Fetch photos for this room
    const photos = await prisma.photo.findMany({
      where: { roomId: story.roomId },
      orderBy: { createdAt: "asc" },
      select: { id: true, storageUrl: true },
      take: 12,
    });
    if (photos.length === 0) {
      return new Response(JSON.stringify({ error: "no_photos_in_room" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Resolve provider
    const chosen: ProviderKind = params.provider ?? resolveDefaultProvider();
    const provider = getStoryProvider(chosen);

    // Prepare photo args
    let photoArgs = photos.map((p) => ({
      id: p.id,
      url: p.storageUrl,
      caption: undefined as string | undefined,
    }));

    // Caption pass (best-effort, non-fatal)
    try {
      const caps = await captionPhotosOpenAI(
        photos.map((p) => ({ id: p.id, url: p.storageUrl }))
      );
      const byId = new Map(caps.map((c) => [c.id, c]));
      photoArgs = photoArgs.map((p) => {
        const hit = byId.get(p.id);
        return hit?.caption ? { ...p, caption: hit.caption } : p;
      });
      await prisma.$transaction(
        caps
          .filter((c) => c.caption)
          .map((c) =>
            prisma.photo.update({ where: { id: c.id }, data: { caption: c.caption } })
          )
      );
    } catch (e) {
      console.warn("[captions] skipping due to error:", (e as Error)?.message || e);
    }

    // AI pipeline with phase updates between steps
    const { beats, panels, title, narrative } = await withTimeout(
      (async () => {
        // Phase 1: beats
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "beats" } });
        const beats = await provider.genBeats({
          photos: photoArgs,
          audience: params.audience,
          style: params.style,
          tone: params.tone,
          comicAudience: params.comicAudience,
          quality: params.quality,
        });

        // Phase 2: panels
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "panels" } });
        const panels = await provider.genPanels({
          beats,
          photos: photoArgs,
          panelCount: params.panelCount,
          comicAudience: params.comicAudience,
          quality: params.quality,
        });

        // Phase 3: narrative
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "narrative" } });
        const tn = (await provider.genNarrative({
          beats,
          audience: params.audience,
          style: params.style,
          tone: params.tone,
          wordCount: 90,
          comicAudience: params.comicAudience,
          quality: params.quality,
        })) as TitleNarrative | undefined;

        if (tn && typeof tn !== "object") {
          console.warn("[story] genNarrative returned unexpected type:", typeof tn);
        }

        return {
          beats,
          panels,
          title: tn?.title || "Untitled Comic",
          narrative: tn?.narrative || "",
        };
      })()
    );

    // Mark READY
    const resolvedModel = getModelForQuality(chosen, params.quality);
    await prisma.story.update({
      where: { id: storyId },
      data: {
        title,
        narrative,
        beatsJson: beats as unknown as object,
        panelMap: panels as unknown as object,
        status: "READY",
        phase: null,
        model: resolvedModel,
        prompt: JSON.stringify({
          provider: chosen,
          quality: params.quality,
          comicAudience: params.comicAudience,
          audience: params.audience,
          tone: params.tone,
          style: params.style,
          panelCount: params.panelCount,
          startedAt: started,
        }),
        error: null,
      },
    });

    return NextResponse.json({
      status: "READY",
      model: resolvedModel,
      settings: {
        provider: chosen,
        quality: params.quality,
        comicAudience: params.comicAudience,
        audience: params.audience,
        tone: params.tone,
        style: params.style,
        panelCount: params.panelCount,
      },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err ?? "unknown_error");
    console.error("POST /api/story/[id]/run error", errMsg);
    if (storyId) {
      try {
        await prisma.story.update({
          where: { id: storyId },
          data: { status: "ERROR", phase: null, error: errMsg.slice(0, 512) },
        });
      } catch (e) {
        console.error("Failed to mark story as ERROR", e);
      }
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
