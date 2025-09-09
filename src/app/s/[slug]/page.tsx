// app/s/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { blurDataURL } from '@/lib/blur';
import RegenerateButton from '@/components/RegenerateButton';
import ShareLinkButton from '@/components/ShareLinkButton';
import HomeLink from '@/components/HomeLink';
import Link from 'next/link';

export const runtime = 'nodejs';

type Beat = { photoId?: string; caption: string };
type Panel = { index: number; photoId?: string; narration: string; bubbles: string[] };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: 'READY' },
    select: { title: true },
  });
  if (!story) return { title: 'Story not found' };
  return { title: story.title };
}

export default async function SharedStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: 'READY' },
    include: { room: { select: { code: true } } },
  });

  if (!story) notFound();

  // Parse JSON blobs (defensive)
  const beats = (Array.isArray(story.beatsJson) ? story.beatsJson : []) as Beat[];
  const panels = (Array.isArray(story.panelMap) ? story.panelMap : []) as Panel[];

  // Collect DB photo IDs referenced by beats/panels
  const photoIds = Array.from(
    new Set([
      ...beats.map((b) => b.photoId).filter(Boolean),
      ...panels.map((p) => p.photoId).filter(Boolean),
    ] as string[])
  );

  // Fetch photos by DB id only
  const photos = photoIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: photoIds } },
        select: { id: true, storageUrl: true, width: true, height: true },
      })
    : [];

  type Hit = { url: string; w: number; h: number };
  const byId = new Map<string, Hit>(
    photos.map((p) => [
      p.id,
      {
        url: p.storageUrl,
        w: p.width && p.width > 0 ? p.width : 1200,
        h: p.height && p.height > 0 ? p.height : 900,
      },
    ])
  );
  const resolve = (id?: string | null): Hit | null => (id ? byId.get(id) ?? null : null);

  // Helper to render a responsive image (no `fill`, natural height for masonry)
  const Img = ({
    hit,
    priority = false,
  }: {
    hit: Hit;
    priority?: boolean;
  }) => (
    <Image
      src={hit.url}
      alt=""
      width={hit.w}
      height={hit.h}
      sizes="100vw"
      className="w-full h-auto object-cover rounded"
      priority={priority}
      placeholder="blur"
      blurDataURL={blurDataURL(16, 12)}
    />
  );

  return (
    <main>
      {/* Header */}
      <header className="mb-8 card p-5 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{story.title}</h1>
          <p className="muted mt-1">
            Room{' '}
            <Link href={`/u/${story.room.code}`} className="font-mono underline hover:text-black">
              {story.room.code}
            </Link>{' '}
            · Published {story.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareLinkButton />
          <RegenerateButton roomCode={story.room.code} />
        </div>
      </header>

      {/* Narrative + Beats (beats now masonry) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Narrative */}
        <article className="lg:col-span-2 card p-6">
          <div className="prose max-w-none whitespace-pre-wrap leading-relaxed">
            {story.narrative}
          </div>
        </article>

        {/* Beats — masonry using CSS columns */}
        <aside className="lg:col-span-1 card p-4">
          <h2 className="text-sm font-semibold mb-3">Beats</h2>
          {/* On small screens we give 2 columns; on large (narrow sidebar) force 1 */}
          <ul className="columns-1 sm:columns-2 lg:columns-1 gap-3 [column-fill:_balance]">
            {beats.map((b, i) => {
              const hit = resolve(b.photoId);
              if (!hit) return null;
              return (
                <li key={i} className="mb-3 break-inside-avoid rounded-xl border p-2 bg-white">
                  <Img hit={hit} priority={i === 0} />
                  {b.caption ? (
                    <div className="mt-2 text-xs italic leading-snug text-gray-700">{b.caption}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      </section>

      {/* Panels — masonry using CSS columns */}
      {panels.length > 0 && (
        <section className="mt-6 card p-5">
          <h2 className="text-sm font-semibold mb-3">Panels</h2>
          <ul className="columns-1 md:columns-2 gap-4 [column-fill:_balance]">
            {panels.map((p) => {
              const hit = resolve(p.photoId);
              return (
                <li key={p.index} className="mb-4 break-inside-avoid rounded-xl border p-3 bg-white">
                  {hit ? <Img hit={hit} /> : null}
                  <div className="mt-2 font-medium">Panel {p.index + 1}</div>
                  <p className="text-sm text-gray-700 mb-1">{p.narration}</p>
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
