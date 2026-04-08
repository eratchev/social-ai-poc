import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { id: true, publicId: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (photo.publicId) {
      // Best-effort: if Cloudinary is unavailable, still delete the DB record
      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (err) {
        console.error('Cloudinary destroy failed for', photo.publicId, err);
      }
    }

    await prisma.photo.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/photos/[id] error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
