import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const story = await prisma.story.findUnique({
      where: { id: params.id },
      include: {
        room: { select: { code: true } },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      id: story.id,
      roomCode: story.room.code,
      title: story.title,
      narrative: story.narrative,
      status: story.status,
      beats: story.beatsJson,   // JSON array
      panels: story.panelMap,   // JSON array
      shareSlug: story.shareSlug,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    });
  } catch (err) {
    console.error('GET /api/story/[id] error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
