// app/s/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { blurDataURL } from '@/lib/blur';
import RegenerateButton from '@/components/RegenerateButton';
import ShareLinkButton from '@/components/ShareLinkButton';
import Link from 'next/link';
import StoryMetaCard from '@/components/StoryMetaCard'; // ✅ shows resolved model + settings

export const runtime = 'nodejs';

const SHOW_BEATS = false; // feature flag

// Types aligned with your schemas
type Beat = {
  index: number;
  type: 'setup' | 'inciting' | 'rising' | 'climax' | 'twist' | 'resolution' | 'button' | string;
  summary: string;
  callouts?: string[];
  imageRefs?: number[];
};

type Bubble = { text: string; speaker?: string; aside?: boolean };
type Panel = {
  index: number;
  photoId?: string | null;
  narration?: string;
  bubbles?: Bubble[];
  sfx?: string[];
  alt?: string;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: 'READY' },
    select: { title: true },
  });
  
  const title = story ? story.title : 'Story not found';

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}

// 💬 Dialog bubble chip (dark-mode aware)
function BubbleChip({ b }: { b: Bubble }) {
  return (
    <div
      className={[
        'inline-flex items-start gap-1 rounded-2xl px-3 py-1.5',
        'border bg-white shadow-sm text-zinc-700',
        'dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200',
        b.aside ? 'opacity-80 italic' : 'font-medium',
      ].join(' ')}
    >
      {b.speaker ? <span className="text-zinc-800 dark:text-zinc-100">{b.speaker}:</span> : null}
      <span>{b.text}</span>
    </div>
  );
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

  // Collect DB photo IDs referenced by PANELS only
  const photoIds = Array.from(new Set(panels.map((p) => p.photoId).filter(Boolean) as string[]));

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

  // Convert narrative text into <p> elements so typography styles apply in dark mode
  const narrativeParagraphs = (story.narrative ?? '')
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean);

  return (
    <main>
      {/* Header */}
      <header className="mb-8 card p-5 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 bg-clip-text text-transparent dark:from-purple-300 dark:via-pink-300 dark:to-orange-200">
              {story.title}
            </span>
          </h1>
          <p className="muted mt-1 text-sm">
            Room{' '}
            <Link href={`/u/${story.room.code}`} className="font-mono underline hover:text-black dark:hover:text-white">
              {story.room.code}
            </Link>{' '}
            · Published {story.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareLinkButton />
          {/* <RegenerateButton roomCode={story.room.code} /> */}
        </div>
      </header>

      {/* Narrative + Beats */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Narrative */}
        <article className="lg:col-span-2 card p-6">
          <div className="prose prose-lg max-w-none leading-relaxed text-zinc-900 dark:text-zinc-100 dark:prose-invert">
            {narrativeParagraphs.length > 0 ? (
              narrativeParagraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>{story.narrative}</p>
            )}
          </div>
        </article>

        {/* Beats — text summaries */}
        {SHOW_BEATS && (
          <aside className="lg:col-span-1 card p-4">
            <h2 className="text-sm font-semibold mb-3 text-zinc-800 dark:text-zinc-200">Beats</h2>
            <ol className="space-y-3 list-decimal list-inside">
              {beats.map((b) => (
                <li key={b.index} className="text-[15px]">
                  <div className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{b.type}</div>
                  <div className="text-zinc-700 dark:text-zinc-300 leading-snug">{b.summary}</div>
                  {b.callouts?.length ? (
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      callouts: {b.callouts.join(', ')}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </section>

      {/* Panels — masonry using CSS columns */}
      {panels.length > 0 && (
        <section className="mt-6 card p-5">
          <h2 className="text-sm font-semibold mb-3">Panels</h2>
          <ul className="columns-1 md:columns-2 gap-4 [column-fill:_balance]">
            {panels.map((p) => {
              const hit = resolve(p.photoId ?? undefined);
              return (
                <li
                  key={p.index}
                  className="mb-4 break-inside-avoid rounded-2xl border p-3 bg-white shadow-sm
                             dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-none"
                >
                  {hit ? <Img hit={hit} /> : null}

                  <div className="mt-3 flex items-baseline justify-between">
                    <div className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">
                      Panel {p.index + 1}
                    </div>
                    {p.sfx?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.sfx.map((s, i) => (
                          <span
                            key={i}
                            className="inline-block rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wide
                                       text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {p.narration ? (
                    <p className="mt-1 text-[15px] leading-snug text-zinc-800 dark:text-zinc-200">{p.narration}</p>
                  ) : null}

                  {p.bubbles?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.bubbles.map((b, i) => (
                        <BubbleChip key={i} b={b} />
                      ))}
                    </div>
                  ) : null}

                  {p.alt ? (
                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 italic">{p.alt}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ✅ Moved to the very bottom: resolved model + all generation settings */}
      <StoryMetaCard shareSlug={slug} />
    </main>
  );
}
