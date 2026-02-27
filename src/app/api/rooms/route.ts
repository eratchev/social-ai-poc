// app/api/rooms/route.ts
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const runtime = 'nodejs';

export function randomCode(len = 6) {
  // hex encoding produces only 0-9 and a-f — all alphanumeric, no stripping needed.
  return `R-${crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len)}`;
}

export async function POST(req: Request) {
  try {
    const { code, ownerHandle = 'devuser' } = await req.json().catch(() => ({}));
    const roomCode = (code ?? randomCode()).toUpperCase();

    // ensure user
    const user = await prisma.user.upsert({
      where: { handle: ownerHandle },
      update: {},
      create: { handle: ownerHandle, displayName: ownerHandle },
      select: { id: true },
    });

    // find-or-create room
    const room = await prisma.room.upsert({
      where: { code: roomCode },
      update: {},
      create: { code: roomCode, createdBy: user.id },
      select: { code: true },
    });

    return new Response(JSON.stringify({ code: room.code }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('POST /api/rooms error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
}
