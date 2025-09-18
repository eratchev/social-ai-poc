// src/app/api/story/[id]/share/route.ts
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

function makeSlug(length = 21) {
  const raw = randomBytes(Math.ceil((length * 3) / 4)).toString('base64url');
  return raw.slice(0, length);
}

// Extract story id from URL: /api/story/<id>/share
function getIdFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/api\/story\/([^/]+)\/share$/);
  return match?.[1];
}

export async function POST(req: Request) {
  try {
    const id = getIdFromUrl(req.url);
    if (!id) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Generate a new slug; retry once if unique constraint clashes (rare)
    for (let i = 0; i < 2; i++) {
      const candidate = makeSlug();
      try {
        const story = await prisma.story.update({
          where: { id },
          data: { shareSlug: candidate },
          select: { id: true, shareSlug: true },
        });
        return new Response(JSON.stringify(story), {
          headers: { 'content-type': 'application/json' },
        });
      } catch (e: any) {
        // If unique violation, loop to try a different slug
        const msg = String(e?.message || '');
        if (!msg.includes('Unique constraint') && e?.code !== 'P2002') throw e;
      }
    }

    return new Response(JSON.stringify({ error: 'could_not_generate_slug' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('POST /api/story/[id]/share error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

// Optional: remove sharing (makes it private again)
export async function DELETE(req: Request) {
  try {
    const id = getIdFromUrl(req.url);
    if (!id) {
      return new Response(JSON.stringify({ error: 'bad_request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const story = await prisma.story.update({
      where: { id },
      data: { shareSlug: null },
      select: { id: true, shareSlug: true },
    });

    return new Response(JSON.stringify(story), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('DELETE /api/story/[id]/share error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
