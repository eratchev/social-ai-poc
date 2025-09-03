import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const story = await prisma.story.findFirst({
      where: { shareSlug: params.slug, status: 'READY' },
      include: { room: { select: { code: true } } },
    });
    if (!story) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    return NextResponse.json({
      id: story.id,
      roomCode: story.room.code,
      title: story.title,
      narrative: story.narrative,
      beats: story.beatsJson,
      panels: story.panelMap,
      createdAt: story.createdAt,
    });
  } catch (err) {
    console.error('GET /api/story/by-slug/[slug] error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
