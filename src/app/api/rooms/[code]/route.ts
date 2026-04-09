import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type RouteContext = { params: Promise<{ code: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { code },
      select: { code: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : null;

    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }

    const updated = await prisma.room.update({
      where: { code },
      data: { name },
      select: { code: true, name: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/rooms/[code] error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { code },
      select: { code: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Fetch photos with publicId for Cloudinary cleanup
    const photos = await prisma.photo.findMany({
      where: { room: { code } },
      select: { publicId: true },
    });

    // Best-effort Cloudinary cleanup — don't abort on failure
    await Promise.all(
      photos
        .filter((p) => p.publicId)
        .map(async (p) => {
          try {
            await cloudinary.uploader.destroy(p.publicId!);
          } catch (err) {
            console.error('Cloudinary destroy failed for', p.publicId, err);
          }
        })
    );

    // DB cascade deletes all photos and stories
    await prisma.room.delete({ where: { code } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/rooms/[code] error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
