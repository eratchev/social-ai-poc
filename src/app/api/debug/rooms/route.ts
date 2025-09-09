// app/api/debug/rooms/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      select: { id: true, code: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Optional: show which DB we're on (works on Postgres)
    // If your DB user can run this:
    let dbInfo = null as null | { current_database?: string };
    try {
      const [row] = await prisma.$queryRawUnsafe<any[]>(`SELECT current_database() AS current_database`);
      dbInfo = row || null;
    } catch { /* ignore if not allowed */ }

    return NextResponse.json({ count: rooms.length, rooms, dbInfo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
