// app/s/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { blurDataURL } from '@/lib/blur';
import RegenerateButton from '@/components/RegenerateButton';
import ShareLinkButton from '@/components/ShareLinkButton';

export const runtime = 'nodejs';

type Beat = { photoId?: string; caption: string };
type Panel = { index: number; photoId?: string; narration: string; bubbles: string[] };

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const story = await prisma.story.findFirst({
    where: { shareSlug: params.slug, status: 'READY' },
    select: { title: true },
  });
  if (!story) return { title: 'Story not found' };
  return { title: story.title };
}

export default async function SharedStoryPage({ params }: { params: { slug: string } }) {
  const story = await prisma.story.findFirst({
    where: { shareSlug: params.slug, status: 'READY' },
    include: { room: { select: { code: true } } },
  });

  if (!story) notFound();

  // Parse JSON blobs (they have defaults, but be defensive)
  const beats = (Array.isArray(story.beatsJson) ? story.beatsJson : []) as Beat[];
  const panels = (Array.isArray(story.panelMap) ? story.panelMap : []) as Panel[];

  // Collect photoIds referenced by beats/panels
  const photoIds = Array.from(
    new Set([
      ...beats.map((b) => b.photoId).filter(Boolean),
      ...panels.map((p) => p.photoId).filter(Boolean),
    ] as string[])
  );

  // Fetch photo URLs for referenced ids
  const photos = photoIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: photoIds } },
        select: { id: true, storageUrl: true, publicId: true },
      })
    : [];

  const photoUrlById = new Map(photos.map((p) => [p.id, p.storageUrl]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{story.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Room <span className="font-mono">{story.room.code}</span> · Published{' '}
          {story.createdAt.toLocaleDateString()}
        </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareLinkButton />
          <RegenerateButton roomCode={story.room.code} />
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Narrative */}
        <article className="lg:col-span-2">
          <div className="prose max-w-none whitespace-pre-wrap leading-relaxed">
            {story.narrative}
          </div>
        </article>

        {/* Beats (photo + caption) */}
        <aside className="lg:col-span-1">
          <ul className="space-y-4">
            {beats.map((b, i) => {
              const url = b.photoId ? photoUrlById.get(b.photoId) : null;
              return (
                <li key={i} className="border rounded-xl overflow-hidden">
                  {url ? (
                    <div className="relative w-full" style={{ aspectRatio: '4 / 3' }}>
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover"
                        priority={i === 0} // first image gets priority for LCP
                        placeholder="blur"
                        blurDataURL={blurDataURL(16, 12)}
                      />
                    </div>
                  ) : null}
                  <div className="p-3 text-sm italic">{b.caption}</div>
                </li>
              );
            })}
          </ul>
        </aside>
      </section>

      {/* Optional: Panels section (speech bubbles / extra narration) */}
      {panels.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Panels</h2>
          <ul className="grid md:grid-cols-2 gap-4">
            {panels.map((p) => {
              const url = p.photoId ? photoUrlById.get(p.photoId) : null;
              return (
                <li key={p.index} className="border rounded-xl p-4">
                  {url ? (
                    <div className="relative w-full mb-3" style={{ aspectRatio: '16 / 9' }}>
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover rounded"
                        placeholder="blur"
                        blurDataURL={blurDataURL(16, 9)}                        
                      />
                    </div>
                  ) : null}
                  <div className="font-medium mb-2">Panel {p.index + 1}</div>
                  <p className="text-sm text-gray-700 mb-2">{p.narration}</p>
                  {p.bubbles?.length ? (
                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                      {p.bubbles.map((txt, i) => (
                        <li key={i}>&quot;{txt}&quot;</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
