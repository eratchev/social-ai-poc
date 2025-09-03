// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import UploadClient from '@/components/UploadClient';

export const revalidate = 0; // don't cache in dev

export default async function Page() {
  // default to seeded dev user/room
  const owner = await prisma.user.findUnique({ where: { handle: 'devuser' } });
  const room  = await prisma.room.findUnique({ where: { code: 'DEVROOM' } });

  const photos = owner && room
    ? await prisma.photo.findMany({
        where: { ownerId: owner.id, roomId: room.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, storageUrl: true, publicId: true },
        take: 60,
      })
    : [];

  const initialGallery = photos.map(p => ({
    id: p.publicId || p.id,
    url: p.storageUrl,
  }));

  return <UploadClient initialGallery={initialGallery} />;
}