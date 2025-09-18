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
        headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
      });
    }

    const story = await prisma.story.findFirst({
      where: { shareSlug: slug, status: 'READY' },
      include: { room: { select: { code: true } } },
    });

    if (!story) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
      });
    }

    // Parse generation settings that were saved in story.prompt
    // (We stored provider, quality, audience/tone/style, panelCount, etc.)
    let settings: any = undefined;
    try {
      settings = story.prompt ? JSON.parse(story.prompt) : undefined;
    } catch {
      // non-fatal; leave settings undefined if parsing fails
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
        // NEW fields:
        model: story.model ?? null,  // resolved concrete model id used
        settings,                    // provider/quality/comicAudience/audience/tone/style/panelCount/…
      }),
      { headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' } }
    );
  } catch (err) {
    console.error('GET /api/story/by-slug/[slug] error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
}
