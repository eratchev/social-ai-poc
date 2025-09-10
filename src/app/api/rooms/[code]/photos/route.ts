// app/api/rooms/[code]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;          // <- await the Promise in Next 15
  const upper = code.toUpperCase();

  try {
    const room = await prisma.room.findUnique({
      where: { code: upper },
      select: {
        photos: {
          select: { id: true, storageUrl: true, width: true, height: true, publicId: true },
          orderBy: { createdAt: 'desc' },
          take: 60,
        },
      },
    });

    if (!room) return NextResponse.json({ photos: [] });
    return NextResponse.json({ photos: room.photos });
  } catch (e) {
    console.error('GET /api/rooms/[code]/photos error', e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
