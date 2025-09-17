// src/app/api/story/by-slug/[slug]/meta/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Let Next infer the context type to satisfy its route type guard
export async function GET(_req: Request, { params }: any) {
  const { slug } = params as { slug: string };

  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: "READY" },
    select: { model: true, prompt: true },
  });

  if (!story) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let settings: any = undefined;
  try {
    settings = story.prompt ? JSON.parse(story.prompt) : undefined;
  } catch {
    // ignore parse errors
  }

  return NextResponse.json({
    model: story.model ?? null,
    settings,
  });
}
