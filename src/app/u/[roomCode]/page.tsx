// app/u/[roomCode]/page.tsx
import { prisma } from '@/lib/prisma';
import UploadClient from '@/components/UploadClient';
import StoryControls from '@/components/StoryControls';
import HomeLink from '@/components/HomeLink';
import ShareStoryQuick from '@/components/ShareStoryQuick';
import GalleryLive from '@/components/GalleryLive';
import RoomNameEditor from '@/components/RoomNameEditor';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageParams = { roomCode: string };

export default async function RoomPage({ params }: { params: Promise<PageParams> }) {
  const { roomCode } = await params;
  const code = roomCode.toUpperCase();

  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      photos: {
        select: {
          id: true,
          storageUrl: true,
          publicId: true,
          width: true,
          height: true,
          caption: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
        },
        stories: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            shareSlug: true,
            status: true,
            createdAt: true,
          },
        },
    },
  });
  
  if (!room) {
    return (
      <div className="card p-8">
        <h1 className="text-2xl font-semibold mb-2">Room not found</h1>
        <p className="muted">
          Create this room from the home page, or upload using this code:{' '}
          <span className="font-mono">{code}</span>.
        </p>
        <div className="mt-4"><HomeLink /></div>
      </div>
    );
  }

  const initialGallery = room.photos.map((p) => ({
    id: p.id,
    url: p.storageUrl,
    // we don't pass caption into UploadClient right now—kept simple
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div>
          <RoomNameEditor roomCode={room.code} initialName={room.name} />
          <p className="muted">{room.photos.length} photo(s)</p>
          <div className="mt-2 flex gap-2">
            <HomeLink />
            <Link href={`/u/${room.code}`} className="btn btn-outline">↻ Refresh</Link>
          </div>
        </div>
        <StoryControls roomCode={room.code} />
      </header>

      {/* Recent stories */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Recent stories</h2>
        {room.stories.length === 0 ? (
          <p className="muted">No stories yet — generate one!</p>
        ) : (
          <ul className="divide-y">
            {room.stories.map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-xs text-gray-500">
                    {s.status} · {s.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="shrink-0">
                  {s.shareSlug ? (
                    <Link href={`/s/${s.shareSlug}`} className="btn btn-primary text-xs px-3 py-1">
                      Open
                    </Link>
                  ) : (
                    <ShareStoryQuick storyId={s.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Gallery with hover delete */}
      <GalleryLive roomCode={room.code} initial={room.photos} />

      {/* Uploader */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Upload photos</h2>
        <UploadClient initialGallery={initialGallery} roomCode={room.code} />
      </section>
    </div>
  );
}
