# Comic Panel Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "✨ Generate comic art" button to the shared story page that transforms each panel's uploaded photo into a comic-style illustration using OpenAI's image API, stored in Cloudinary, swapped in progressively as each panel completes.

**Architecture:** A new `POST /api/story/[id]/panels/[index]/comicify` route handles one panel at a time — downloads the photo, calls `openai.images.edit()` with a comic-style prompt, uploads the result to Cloudinary, and patches `Story.panelMap`. The client loops over panels sequentially, updating the UI after each. `StoryViewer` is extracted from the shared story page as a `'use client'` component to hold panel state.

**Tech Stack:** Next.js 16 App Router, OpenAI Node SDK (`openai` — already installed), Cloudinary Node SDK (`cloudinary` — already installed), Prisma, Vitest + React Testing Library.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ai/comic-image.ts` | Create | Pure `buildComicPrompt(panel)` function — constructs OpenAI image prompt from panel narration/SFX |
| `src/lib/ai/comic-image.test.ts` | Create | Unit tests for prompt builder |
| `src/lib/ai/structured.ts` | Modify | Add `generatedImageUrl?: string` to `PanelBase` |
| `src/components/ComicPanel.tsx` | Modify | Add `generatedImageUrl` prop; prefer it over `photoUrl` |
| `src/components/ComicPanel.test.tsx` | Modify | Add one test for `generatedImageUrl` priority |
| `src/app/api/story/[id]/panels/[index]/comicify/route.ts` | Create | POST handler: photo → OpenAI → Cloudinary → DB patch |
| `src/app/api/story/[id]/panels/[index]/comicify/route.test.ts` | Create | Unit tests for the endpoint (7 scenarios) |
| `src/components/ComicifyButton.tsx` | Create | `'use client'` button that drives per-panel generation loop |
| `src/components/ComicifyButton.test.tsx` | Create | RTL tests for all button states and loop behavior |
| `src/components/StoryViewer.tsx` | Create | `'use client'` component extracted from page — holds panel state, renders grid + button |
| `src/app/s/[slug]/page.tsx` | Modify | Replace inline comic grid with `<StoryViewer>` |

---

## Task 1: `buildComicPrompt` in `src/lib/ai/comic-image.ts`

**Files:**
- Create: `src/lib/ai/comic-image.test.ts`
- Create: `src/lib/ai/comic-image.ts`

### Context

`Panel` is imported from `@/lib/ai/structured`. Its relevant fields:
```ts
type Panel = {
  index: number;
  narration?: string;
  sfx?: string[];
  // ... other fields
};
```

The function must never include the words "text", "speech bubbles", or "captions" in the output (they would confuse the image model into rendering literal text).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai/comic-image.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildComicPrompt } from './comic-image';
import type { Panel } from './structured';

const base: Panel = { index: 0 };

describe('buildComicPrompt', () => {
  it('returns a prompt containing the comic style keywords', () => {
    const prompt = buildComicPrompt(base);
    expect(prompt).toMatch(/comic book/i);
    expect(prompt).toMatch(/ink/i);
    expect(prompt).toMatch(/halftone/i);
  });

  it('includes the narration in the scene when present', () => {
    const panel: Panel = { index: 0, narration: 'The hero leaps across rooftops.' };
    const prompt = buildComicPrompt(panel);
    expect(prompt).toContain('The hero leaps across rooftops.');
  });

  it('falls back to a generic prompt when narration is absent', () => {
    const prompt = buildComicPrompt(base);
    expect(prompt).not.toMatch(/Scene:/);
    expect(prompt.length).toBeGreaterThan(20);
  });

  it('appends an SFX clause when sfx array is non-empty', () => {
    const panel: Panel = { index: 0, sfx: ['BOOM', 'CRASH'] };
    const prompt = buildComicPrompt(panel);
    expect(prompt).toContain('BOOM');
    expect(prompt).toContain('CRASH');
  });

  it('does not mention speech bubbles or text in the prompt', () => {
    const panel: Panel = { index: 0, narration: 'Drama unfolds.', sfx: ['ZAP'] };
    const prompt = buildComicPrompt(panel);
    expect(prompt).not.toMatch(/speech bubble/i);
    expect(prompt).not.toMatch(/\btext\b/i);
    expect(prompt).not.toMatch(/caption/i);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run src/lib/ai/comic-image.test.ts
```

Expected: all 5 tests fail with `Cannot find module './comic-image'`.

- [ ] **Step 3: Implement the prompt builder**

Create `src/lib/ai/comic-image.ts`:

```ts
import type { Panel } from './structured';

export function buildComicPrompt(panel: Panel): string {
  const base =
    'Comic book panel illustration with bold ink outlines, halftone shading, and vivid saturated colors.';

  const scene = panel.narration ? ` Scene: ${panel.narration}.` : '';

  const motion =
    panel.sfx?.length
      ? ` Energy and motion suggest: ${panel.sfx.join(', ')}.`
      : '';

  return `${base}${scene}${motion} No speech bubbles, no captions.`;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run src/lib/ai/comic-image.test.ts
```

Expected: 5 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/comic-image.ts src/lib/ai/comic-image.test.ts
git commit -m "feat: add buildComicPrompt for comic panel image generation"
```

---

## Task 2: Add `generatedImageUrl` to `PanelBase` + update `ComicPanel`

**Files:**
- Modify: `src/lib/ai/structured.ts`
- Modify: `src/components/ComicPanel.tsx`
- Modify: `src/components/ComicPanel.test.tsx`

### Context

`PanelBase` in `structured.ts` is the Zod object from which `Panel` is derived. Adding an optional field there propagates to the `Panel` TypeScript type used everywhere.

`ComicPanel` currently renders `photoUrl` as the image src. After this task it will prefer `generatedImageUrl` when present.

- [ ] **Step 1: Add the failing test to `ComicPanel.test.tsx`**

Add this test inside the existing `describe('ComicPanel', ...)` block at the end:

```tsx
it('renders generatedImageUrl instead of photoUrl when both are provided', () => {
  wrap(
    <ComicPanel
      index={0}
      photoUrl="https://example.com/original.jpg"
      generatedImageUrl="https://example.com/comic.png"
    />
  );
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/comic.png');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm vitest run src/components/ComicPanel.test.tsx
```

Expected: the new test fails (`generatedImageUrl` prop not recognized, image still shows `photoUrl`).

- [ ] **Step 3: Add `generatedImageUrl` to `PanelBase` in `structured.ts`**

In `src/lib/ai/structured.ts`, find `PanelBase` and add the new field:

```ts
const PanelBase = z.object({
  index: z.number().int().nonnegative(),
  photoId: z.string().min(1).optional(),
  narration: z.string().min(1).max(COMIC_LIMITS.narrationMax).optional(),
  sfx: z.array(z.string().min(1)).optional(),
  alt: z.string().min(1).max(160).optional(),
  generatedImageUrl: z.string().url().optional(),
});
```

- [ ] **Step 4: Update `ComicPanel.tsx` to accept and prefer `generatedImageUrl`**

In `src/components/ComicPanel.tsx`, update `ComicPanelProps` and the image rendering:

```tsx
export type ComicPanelProps = {
  index: number;
  narration?: string;
  bubbles?: Bubble[];
  sfx?: string[];
  photoUrl?: string | null;
  generatedImageUrl?: string | null;
  alt?: string;
};
```

Change the function signature:

```tsx
export default function ComicPanel({
  index,
  narration,
  bubbles,
  sfx,
  photoUrl,
  generatedImageUrl,
  alt,
}: ComicPanelProps) {
```

Change the image source — replace `photoUrl` with `generatedImageUrl ?? photoUrl` in both the conditional check and the `src` prop:

```tsx
{(generatedImageUrl ?? photoUrl) ? (
  <Image
    src={(generatedImageUrl ?? photoUrl)!}
    alt={alt ?? `Panel ${index + 1}`}
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
```

- [ ] **Step 5: Run all ComicPanel tests**

```bash
pnpm vitest run src/components/ComicPanel.test.tsx
```

Expected: 13 tests passing (12 existing + 1 new), 0 failing.

- [ ] **Step 6: Run the full test suite to catch any type regressions**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/structured.ts src/components/ComicPanel.tsx src/components/ComicPanel.test.tsx
git commit -m "feat: add generatedImageUrl to Panel schema and ComicPanel"
```

---

## Task 3: `POST /api/story/[id]/panels/[index]/comicify` route

**Files:**
- Create: `src/app/api/story/[id]/panels/[index]/comicify/route.test.ts`
- Create: `src/app/api/story/[id]/panels/[index]/comicify/route.ts`

### Context

**Prisma mock pattern** — follow the same structure as `src/app/api/photos/[id]/route.test.ts`:
```ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: { findUnique: vi.fn(), update: vi.fn() },
    photo: { findUnique: vi.fn() },
  },
}));
```

**OpenAI mock** — the route creates `const openai = new OpenAI(...)` at module level. Use `vi.hoisted` to share mock functions across the `vi.mock` factory and tests:
```ts
const { mockImagesEdit } = vi.hoisted(() => ({ mockImagesEdit: vi.fn() }));
vi.mock('openai', () => ({
  default: vi.fn().mockReturnValue({ images: { edit: mockImagesEdit } }),
}));
```

**Cloudinary mock** — same pattern:
```ts
const { mockUpload } = vi.hoisted(() => ({ mockUpload: vi.fn() }));
vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mockUpload } },
}));
```

**fetch mock** — for downloading the photo from Cloudinary:
```ts
const mockFetch = vi.fn();
global.fetch = mockFetch as any;
```

**Route params** — Next.js 16 dynamic params are a `Promise`:
```ts
function makeParams(id: string, index: string) {
  return { params: Promise.resolve({ id, index }) };
}
```

**Panel data** — the route looks up the panel by its `panel.index` field (logical index, not array position), using `panels.find(p => p.index === panelIndex)`.

**Cloudinary upload response** — `{ secure_url: 'https://res.cloudinary.com/...' }`.

**OpenAI response** — `{ data: [{ b64_json: 'base64string...' }] }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/story/[id]/panels/[index]/comicify/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';

const { mockImagesEdit } = vi.hoisted(() => ({ mockImagesEdit: vi.fn() }));
const { mockUpload } = vi.hoisted(() => ({ mockUpload: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: { findUnique: vi.fn(), update: vi.fn() },
    photo: { findUnique: vi.fn() },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn().mockReturnValue({ images: { edit: mockImagesEdit } }),
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mockUpload } },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeParams(id: string, index: string) {
  return { params: Promise.resolve({ id, index }) };
}

const readyStory = {
  status: 'READY',
  panelMap: [
    { index: 0, photoId: 'photo-1', narration: 'The hero leaps.' },
    { index: 1, photoId: 'photo-2', narration: 'Villain laughs.' },
  ],
};

describe('POST /api/story/[id]/panels/[index]/comicify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);
    mockFetch.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    } as any);
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'abc123' }] });
    mockUpload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/comic.png' });
  });

  it('returns 404 when story not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(null);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when story is not READY', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({
      ...readyStory,
      status: 'PROCESSING',
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('story_not_ready');
  });

  it('returns 404 when panel index does not exist', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '99'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when panel has no photoId', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({
      status: 'READY',
      panelMap: [{ index: 0, narration: 'No photo here.' }],
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('no_photo');
  });

  it('happy path: calls OpenAI, uploads to Cloudinary, patches DB, returns URL', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generatedImageUrl).toBe('https://res.cloudinary.com/test/comic.png');

    // OpenAI called with correct model
    expect(mockImagesEdit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-1' })
    );

    // Cloudinary called with base64 data URI
    expect(mockUpload).toHaveBeenCalledWith(
      'data:image/png;base64,abc123',
      expect.objectContaining({ folder: expect.any(String) })
    );

    // DB updated with generatedImageUrl
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          panelMap: expect.arrayContaining([
            expect.objectContaining({ index: 0, generatedImageUrl: 'https://res.cloudinary.com/test/comic.png' }),
          ]),
        }),
      })
    );
  });

  it('returns 500 when OpenAI throws (DB not updated)', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
    } as any);
    mockImagesEdit.mockRejectedValue(new Error('OpenAI error'));

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(500);
    expect(prisma.story.update).not.toHaveBeenCalled();
  });

  it('returns 500 when Cloudinary throws (DB not updated)', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
    } as any);
    mockUpload.mockRejectedValue(new Error('Cloudinary error'));

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(500);
    expect(prisma.story.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run "src/app/api/story/\[id\]/panels/\[index\]/comicify/route.test.ts"
```

Expected: all 7 tests fail with `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/story/[id]/panels/[index]/comicify/route.ts`:

```ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';
import type { Panel } from '@/lib/ai/structured';
import { buildComicPrompt } from '@/lib/ai/comic-image';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const { id: storyId, index: indexStr } = await params;
    const panelIndex = parseInt(indexStr, 10);

    if (isNaN(panelIndex)) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    // 1. Load story
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { status: true, panelMap: true },
    });

    if (!story) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (story.status !== 'READY') {
      return NextResponse.json({ error: 'story_not_ready' }, { status: 400 });
    }

    // 2. Find the panel by its logical index field
    const panels = (Array.isArray(story.panelMap) ? story.panelMap : []) as Panel[];
    const panel = panels.find((p) => p.index === panelIndex);

    if (!panel) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (!panel.photoId) {
      return NextResponse.json({ error: 'no_photo' }, { status: 400 });
    }

    // 3. Look up photo storageUrl
    const photo = await prisma.photo.findUnique({
      where: { id: panel.photoId },
      select: { storageUrl: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // 4. Fetch photo bytes
    const photoRes = await fetch(photo.storageUrl);
    const buffer = Buffer.from(await photoRes.arrayBuffer());
    const imageFile = new File([buffer], 'panel.jpg', { type: 'image/jpeg' });

    // 5. Generate comic illustration via OpenAI
    const result = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: buildComicPrompt(panel),
    });

    const b64json = result.data[0].b64_json!;

    // 6. Upload to Cloudinary as a data URI
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${b64json}`,
      { folder: process.env.CLOUDINARY_FOLDER ?? 'social-ai-poc' }
    );
    const generatedImageUrl = uploadResult.secure_url;

    // 7. Patch panelMap in DB
    const updatedPanelMap = panels.map((p) =>
      p.index === panelIndex ? { ...p, generatedImageUrl } : p
    );
    await prisma.story.update({
      where: { id: storyId },
      data: { panelMap: updatedPanelMap },
    });

    return NextResponse.json({ generatedImageUrl });
  } catch (err) {
    console.error('POST /api/story/[id]/panels/[index]/comicify error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run "src/app/api/story/\[id\]/panels/\[index\]/comicify/route.test.ts"
```

Expected: 7 tests passing, 0 failing.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/story/[id]/panels/[index]/comicify/route.ts" "src/app/api/story/[id]/panels/[index]/comicify/route.test.ts"
git commit -m "feat: add POST /api/story/[id]/panels/[index]/comicify endpoint"
```

---

## Task 4: `ComicifyButton` client component

**Files:**
- Create: `src/components/ComicifyButton.test.tsx`
- Create: `src/components/ComicifyButton.tsx`

### Context

`ComicifyButton` is a `'use client'` React component. It receives:
- `storyId: string` — used to build the API URL
- `panels: Panel[]` — determines which panels have photos and whether any still need generation
- `onPanelDone: (index: number, url: string) => void` — called by the parent to update panel state after each success

It renders `null` when there's nothing to generate (no panels with photos, or all panels-with-photos already have `generatedImageUrl`).

**Test note on fetch:** Mock `global.fetch` before rendering. The mock must return `{ ok: true, json: async () => ({ generatedImageUrl: '...' }) }` for success cases. For failure cases: `{ ok: false, status: 500 }`.

**Test note on async:** Use `waitFor` from `@testing-library/react` to wait for state updates after async fetch calls resolve.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ComicifyButton.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ComicifyButton from './ComicifyButton';
import type { Panel } from '@/lib/ai/structured';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const panelsWithPhotos: Panel[] = [
  { index: 0, photoId: 'p1', narration: 'Scene one.' },
  { index: 1, photoId: 'p2', narration: 'Scene two.' },
];

const panelsNoPhotos: Panel[] = [
  { index: 0, narration: 'No photo.' },
];

const panelsAlreadyDone: Panel[] = [
  { index: 0, photoId: 'p1', generatedImageUrl: 'https://cdn.example.com/comic1.png' },
];

describe('ComicifyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the generate button when panels have photos', () => {
    const onPanelDone = vi.fn();
    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );
    expect(screen.getByRole('button', { name: /generate comic art/i })).toBeInTheDocument();
  });

  it('renders null when no panels have a photoId', () => {
    const onPanelDone = vi.fn();
    const { container } = render(
      <ComicifyButton storyId="s1" panels={panelsNoPhotos} onPanelDone={onPanelDone} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when all panels-with-photos already have generatedImageUrl', () => {
    const onPanelDone = vi.fn();
    const { container } = render(
      <ComicifyButton storyId="s1" panels={panelsAlreadyDone} onPanelDone={onPanelDone} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls fetch for each panel with a photo in order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/story/s1/panels/0/comicify',
      { method: 'POST' }
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/story/s1/panels/1/comicify',
      { method: 'POST' }
    );
  });

  it('calls onPanelDone for each successful panel', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(onPanelDone).toHaveBeenCalledTimes(2));
    expect(onPanelDone).toHaveBeenCalledWith(0, 'https://cdn.example.com/comic.png');
    expect(onPanelDone).toHaveBeenCalledWith(1, 'https://cdn.example.com/comic.png');
  });

  it('skips failed panels silently and continues the loop', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
      } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    // only panel 1 succeeded
    expect(onPanelDone).toHaveBeenCalledTimes(1);
    expect(onPanelDone).toHaveBeenCalledWith(1, 'https://cdn.example.com/comic.png');
  });

  it('disables the button and shows progress while generating', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise((res) => { resolveFirst = res; });

    mockFetch
      .mockReturnValueOnce(firstPending)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
      } as any);

    const onPanelDone = vi.fn();
    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    // While first panel is pending, button should be disabled and show progress
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn.textContent).toMatch(/generating/i);
    });

    // Resolve and finish
    resolveFirst({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    });

    await waitFor(() => expect(onPanelDone).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run src/components/ComicifyButton.test.tsx
```

Expected: all tests fail with `Cannot find module './ComicifyButton'`.

- [ ] **Step 3: Implement `ComicifyButton`**

Create `src/components/ComicifyButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Panel } from '@/lib/ai/structured';

type ComicifyButtonProps = {
  storyId: string;
  panels: Panel[];
  onPanelDone: (index: number, url: string) => void;
};

export default function ComicifyButton({ storyId, panels, onPanelDone }: ComicifyButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const panelsWithPhotos = panels.filter((p) => p.photoId);
  const allAlreadyDone = panelsWithPhotos.length > 0 && panelsWithPhotos.every((p) => p.generatedImageUrl);

  if (panelsWithPhotos.length === 0 || allAlreadyDone) return null;

  if (done) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 cursor-default"
      >
        ✓ Comic art ready
      </button>
    );
  }

  async function handleComicify() {
    setGenerating(true);
    setProgress(0);

    for (const panel of panelsWithPhotos) {
      setProgress(panel.index + 1);
      try {
        const res = await fetch(
          `/api/story/${storyId}/panels/${panel.index}/comicify`,
          { method: 'POST' }
        );
        if (!res.ok) continue;
        const { generatedImageUrl } = await res.json();
        onPanelDone(panel.index, generatedImageUrl);
      } catch {
        // skip failed panels silently
      }
    }

    setGenerating(false);
    setDone(true);
  }

  return (
    <button
      onClick={handleComicify}
      disabled={generating}
      className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {generating
        ? `Generating panel ${progress} / ${panelsWithPhotos.length}…`
        : '✨ Generate comic art'}
    </button>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run src/components/ComicifyButton.test.tsx
```

Expected: 7 tests passing, 0 failing.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ComicifyButton.tsx src/components/ComicifyButton.test.tsx
git commit -m "feat: add ComicifyButton client component with per-panel generation loop"
```

---

## Task 5: Extract `StoryViewer` + wire into `/s/[slug]/page.tsx`

**Files:**
- Create: `src/components/StoryViewer.tsx`
- Modify: `src/app/s/[slug]/page.tsx`

### Context

The current `/s/[slug]/page.tsx` renders the comic grid inline as a server component. After this task it renders a `'use client'` `StoryViewer` that holds panel state (so `onPanelDone` can update individual panels without a full page reload).

**Props passed to `StoryViewer`:**
- `storyId: string`
- `initialPanels: Panel[]` — may include `generatedImageUrl` for previously comicified panels
- `photoUrlById: Record<string, string>` — maps `photoId → Cloudinary URL` (plain object, not Map, because client component props must be serializable)

**Server page structure after refactor:**
```tsx
<main>
  <header>...</header>
  <StoryViewer storyId={story.id} initialPanels={panels} photoUrlById={photoUrlByIdObj} />
  <details>...</details>  {/* narrative — stays server */}
  <StoryMetaCard shareSlug={slug} />
</main>
```

`StoryViewer` renders the comic grid section and `ComicifyButton`.

No test file is created for `StoryViewer` — its behaviour is covered by the existing `ComicPanel` tests and `ComicifyButton` tests. The integration (wiring) is verified by `pnpm build`.

- [ ] **Step 1: Create `StoryViewer.tsx`**

Create `src/components/StoryViewer.tsx`:

```tsx
'use client';

import { useState } from 'react';
import ComicPanel from './ComicPanel';
import ComicifyButton from './ComicifyButton';
import type { Panel } from '@/lib/ai/structured';

type StoryViewerProps = {
  storyId: string;
  initialPanels: Panel[];
  photoUrlById: Record<string, string>;
};

export default function StoryViewer({ storyId, initialPanels, photoUrlById }: StoryViewerProps) {
  const [panels, setPanels] = useState<Panel[]>(initialPanels);

  function handlePanelDone(index: number, url: string) {
    setPanels((prev) => prev.map((p) => (p.index === index ? { ...p, generatedImageUrl: url } : p)));
  }

  return (
    <>
      <section className="border-2 border-black dark:border-zinc-700">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-black dark:bg-zinc-700">
          {panels.map((p) => (
            <ComicPanel
              key={p.index}
              index={p.index}
              narration={p.narration}
              bubbles={p.bubbles}
              sfx={p.sfx}
              photoUrl={p.photoId ? (photoUrlById[p.photoId] ?? null) : null}
              generatedImageUrl={p.generatedImageUrl ?? null}
              alt={p.alt}
            />
          ))}
        </ul>
      </section>

      <div className="flex justify-center mt-4">
        <ComicifyButton
          storyId={storyId}
          panels={panels}
          onPanelDone={handlePanelDone}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update `/s/[slug]/page.tsx`**

Replace the full contents of `src/app/s/[slug]/page.tsx` with:

```tsx
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
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Run the TypeScript build**

```bash
pnpm build 2>&1
```

Expected: clean build with no type errors.

**CRITICAL:** After the build completes, check if `tsconfig.json` was changed:
```bash
git diff tsconfig.json
```
If `"jsx"` was changed from `"preserve"` to anything else, restore it immediately:
```bash
git restore tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add src/components/StoryViewer.tsx src/app/s/[slug]/page.tsx
git commit -m "feat: wire StoryViewer and ComicifyButton into shared story page"
```

---

## Final verification

After all 5 tasks are committed, run the full suite one more time and verify the build:

```bash
pnpm vitest run && pnpm build 2>&1 | tail -10
```

Expected: all tests pass, clean build. Remember to `git restore tsconfig.json` if the build modifies it.
