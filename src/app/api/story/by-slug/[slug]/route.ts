// src/app/api/story/by-slug/[slug]/route.ts
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Extract slug from URL: /api/story/by-slug/<slug>
function getSlugFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/api\/story\/by-slug\/([^/]+)$/);
  return match?.[1];
}

export async function GET(req: Request) {
  try {
    const slug = getSlugFromUrl(req.url);
    if (!slug) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const story = await prisma.story.findFirst({
      where: { shareSlug: slug, status: 'READY' },
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
        beats: story.beatsJson,
        panels: story.panelMap,
        createdAt: story.createdAt,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('GET /api/story/by-slug/[slug] error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
