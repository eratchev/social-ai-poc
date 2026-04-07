import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveDefaultProvider, type ProviderKind } from "@/lib/ai/providers";

export const runtime = "nodejs";

const Body = z.object({
  roomCode: z.string().min(1),
  ownerHandle: z.string().min(1).default("devuser"),
  audience: z.string().optional(),
  style: z.string().optional(),
  tone: z.string().optional(),
  comicAudience: z.enum(["kids", "adults"]).default("kids"),
  quality: z.enum(["fast", "balanced", "premium"]).default("balanced"),
  provider: z.enum(["openai", "anthropic", "mock"]).optional(),
  panelCount: z.number().int().min(1).max(24).optional(),
});

export async function POST(req: Request) {
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

    // 3) Check photos exist and compute panelCount heuristic
    const photos = await prisma.photo.findMany({
      where: { roomId: room.id },
      select: { id: true },
      take: 12,
    });
    if (photos.length === 0) {
      return NextResponse.json({ error: "no_photos_in_room" }, { status: 400 });
    }

    // 4) Resolve provider and prompt knobs
    const chosen: ProviderKind =
      (input.provider as ProviderKind | undefined) ?? resolveDefaultProvider();
    const promptAudience =
      input.audience ?? (input.comicAudience === "kids" ? "kids-10-12" : "adults");
    const promptStyle = input.style ?? "funny";
    const promptTone =
      input.tone ?? (input.comicAudience === "kids" ? "wholesome" : "witty");
    const panelCount =
      input.panelCount ?? Math.min(6, Math.max(4, photos.length));

    // 5) Create Story row in PROCESSING; store params so /run can read them
    const created = await prisma.story.create({
      data: {
        roomId: room.id,
        ownerId: user.id,
        title: "Generating…",
        narrative: "",
        beatsJson: [],
        panelMap: [],
        status: "PROCESSING",
        phase: null,
        prompt: JSON.stringify({
          provider: chosen,
          quality: input.quality,
          comicAudience: input.comicAudience,
          audience: promptAudience,
          tone: promptTone,
          style: promptStyle,
          panelCount,
        }),
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err ?? "unknown_error");
    console.error("POST /api/story error", errMsg);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
