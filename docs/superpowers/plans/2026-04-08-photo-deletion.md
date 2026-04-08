# Photo Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete photos from a room gallery via a hover ✕ button that removes the photo optimistically and deletes it from both the database and Cloudinary.

**Architecture:** A new `DELETE /api/photos/[id]` route handles server-side deletion (Cloudinary via SDK + Prisma). `GalleryLive.tsx` gets a `handleDelete` function and per-tile ✕ buttons; removal is optimistic (photo disappears immediately) with restore-on-failure logic.

**Tech Stack:** Next.js 16 App Router, Prisma, Cloudinary Node SDK (`cloudinary` — already installed), Vitest + React Testing Library.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/photos/[id]/route.ts` | Create | `DELETE` handler — looks up photo, calls Cloudinary destroy, deletes DB record |
| `src/app/api/photos/[id]/route.test.ts` | Create | Unit tests for the delete endpoint |
| `src/components/GalleryLive.tsx` | Modify | Add `deletingIds` + `errorId` state, `handleDelete`, hover ✕ button on each tile |
| `src/components/GalleryLive.test.tsx` | Create | Component tests for delete interaction |

---

## Task 1: DELETE /api/photos/[id] endpoint (TDD)

**Files:**
- Create: `src/app/api/photos/[id]/route.test.ts`
- Create: `src/app/api/photos/[id]/route.ts`

### Context

- `cloudinary` is already a project dependency (used by `/api/sign/route.ts`)
- `prisma` is mocked in tests using `vi.mock('@/lib/prisma', ...)` — follow the exact pattern from `src/app/api/story/[id]/route.test.ts`
- `cloudinary` is mocked with `vi.mock('cloudinary', ...)`
- Dynamic route params in Next.js 16 are `Promise<{ id: string }>` — use `await params` to extract
- Cloudinary deletion is best-effort: if it fails, log the error and still delete the DB record

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/photos/[id]/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      destroy: vi.fn(),
    },
  },
}));

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/photos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.photo.delete).mockResolvedValue({} as any);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as any);
  });

  it('returns 404 when photo not found', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null);

    const res = await DELETE(new Request('http://localhost'), makeParams('nonexistent'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
    expect(prisma.photo.delete).not.toHaveBeenCalled();
  });

  it('deletes from Cloudinary and DB when photo has publicId', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: 'social-ai-poc/ABC/img123',
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/ABC/img123');
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });

  it('still deletes DB record when Cloudinary destroy throws', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: 'social-ai-poc/ABC/img123',
    } as any);
    vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(new Error('Cloudinary error'));

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });

  it('skips Cloudinary call when publicId is null', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: null,
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run src/app/api/photos/\\[id\\]/route.test.ts
```

Expected: All 4 tests fail with `Cannot find module './route'`.

- [ ] **Step 3: Implement the DELETE route**

Create `src/app/api/photos/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { id: true, publicId: true },
  });

  if (!photo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (photo.publicId) {
    try {
      await cloudinary.uploader.destroy(photo.publicId);
    } catch (err) {
      console.error('Cloudinary destroy failed for', photo.publicId, err);
    }
  }

  await prisma.photo.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run src/app/api/photos/\\[id\\]/route.test.ts
```

Expected: 4 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/photos/\[id\]/route.ts src/app/api/photos/\[id\]/route.test.ts
git commit -m "feat: add DELETE /api/photos/[id] with Cloudinary and DB cleanup"
```

---

## Task 2: GalleryLive delete UI (TDD)

**Files:**
- Create: `src/components/GalleryLive.test.tsx`
- Modify: `src/components/GalleryLive.tsx`

### Context

The current `GalleryLive.tsx` renders photos in a masonry `<ul>`. Each photo tile is a `<li>` with a link. We're adding a ✕ button to each tile.

**Key design decisions:**
- The ✕ button is always in the DOM (not conditionally rendered) but visually hidden via `opacity-0 group-hover:opacity-100`. This makes it accessible to keyboard users and findable in tests without simulating hover.
- Delete is **optimistic**: the photo is removed from state immediately, then the API call fires. On failure the photo is restored to its original index.
- `deletingIds: Set<string>` tracks in-flight deletes to prevent double-submission.
- `errorId: string | null` tracks which photo had a failed delete, for a 2-second red-ring error flash.
- The ✕ button has `aria-label="Delete photo"` for accessibility.

**About tests and fetch:** The `GalleryLive` component sets up window event listeners (`focus`, `photos:added`) that call `fetchPhotos`, which uses `fetch`. In tests, mock `fetch` globally before rendering — the event listeners won't fire automatically in jsdom so only the explicit delete calls will trigger fetch.

- [ ] **Step 1: Write the failing tests**

Create `src/components/GalleryLive.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GalleryLive from './GalleryLive';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

type Photo = { id: string; storageUrl: string; width: number | null; height: number | null; publicId: string | null };

const twoPhotos: Photo[] = [
  { id: 'p1', storageUrl: 'https://res.cloudinary.com/test/image/upload/v1/img1.jpg', width: 800, height: 600, publicId: 'img1' },
  { id: 'p2', storageUrl: 'https://res.cloudinary.com/test/image/upload/v1/img2.jpg', width: 800, height: 600, publicId: 'img2' },
];

describe('GalleryLive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all photos from initial prop', () => {
    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);
    expect(screen.getAllByRole('img').length).toBe(2);
  });

  it('shows a delete button for each photo', () => {
    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);
    const btns = screen.getAllByRole('button', { name: /delete photo/i });
    expect(btns.length).toBe(2);
  });

  it('removes photo optimistically when delete button is clicked', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/photos/p1', { method: 'DELETE' });
  });

  it('restores photo when delete API returns non-404 error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(2);
    });
  });

  it('treats 404 response as success (photo already gone)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(1);
    });
  });

  it('renders empty state when no photos', () => {
    render(<GalleryLive roomCode="ABC" initial={[]} />);
    expect(screen.getByText(/no images yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete photo/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm vitest run src/components/GalleryLive.test.tsx
```

Expected: "shows a delete button for each photo" and subsequent tests fail (no delete buttons exist yet). "renders all photos" and "renders empty state" may pass.

- [ ] **Step 3: Implement the delete UI in GalleryLive**

Replace the full contents of `src/components/GalleryLive.tsx` with:

```tsx
'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type Photo = { id: string; storageUrl: string; width: number | null; height: number | null; publicId: string | null };

function fallbackWH(w: number | null, h: number | null) {
  return { w: w && w > 0 ? w : 1200, h: h && h > 0 ? h : 900 };
}

function thumb(url: string, w = 800) {
  try {
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    return `${parts[0]}/upload/c_fill,q_auto,f_auto,w_${w}/${parts[1]}`;
  } catch {
    return url;
  }
}

export default function GalleryLive({ roomCode, initial }: { roomCode: string; initial: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [errorId, setErrorId] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomCode}/photos`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setPhotos(json.photos || []);
  }, [roomCode]);

  useEffect(() => {
    const onFocus = () => fetchPhotos();
    const onAdded = () => fetchPhotos();
    window.addEventListener('focus', onFocus);
    window.addEventListener('photos:added', onAdded as EventListener);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('photos:added', onAdded as EventListener);
    };
  }, [fetchPhotos]);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingIds.has(id)) return;

    const photoIndex = photos.findIndex(p => p.id === id);
    const photo = photos[photoIndex];
    if (!photo) return;

    // Optimistic remove
    setPhotos(prev => prev.filter(p => p.id !== id));
    setDeletingIds(prev => new Set([...prev, id]));

    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      // 404 means already gone — treat as success
      if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    } catch {
      // Restore photo at its original position
      setPhotos(prev => {
        const next = [...prev];
        next.splice(Math.min(photoIndex, next.length), 0, photo);
        return next;
      });
      setErrorId(id);
      setTimeout(() => setErrorId(null), 2000);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [deletingIds, photos]);

  const count = photos.length;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Gallery</h2>
        <span className="muted">
          {count} item{count === 1 ? '' : 's'}
        </span>
      </div>

      {count === 0 ? (
        <p className="muted">No images yet — upload some below!</p>
      ) : (
        <ul className="columns-2 md:columns-3 gap-4 [column-fill:_balance]">
          {photos.map((p, i) => {
            const { w, h } = fallbackWH(p.width, p.height);
            const src = thumb(p.storageUrl, 800);
            const isDeleting = deletingIds.has(p.id);
            const hasError = errorId === p.id;
            return (
              <li
                key={p.id}
                className={[
                  'mb-4 break-inside-avoid rounded-xl border bg-white overflow-hidden relative group',
                  hasError ? 'ring-2 ring-red-500' : '',
                ].join(' ')}
                title={p.publicId || p.id}
              >
                <a href={p.storageUrl} target="_blank" rel="noreferrer" className="block">
                  <Image
                    src={src}
                    alt={p.publicId || p.id}
                    width={w}
                    height={h}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="w-full h-auto object-cover"
                    priority={i < 6}
                  />
                </a>
                <button
                  aria-label="Delete photo"
                  onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}
                  disabled={isDeleting}
                  className={[
                    'absolute top-1.5 right-1.5 z-10 w-6 h-6 flex items-center justify-center',
                    'rounded-full bg-black/70 hover:bg-black text-white',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  {isDeleting ? (
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
pnpm vitest run src/components/GalleryLive.test.tsx
```

Expected: 6 tests passing, 0 failing.

- [ ] **Step 5: Run the full test suite**

```bash
pnpm vitest run
```

Expected: All tests pass (242 existing + 4 API tests + 6 component tests = 252 total).

- [ ] **Step 6: Run the TypeScript build**

```bash
pnpm build
```

Expected: Clean build, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/GalleryLive.tsx src/components/GalleryLive.test.tsx
git commit -m "feat: add optimistic photo deletion with hover delete button"
```
