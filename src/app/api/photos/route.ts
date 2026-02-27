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
      roomCode: rawRoomCode = 'DEVROOM',
      ownerHandle = 'devuser',
      takenAt,
    } = json;

    // Bug 5 fix: always normalise room code to uppercase
    const roomCode = rawRoomCode.toUpperCase();

    // Bug 6 fix: validate the date and fall back to null if invalid
    let takenAtDate: Date | null = null;
    if (takenAt) {
      const d = new Date(takenAt);
      takenAtDate = isNaN(d.getTime()) ? null : d;
    }

    // 1) User upsert
    const user = await prisma.user.upsert({
      where: { handle: ownerHandle },
      update: {},
      create: { handle: ownerHandle, displayName: ownerHandle },
      select: { id: true },
    });

    // 2) Room find-or-create (Room requires creator)
    let room = await prisma.room.findUnique({
      where: { code: roomCode },
      select: { id: true },
    });
    if (!room) {
      room = await prisma.room.create({
        data: {
          code: roomCode,
          createdBy: user.id, // FK to User
        },
        select: { id: true },
      });
    }

    // 3) Create Photo
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
        takenAt: takenAtDate,
      },
    });

    return NextResponse.json({ ok: true, photo });
  } catch (err) {
    console.error('POST /api/photos error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // Bug 7 fix: accept optional roomCode query param; return empty array if omitted
    const { searchParams } = new URL(req.url);
    const rawRoomCode = searchParams.get('roomCode');

    if (!rawRoomCode) {
      return NextResponse.json({ photos: [] });
    }

    const roomCode = rawRoomCode.toUpperCase();

    const photos = await prisma.photo.findMany({
      where: { room: { code: roomCode } },
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
