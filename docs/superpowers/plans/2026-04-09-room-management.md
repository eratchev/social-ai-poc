# Room Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room names, an enriched home page list with delete, and inline rename on the room workspace.

**Architecture:** One Prisma migration adds `name String?` to `Room`. A new `src/app/api/rooms/[code]/route.ts` handles PATCH (rename) and DELETE (cascade with Cloudinary cleanup). Two new client components — `RoomNameEditor` and `RoomList` — handle the interactive UI. The home page server component stays pure; it passes the query result down to the client `RoomList`.

**Tech Stack:** Next.js 16 App Router, Prisma, Cloudinary v2, Vitest + React Testing Library, TypeScript.

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `name String?` to `Room` |
| `prisma/migrations/…` | Migration for `name` column |
| `src/app/api/rooms/[code]/route.ts` | **New** — PATCH (rename) + DELETE (cascade delete) |
| `src/app/api/rooms/[code]/route.test.ts` | **New** — tests for both handlers |
| `src/components/RoomNameEditor.tsx` | **New** — `'use client'` inline rename component |
| `src/components/RoomNameEditor.test.tsx` | **New** — RTL tests for rename states |
| `src/components/RoomList.tsx` | **New** — `'use client'` room list with optimistic delete |
| `src/components/RoomList.test.tsx` | **New** — RTL tests for delete flow |
| `src/app/page.tsx` | Update query; replace list UI with `<RoomList>` |
| `src/app/u/[roomCode]/page.tsx` | Replace plain `<h1>` with `<RoomNameEditor>` |

---

## Task 1: Prisma migration — add `name` to Room

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration (auto-named by Prisma)

- [ ] **Step 1: Add `name String?` to the Room model**

Open `prisma/schema.prisma`. In the `Room` model, add `name String?` after `code`:

```prisma
model Room {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String?
  createdBy String
  creator   User     @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  photos  Photo[]
  stories Story[]

  @@index([createdBy])
  @@index([createdAt])
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
pnpm prisma migrate dev --name add_room_name
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate the Prisma client**

```bash
pnpm prisma generate
```

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```bash
pnpm vitest run
```

Expected: all existing tests pass (no new tests yet for this task).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add name field to Room model"
```

---

## Task 2: API routes — PATCH rename + DELETE cascade

**Files:**
- Create: `src/app/api/rooms/[code]/route.ts`
- Create: `src/app/api/rooms/[code]/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/rooms/[code]/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PATCH, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    photo: {
      findMany: vi.fn(),
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

function makeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

function makeRequest(method: string, body?: unknown) {
  return new Request(`http://localhost/api/rooms/ABC`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('PATCH /api/rooms/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when room not found', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const res = await PATCH(makeRequest('PATCH', { name: 'My Room' }), makeParams('ABC'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when name is missing', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', {}), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('returns 400 when name exceeds 80 chars', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', { name: 'x'.repeat(81) }), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('returns 400 when name is empty after trimming', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', { name: '   ' }), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('updates name and returns { code, name }', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);
    vi.mocked(prisma.room.update).mockResolvedValue({ code: 'ABC', name: 'My Room' } as any);

    const res = await PATCH(makeRequest('PATCH', { name: '  My Room  ' }), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe('ABC');
    expect(data.name).toBe('My Room');
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { code: 'ABC' },
      data: { name: 'My Room' },
      select: { code: true, name: true },
    });
  });
});

describe('DELETE /api/rooms/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.room.delete).mockResolvedValue({} as any);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as any);
  });

  it('returns 404 when room not found', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
    expect(prisma.room.delete).not.toHaveBeenCalled();
  });

  it('destroys Cloudinary assets and deletes room', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { publicId: 'social-ai-poc/img1' },
      { publicId: 'social-ai-poc/img2' },
      { publicId: null },
    ] as any);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/img1');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/img2');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2); // null publicId skipped
    expect(prisma.room.delete).toHaveBeenCalledWith({ where: { code: 'ABC' } });
  });

  it('still deletes room when Cloudinary destroy throws', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { publicId: 'social-ai-poc/img1' },
    ] as any);
    vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(new Error('Cloudinary error'));

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    expect(prisma.room.delete).toHaveBeenCalledWith({ where: { code: 'ABC' } });
  });

  it('returns { ok: true } when room has no photos', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run src/app/api/rooms/\[code\]/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `src/app/api/rooms/[code]/route.ts`:

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

type RouteContext = { params: Promise<{ code: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { code },
      select: { code: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : null;

    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }

    const updated = await prisma.room.update({
      where: { code },
      data: { name },
      select: { code: true, name: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/rooms/[code] error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { code } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { code },
      select: { code: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Fetch photos with publicId for Cloudinary cleanup
    const photos = await prisma.photo.findMany({
      where: { room: { code } },
      select: { publicId: true },
    });

    // Best-effort Cloudinary cleanup — don't abort on failure
    await Promise.all(
      photos
        .filter((p) => p.publicId)
        .map(async (p) => {
          try {
            await cloudinary.uploader.destroy(p.publicId!);
          } catch (err) {
            console.error('Cloudinary destroy failed for', p.publicId, err);
          }
        })
    );

    // DB cascade deletes all photos and stories
    await prisma.room.delete({ where: { code } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/rooms/[code] error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run src/app/api/rooms/\[code\]/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/rooms/\[code\]/
git commit -m "feat: add PATCH rename and DELETE cascade for rooms"
```

---

## Task 3: RoomNameEditor component

**Files:**
- Create: `src/components/RoomNameEditor.tsx`
- Create: `src/components/RoomNameEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/RoomNameEditor.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomNameEditor from './RoomNameEditor';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('RoomNameEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders room name in idle state', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
  });

  it('falls back to "Room ABC" when name is null', () => {
    render(<RoomNameEditor roomCode="ABC" initialName={null} />);
    expect(screen.getByText('Room ABC')).toBeInTheDocument();
  });

  it('clicking pencil button enters edit mode with input pre-filled', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('My Room');
  });

  it('input is empty when name is null and pencil is clicked', () => {
    render(<RoomNameEditor roomCode="ABC" initialName={null} />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('Escape key cancels and returns to idle with previous name', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Cancel button restores previous name', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Save button calls PATCH with trimmed name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC', name: 'New Name' }),
    } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/ABC', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });
  });

  it('Enter key saves the name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC', name: 'New Name' }),
    } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/ABC', expect.any(Object));
    });
  });

  it('input is disabled while saving', async () => {
    let resolveFetch!: (v: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    resolveFetch({ ok: true, json: async () => ({ code: 'ABC', name: 'New Name' }) });
  });

  it('restores previous name when PATCH fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('My Room')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run src/components/RoomNameEditor.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RoomNameEditor**

Create `src/components/RoomNameEditor.tsx`:

```typescript
'use client';

import { useState } from 'react';

type Props = {
  roomCode: string;
  initialName: string | null;
};

export default function RoomNameEditor({ roomCode, initialName }: Props) {
  const [name, setName] = useState<string | null>(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(name ?? '');
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name);
        setEditing(false);
      } else {
        // Restore on failure — silent, no toast (POC)
        setEditing(false);
      }
    } catch {
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  }

  const displayName = name ?? `Room ${roomCode}`;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold tracking-tight">{displayName}</span>
        <button
          onClick={startEditing}
          aria-label="Rename room"
          className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        maxLength={80}
        autoFocus
        className="text-2xl font-bold border-2 border-indigo-500 rounded-md px-2 py-0.5 outline-none w-64 disabled:opacity-50"
      />
      <button
        onClick={save}
        disabled={saving}
        aria-label={saving ? 'Saving…' : 'Save name'}
        className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={cancel}
        disabled={saving}
        aria-label="Cancel rename"
        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run src/components/RoomNameEditor.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/RoomNameEditor.tsx src/components/RoomNameEditor.test.tsx
git commit -m "feat: add RoomNameEditor inline rename component"
```

---

## Task 4: RoomList component + home page update

**Files:**
- Create: `src/components/RoomList.tsx`
- Create: `src/components/RoomList.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing tests for RoomList**

Create `src/components/RoomList.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomList from './RoomList';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

type Room = {
  code: string;
  name: string | null;
  createdAt: string;
  _count: { photos: number; stories: number };
};

const twoRooms: Room[] = [
  { code: 'R-ABC', name: 'Summer BBQ', createdAt: '2026-04-08T10:00:00.000Z', _count: { photos: 12, stories: 3 } },
  { code: 'R-XYZ', name: null, createdAt: '2026-04-07T10:00:00.000Z', _count: { photos: 4, stories: 1 } },
];

describe('RoomList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders room names', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('Summer BBQ')).toBeInTheDocument();
  });

  it('renders "Untitled room" for rooms without a name', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('Untitled room')).toBeInTheDocument();
  });

  it('renders room codes', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('R-ABC')).toBeInTheDocument();
    expect(screen.getByText('R-XYZ')).toBeInTheDocument();
  });

  it('renders photo and story counts', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText(/12 photos/i)).toBeInTheDocument();
    expect(screen.getByText(/3 stories/i)).toBeInTheDocument();
  });

  it('renders Open links for each room', () => {
    render(<RoomList rooms={twoRooms} />);
    const links = screen.getAllByRole('link', { name: /open/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/u/R-ABC');
    expect(links[1]).toHaveAttribute('href', '/u/R-XYZ');
  });

  it('renders a Delete button for each room', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getAllByRole('button', { name: /delete room/i })).toHaveLength(2);
  });

  it('shows window.confirm before deleting', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not call fetch when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('removes room optimistically on successful delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);

    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/R-ABC', { method: 'DELETE' });
    });

    await waitFor(() => {
      expect(screen.queryByText('Summer BBQ')).not.toBeInTheDocument();
    });
  });

  it('restores room row if delete API fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Summer BBQ')).toBeInTheDocument();
    });
  });

  it('renders empty state when rooms list is empty', () => {
    render(<RoomList rooms={[]} />);
    expect(screen.getByText(/no rooms yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run src/components/RoomList.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RoomList**

Create `src/components/RoomList.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';

type Room = {
  code: string;
  name: string | null;
  createdAt: string;
  _count: { photos: number; stories: number };
};

export default function RoomList({ rooms: initialRooms }: { rooms: Room[] }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  async function handleDelete(code: string) {
    const confirmed = window.confirm(`Delete room ${code}? This will remove all photos and stories.`);
    if (!confirmed) return;

    const index = rooms.findIndex((r) => r.code === code);
    const room = rooms[index];
    if (!room) return;

    // Optimistic remove
    setRooms((prev) => prev.filter((r) => r.code !== code));

    try {
      const res = await fetch(`/api/rooms/${code}`, { method: 'DELETE' });
      // 404 means already gone — treat as success
      if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    } catch {
      // Restore at original position
      setRooms((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, room);
        return next;
      });
    }
  }

  if (rooms.length === 0) {
    return <p className="muted">No rooms yet — create one above!</p>;
  }

  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li
          key={r.code}
          className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            {r.name ? (
              <div className="font-semibold text-gray-900">{r.name}</div>
            ) : (
              <div className="font-semibold text-gray-400 italic">Untitled room</div>
            )}
            <div className="text-xs text-gray-400 font-mono">{r.code}</div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-gray-500">{r._count.photos} photos</span>
              <span className="text-xs text-gray-500">{r._count.stories} stories</span>
              <span className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/u/${r.code}`}
              className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
            >
              Open
            </Link>
            <button
              onClick={() => handleDelete(r.code)}
              aria-label="Delete room"
              className="text-xs px-3 py-1.5 rounded-md bg-red-50 text-red-600 border border-red-200 font-medium hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run RoomList tests to confirm they pass**

```bash
pnpm vitest run src/components/RoomList.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Update the home page**

Replace the content of `src/app/page.tsx` with:

```typescript
// app/page.tsx
import { prisma } from '@/lib/prisma';
import RoomSwitcher from '@/components/RoomSwitcher';
import RoomList from '@/components/RoomList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const rawRooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      code: true,
      name: true,
      createdAt: true,
      _count: { select: { photos: true, stories: true } },
    },
  });

  // Serialize Date → string for the client component
  const rooms = rawRooms.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">Funny Photo Story</h1>
        <p className="muted">
          Start by opening an existing room or creating a new one. Each room is like a workspace for
          your photos and stories.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Choose a room</h2>
        <RoomSwitcher />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Your rooms</h2>
        <RoomList rooms={rooms} />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Run build to catch TypeScript errors**

```bash
pnpm build && git restore tsconfig.json
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/RoomList.tsx src/components/RoomList.test.tsx src/app/page.tsx
git commit -m "feat: add RoomList with optimistic delete and enrich home page"
```

---

## Task 5: Wire RoomNameEditor into room workspace

**Files:**
- Modify: `src/app/u/[roomCode]/page.tsx`

- [ ] **Step 1: Update the room workspace page**

In `src/app/u/[roomCode]/page.tsx`:

1. Add the import at the top (after the existing imports):
```typescript
import RoomNameEditor from '@/components/RoomNameEditor';
```

2. Update the query to include `name`:
```typescript
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
```

The query already uses `include` which will pull all scalar fields including `name` after the migration — no change needed there. But update the `select` in the `include` to make `name` explicit by using `findUnique` with a combined select+include approach. The simplest change: replace the `<h1>` in the header with `<RoomNameEditor>`.

3. Replace the header `<div>` block (the one containing `<h1>`) in the JSX:

Replace:
```tsx
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
```

With:
```tsx
<div>
  <RoomNameEditor roomCode={room.code} initialName={room.name} />
  <p className="muted">{room.photos.length} photo(s)</p>
  <div className="mt-2 flex gap-2">
    <HomeLink />
    <Link href={`/u/${room.code}`} className="btn btn-outline">↻ Refresh</Link>
  </div>
</div>
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass (no new tests — the room workspace page is a server component; RoomNameEditor already tested in Task 3).

- [ ] **Step 3: Run build to catch TypeScript errors**

```bash
pnpm build && git restore tsconfig.json
```

Expected: build succeeds. If Prisma complains about `room.name` not existing on the type, ensure `pnpm prisma generate` was run in Task 1.

- [ ] **Step 4: Commit**

```bash
git add src/app/u/\[roomCode\]/page.tsx
git commit -m "feat: replace static room heading with RoomNameEditor"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `name String?` field on Room | Task 1 |
| `PATCH /api/rooms/[code]` — trim, max 80, 404/400/200 | Task 2 |
| `DELETE /api/rooms/[code]` — Cloudinary best-effort, cascade, 404/200 | Task 2 |
| RoomNameEditor — idle/editing/saving states | Task 3 |
| RoomNameEditor — Enter saves, Escape cancels | Task 3 |
| RoomNameEditor — silent fail, restore on error | Task 3 |
| Home page enriched query (name, _count) | Task 4 |
| RoomList — name / "Untitled room" display | Task 4 |
| RoomList — code, stats, date | Task 4 |
| RoomList — Open link, Delete button | Task 4 |
| RoomList — window.confirm before delete | Task 4 |
| RoomList — optimistic removal + restore on failure | Task 4 |
| Room workspace — RoomNameEditor in header | Task 5 |

All spec requirements covered. No placeholders.
