// app/u/[roomCode]/page.tsx
import { prisma } from '@/lib/prisma';
import UploadClient from '@/components/UploadClient';
import StoryControls from '@/components/StoryControls';
import HomeLink from '@/components/HomeLink';
import ShareStoryQuick from '@/components/ShareStoryQuick';
import Link from 'next/link';
import Image from 'next/image';

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

  const renderImg = (
    p: { storageUrl: string; width: number | null; height: number | null },
    priority = false
  ) => {
    const w = p.width && p.width > 0 ? p.width : 1200;
    const h = p.height && p.height > 0 ? p.height : 900;
    return (
      <Image
        src={p.storageUrl}
        alt=""
        width={w}
        height={h}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="w-full h-auto object-cover rounded"
        priority={priority}
      />
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Room <span className="font-mono">{room.code}</span>
          </h1>
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

      {/* Masonry Gallery with captions */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Gallery</h2>
          <span className="muted">
            {room.photos.length} item{room.photos.length === 1 ? '' : 's'}
          </span>
        </div>

        {room.photos.length === 0 ? (
          <p className="muted">No images yet — upload some below!</p>
        ) : (
          <ul className="columns-2 md:columns-3 gap-4 [column-fill:_balance]">
            {room.photos.map((p, i) => (
              <li
                key={p.id}
                className="mb-4 break-inside-avoid rounded-xl border bg-white overflow-hidden"
                title={p.publicId || p.id}
              >
                <a href={p.storageUrl} target="_blank" rel="noreferrer" className="block">
                  {renderImg(p, i < 3)}
                </a>
                {/* Caption (if available) */}
                {/*
                  If your Photo model doesn't have `caption`, this will simply not render any text.
                  To add captions permanently, add `caption String?` to the Photo model and fill it during captioning step.
                */}
                {((p as any).caption)?.length ? (
                  <div className="border-t px-3 py-2 bg-gray-50 dark:bg-zinc-900">
                    <p
                      className="text-xs text-gray-700 dark:text-zinc-300 truncate"
                      title={(p as any).caption}
                      aria-label="Photo caption"
                    >
                      {(p as any).caption}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Uploader */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Upload photos</h2>
        <UploadClient initialGallery={initialGallery} roomCode={room.code} />
      </section>
    </div>
  );
}
