import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Helper: short, URL-safe slug like "aB3-xY9"
function makeSlug(len = 8) {
  return crypto.randomBytes(Math.ceil(len * 0.75)).toString('base64url').slice(0, len);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Generate a new slug; retry once if unique constraint clashes (rare)
    for (let i = 0; i < 2; i++) {
      const candidate = makeSlug(10);
      try {
        const story = await prisma.story.update({
          where: { id: params.id },
          data: { shareSlug: candidate },
          select: { id: true, shareSlug: true },
        });
        return NextResponse.json({ id: story.id, shareSlug: story.shareSlug });
      } catch (e: any) {
        // If unique violation, loop to try a different slug
        if (!String(e?.message || '').includes('Unique constraint')) throw e;
      }
    }
    return NextResponse.json({ error: 'could_not_generate_slug' }, { status: 500 });
  } catch (err) {
    console.error('POST /api/story/[id]/share error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// Optional: remove sharing (makes it private again)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const story = await prisma.story.update({
      where: { id: params.id },
      data: { shareSlug: null },
      select: { id: true, shareSlug: true },
    });
    return NextResponse.json({ id: story.id, shareSlug: story.shareSlug });
  } catch (err) {
    console.error('DELETE /api/story/[id]/share error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
