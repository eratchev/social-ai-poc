import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Quick DB ping
    await prisma.$queryRaw`SELECT 1`;

    // Return minimal env hints (non-sensitive)
    return NextResponse.json({
      ok: true,
      db: 'up',
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
        preset: process.env.CLOUDINARY_UPLOAD_PRESET ? 'set' : 'missing',
      },
      env: process.env.VERCEL ? 'vercel' : 'local',
    });
  } catch (e) {
    console.error('/api/health error', e);
    return NextResponse.json({ ok: false, error: 'health_check_failed' }, { status: 500 });
  }
}
