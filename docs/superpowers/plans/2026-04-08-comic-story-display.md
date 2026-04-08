# Comic Story Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the masonry panel layout on `/s/[slug]` with a comic-book-style 2-column grid where photos fill their cells and text overlays (narration, bubbles, SFX) sit on top of the images.

**Architecture:** Extract a `ComicPanel` client component that renders one comic cell (photo fill + overlays); the server page component fetches data and renders a `<ul>` grid of `ComicPanel`s. The narrative prose moves below the grid inside a collapsed `<details>` disclosure. No new dependencies.

**Tech Stack:** Next.js 16 App Router (server component + client component), Tailwind CSS, Vitest + React Testing Library, next/image (mocked in tests via existing setup.ts mock).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/ComicPanel.tsx` | Create | Renders one comic panel cell — photo fill, overlays (number badge, SFX, bubbles, caption box), no-photo fallback |
| `src/components/ComicPanel.test.tsx` | Create | Tests for all ComicPanel visual states |
| `src/app/s/[slug]/page.tsx` | Modify | Replace masonry with 2-column comic grid, move narrative to `<details>`, update header subtitle |

---

## Task 1: ComicPanel component (TDD)

**Files:**
- Create: `src/components/ComicPanel.tsx`
- Create: `src/components/ComicPanel.test.tsx`

### Context

`ComicPanel` is a `'use client'` component even though it has no state or event handlers — this keeps it importable from both the server page and test files without Next.js server-only restrictions. It uses `next/image` with `fill` (parent controls size via `aspectRatio`).

The existing test setup at `src/test/setup.ts` already mocks `next/image` as a plain `<img>` tag, so no new mocks are needed.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ComicPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ComicPanel from './ComicPanel';

// ComicPanel renders as <li>, so wrap in <ul> for valid HTML
const wrap = (ui: React.ReactElement) =>
  render(<ul>{ui}</ul>);

describe('ComicPanel', () => {
  it('renders panel number badge (1-indexed)', () => {
    wrap(<ComicPanel index={0} />);
    // badge shows index + 1
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders photo when photoUrl is provided', () => {
    wrap(<ComicPanel index={0} photoUrl="https://example.com/img.jpg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('renders large fallback number when no photo', () => {
    wrap(<ComicPanel index={2} />);
    // fallback shows index + 1 = 3 (large centered number)
    // badge also shows 3, so at least 2 elements with "3"
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('renders SFX joined by space', () => {
    wrap(<ComicPanel index={0} sfx={['POW', 'BAM']} />);
    expect(screen.getByText('POW BAM')).toBeInTheDocument();
  });

  it('does not render SFX element when sfx is empty', () => {
    wrap(<ComicPanel index={0} sfx={[]} />);
    expect(screen.queryByText(/POW/i)).not.toBeInTheDocument();
  });

  it('renders narration text in caption box', () => {
    wrap(<ComicPanel index={0} narration="She looked at the sky." />);
    expect(screen.getByText('She looked at the sky.')).toBeInTheDocument();
  });

  it('does not render caption box when narration is absent', () => {
    wrap(<ComicPanel index={0} />);
    // No narration element — nothing with narration-like text
    expect(screen.queryByText(/looked at the sky/)).not.toBeInTheDocument();
  });

  it('renders up to 3 bubble chips and truncates extras', () => {
    const bubbles = [
      { text: 'First' },
      { text: 'Second' },
      { text: 'Third' },
      { text: 'Fourth — should be hidden' },
    ];
    wrap(<ComicPanel index={0} bubbles={bubbles} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.queryByText('Fourth — should be hidden')).not.toBeInTheDocument();
  });

  it('renders bubble speaker prefix', () => {
    wrap(<ComicPanel index={0} bubbles={[{ text: 'Wow!', speaker: 'Alice' }]} />);
    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByText('Wow!')).toBeInTheDocument();
  });

  it('does not render bubbles div when bubbles array is empty', () => {
    wrap(<ComicPanel index={0} bubbles={[]} />);
    expect(screen.queryByText(/First/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run src/components/ComicPanel.test.tsx
```

Expected: All tests fail with `Cannot find module './ComicPanel'`.

- [ ] **Step 3: Implement ComicPanel**

Create `src/components/ComicPanel.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { blurDataURL } from '@/lib/blur';

type Bubble = { text: string; speaker?: string; aside?: boolean };

export type ComicPanelProps = {
  index: number;
  narration?: string;
  bubbles?: Bubble[];
  sfx?: string[];
  photoUrl?: string | null;
  alt?: string;
};

function BubbleChip({ b }: { b: Bubble }) {
  return (
    <div
      className={[
        'inline-flex items-start gap-1 rounded-2xl px-3 py-1.5',
        'border bg-white/90 shadow text-zinc-800',
        'dark:bg-zinc-800/90 dark:border-zinc-700 dark:text-zinc-200',
        b.aside ? 'opacity-80 italic' : 'font-medium',
      ].join(' ')}
    >
      {b.speaker ? <span className="font-semibold">{b.speaker}:</span> : null}
      <span>{b.text}</span>
    </div>
  );
}

export default function ComicPanel({
  index,
  narration,
  bubbles,
  sfx,
  photoUrl,
  alt,
}: ComicPanelProps) {
  return (
    <li
      className="relative overflow-hidden bg-zinc-800"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Photo or large-number fallback */}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={alt ?? ''}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          priority={index < 2}
          placeholder="blur"
          blurDataURL={blurDataURL(16, 12)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-black text-zinc-600">{index + 1}</span>
        </div>
      )}

      {/* Panel number badge — top-left */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
        {index + 1}
      </div>

      {/* SFX — top-right */}
      {sfx?.length ? (
        <div className="absolute top-2 right-2 z-20 font-black text-yellow-300 text-sm uppercase tracking-widest drop-shadow">
          {sfx.join(' ')}
        </div>
      ) : null}

      {/* Bottom overlay: bubble chips above caption box */}
      <div className="absolute inset-0 flex flex-col justify-end z-10">
        {bubbles?.length ? (
          <div className="flex flex-wrap justify-center gap-1.5 px-2 pb-1">
            {bubbles.slice(0, 3).map((b, i) => (
              <BubbleChip key={i} b={b} />
            ))}
          </div>
        ) : null}
        {narration ? (
          <div className="bg-black/70 text-white text-sm px-3 py-2 leading-snug line-clamp-4">
            {narration}
          </div>
        ) : null}
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run src/components/ComicPanel.test.tsx
```

Expected: 10 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ComicPanel.tsx src/components/ComicPanel.test.tsx
git commit -m "feat: add ComicPanel component with photo fill and overlay elements"
```

---

## Task 2: Rewrite story page with comic layout

**Files:**
- Modify: `src/app/s/[slug]/page.tsx`

### Context

The current page at `src/app/s/[slug]/page.tsx` (252 lines) has:
- `SHOW_BEATS = false` feature flag + `Beat` type + beats sidebar — all dead code, remove them
- `BubbleChip` function — moves to `ComicPanel.tsx`, remove from page
- `Img` helper — no longer needed, `ComicPanel` handles images, remove it
- Masonry `<ul className="columns-1 md:columns-2 ...">` — replace with 2-column grid using `ComicPanel`
- Narrative `<article>` in a `grid grid-cols-1 lg:grid-cols-3` — replace with `<details>` below the comic
- Header subtitle — update to show panel count

No tests are written for this task because all visual logic now lives in `ComicPanel` (which is tested in Task 1). This task only wires data to `ComicPanel` and restructures the page layout.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/app/s/[slug]/page.tsx` with:

```tsx
// app/s/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ShareLinkButton from '@/components/ShareLinkButton';
import Link from 'next/link';
import StoryMetaCard from '@/components/StoryMetaCard';
import ComicPanel from '@/components/ComicPanel';

export const runtime = 'nodejs';

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

  const photoUrlById = new Map<string, string>(
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

      {/* Comic grid */}
      <section className="border-2 border-black dark:border-zinc-700">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-black dark:bg-zinc-700">
          {panels.map((p) => (
            <ComicPanel
              key={p.index}
              index={p.index}
              narration={p.narration}
              bubbles={p.bubbles}
              sfx={p.sfx}
              photoUrl={p.photoId ? (photoUrlById.get(p.photoId) ?? null) : null}
              alt={p.alt}
            />
          ))}
        </ul>
      </section>

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
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm vitest run
```

Expected: All tests pass (no regressions). The previous 230 tests plus the 10 new ComicPanel tests = 240 total.

- [ ] **Step 3: Run the TypeScript build**

```bash
pnpm build
```

Expected: Build succeeds with no type errors. Confirm `/s/[slug]` route appears in the output.

- [ ] **Step 4: Commit**

```bash
git add src/app/s/\[slug\]/page.tsx
git commit -m "feat: rewrite story page as comic grid with ComicPanel"
```
