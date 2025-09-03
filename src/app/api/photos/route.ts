import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface PhotoPayload {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  folder?: string | null;
  roomCode?: string;
  ownerHandle?: string;
  takenAt?: string | Date | null;
}

function isPhotoPayload(x: unknown): x is PhotoPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.publicId === 'string' && typeof o.secureUrl === 'string';
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as unknown;
    if (!isPhotoPayload(json)) {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const {
      publicId,
      secureUrl,
      width,
      height,
      bytes,
      format,
      folder,
      roomCode = 'DEVROOM',
      ownerHandle = 'devuser',
      takenAt,
    } = json;

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
        storageUrl: secureUrl,
        publicId,
        width: Number.isFinite(width) ? Number(width) : null,
        height: Number.isFinite(height) ? Number(height) : null,
        bytes: Number.isFinite(bytes) ? Number(bytes) : null,
        format: typeof format === 'string' ? format : null,
        folder: typeof folder === 'string' ? folder : null,
        takenAt: takenAt ? new Date(takenAt) : null,
      },
    });

    return NextResponse.json({ ok: true, photo });
  } catch (err) {
    console.error('POST /api/photos error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [user, room] = await Promise.all([
      prisma.user.findUnique({ where: { handle: 'devuser' } }),
      prisma.room.findUnique({ where: { code: 'DEVROOM' } }),
    ]);
    if (!user || !room) return NextResponse.json({ photos: [] });

    const photos = await prisma.photo.findMany({
      where: { ownerId: user.id, roomId: room.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, storageUrl: true, publicId: true, createdAt: true },
      take: 60,
    });

    return NextResponse.json({ photos });
  } catch (err) {
    console.error('GET /api/photos error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
