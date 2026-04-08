// app/s/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ShareLinkButton from '@/components/ShareLinkButton';
import Link from 'next/link';
import StoryMetaCard from '@/components/StoryMetaCard';
import StoryViewer from '@/components/StoryViewer';
import type { Panel } from '@/lib/ai/structured';

export const runtime = 'nodejs';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: 'READY' },
    select: { title: true },
  });
  const title = story ? story.title : 'Story not found';
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function SharedStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const story = await prisma.story.findFirst({
    where: { shareSlug: slug, status: 'READY' },
    include: { room: { select: { code: true } } },
  });

  if (!story) notFound();

  const panels = (Array.isArray(story.panelMap) ? story.panelMap : []) as Panel[];

  // Fetch photos referenced by panels
  const photoIds = Array.from(
    new Set(panels.map((p) => p.photoId).filter(Boolean) as string[])
  );
  const photos = photoIds.length
    ? await prisma.photo.findMany({
        where: { id: { in: photoIds } },
        select: { id: true, storageUrl: true },
      })
    : [];

  // Plain object for serializable client prop
  const photoUrlById: Record<string, string> = Object.fromEntries(
    photos.map((p) => [p.id, p.storageUrl])
  );

  const narrativeParagraphs = (story.narrative ?? '')
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean);

  return (
    <main>
      {/* Header */}
      <header className="mb-6 card p-5 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 bg-clip-text text-transparent dark:from-purple-300 dark:via-pink-300 dark:to-orange-200">
              {story.title}
            </span>
          </h1>
          <p className="muted mt-1 text-sm">
            {panels.length} panels · Room{' '}
            <Link
              href={`/u/${story.room.code}`}
              className="font-mono underline hover:text-black dark:hover:text-white"
            >
              {story.room.code}
            </Link>{' '}
            · {story.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareLinkButton />
        </div>
      </header>

      {/* Comic grid + Comicify button */}
      <StoryViewer
        storyId={story.id}
        initialPanels={panels}
        photoUrlById={photoUrlById}
      />

      {/* Narrative disclosure — collapsed by default */}
      {narrativeParagraphs.length > 0 && (
        <details className="mt-6 card p-5">
          <summary className="cursor-pointer font-semibold text-sm select-none">
            Read the full story
          </summary>
          <div className="prose prose-lg max-w-none leading-relaxed text-zinc-900 dark:text-zinc-100 dark:prose-invert mt-4">
            {narrativeParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </details>
      )}

      <StoryMetaCard shareSlug={slug} />
    </main>
  );
}
