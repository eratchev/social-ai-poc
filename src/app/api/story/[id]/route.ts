// src/app/api/story/[id]/route.ts
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const match = new URL(req.url).pathname.match(/\/api\/story\/([^/]+)$/);
    const id = match?.[1];
    if (!id) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const story = await prisma.story.findUnique({
      where: { id },
      include: { room: { select: { code: true } } },
    });

    if (!story) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        id: story.id,
        roomCode: story.room.code,
        title: story.title,
        narrative: story.narrative,
        status: story.status,
        beats: story.beatsJson,
        panels: story.panelMap,
        shareSlug: story.shareSlug,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('GET /api/story/[id] error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
