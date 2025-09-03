// src/app/api/photos/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Body = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  folder?: string | null;
  roomCode?: string;
  ownerHandle?: string;
};

function isValidUrl(s: unknown): s is string {
  if (typeof s !== 'string' || s.length > 2048) return false;
  try { new URL(s); return true; } catch { return false; }
}

function isOptionalShort(s: unknown, max = 512): s is string | null | undefined {
  return s == null || (typeof s === 'string' && s.length <= max);
}


export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (typeof data?.publicId !== 'string' || data.publicId.length === 0 || data.publicId.length > 512) {
      return NextResponse.json({ error: 'publicId invalid' }, { status: 400 });
    }
    if (!isValidUrl(data?.secureUrl)) {
      return NextResponse.json({ error: 'secureUrl invalid' }, { status: 400 });
    }
    const width  = Number.isFinite(data?.width)  ? Math.max(0, Math.min(100000, Number(data.width)))  : null;
    const height = Number.isFinite(data?.height) ? Math.max(0, Math.min(100000, Number(data.height))) : null;
    const bytes  = Number.isFinite(data?.bytes)  ? Math.max(0, Math.min(1e9,    Number(data.bytes)))  : null;
    const format = isOptionalShort(data?.format, 32) ? data?.format ?? null : null;
    const folder = isOptionalShort(data?.folder, 256) ? data?.folder ?? null : null;

    const ownerHandle = isOptionalShort(data?.ownerHandle, 64) ? (data?.ownerHandle ?? 'devuser') : 'devuser';
    const roomCode    = isOptionalShort(data?.roomCode, 64)    ? (data?.roomCode ?? 'DEVROOM')    : 'DEVROOM';

    const [user, room] = await Promise.all([
      prisma.user.findUnique({ where: { handle: ownerHandle } }),
      prisma.room.findUnique({ where: { code: roomCode } }),
    ]);
    if (!user || !room) {
      return NextResponse.json({ error: 'Seed user/room not found' }, { status: 400 });
    }

    const photo = await prisma.photo.create({
      data: {
        ownerId: user.id,
        roomId: room.id,
        storageUrl: data.secureUrl,
        publicId: data.publicId,
        width,
        height,
        bytes,
        format,
        folder,
        takenAt: data?.takenAt ? new Date(data.takenAt) : null,
      },
    });

    return NextResponse.json({ ok: true, photo });
  } catch (err: any) {
    console.error('POST /api/photos error', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Default to our dev seeds
    const owner = await prisma.user.findUnique({ where: { handle: 'devuser' } });
    const room  = await prisma.room.findUnique({ where: { code: 'DEVROOM' } });
    if (!owner || !room) {
      return NextResponse.json({ photos: [] });
    }

    const photos = await prisma.photo.findMany({
      where: { ownerId: owner.id, roomId: room.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, storageUrl: true, publicId: true, createdAt: true },
      take: 60, // tweak for your grid
    });

    return NextResponse.json({ photos });
  } catch (err: any) {
    console.error('GET /api/photos error', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
