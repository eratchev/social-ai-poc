// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import UploadClient from '@/components/UploadClient';
import GenerateStoryButton from '@/components/GenerateStoryButton';

export const runtime = 'nodejs';
export const revalidate = 0; // don't cache in dev

export default async function Page() {
  // Default to seeded dev user/room
  const owner = await prisma.user.findUnique({ where: { handle: 'devuser' } });
  const room = await prisma.room.findUnique({ where: { code: 'DEVROOM' } });

  const photos =
    owner && room
      ? await prisma.photo.findMany({
          where: { ownerId: owner.id, roomId: room.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, storageUrl: true, publicId: true },
          take: 60,
        })
      : [];

  const initialGallery = photos.map((p) => ({
    id: p.publicId || p.id,
    url: p.storageUrl,
  }));

  const hasPhotos = initialGallery.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Funny Photo Story — POC</h1>
          <p className="text-sm text-gray-600">
            Room <span className="font-mono">DEVROOM</span> · {hasPhotos ? `${initialGallery.length} photo(s)` : 'No photos yet'}
          </p>
        </div>

        {/* Generate Story CTA (enabled once there’s at least 1 photo) */}
        <GenerateStoryButton
          roomCode="DEVROOM"
          className={hasPhotos ? '' : 'pointer-events-none opacity-50'}
          label={hasPhotos ? 'Generate Story' : 'Add photos to generate'}
        />
      </header>

      {/* Your existing uploader/gallery UI */}
      <UploadClient initialGallery={initialGallery} />
    </main>
  );
}
