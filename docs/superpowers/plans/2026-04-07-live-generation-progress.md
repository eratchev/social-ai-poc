# Live Generation Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real-time step-by-step progress (Beats → Panels → Narrative) while a story is being generated, instead of a plain spinner.

**Architecture:** Split `POST /api/story` into a fast init call (creates DB row, returns `{id}`) and a new `POST /api/story/[id]/run` call (runs the AI pipeline, updating a `phase` column between steps). The client fires both in parallel, polls `GET /api/story/[id]` every 1.5s to read phase updates, and renders a three-step checklist that ticks off as each phase completes.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Vitest, React Testing Library

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `phase String?` to `Story` model |
| `src/app/api/story/route.ts` | Rewrite: init only (no AI), returns `{ id }` |
| `src/app/api/story/route.test.ts` | Rewrite tests for init-only behavior |
| `src/app/api/story/[id]/run/route.ts` | **New** — full AI pipeline, phase updates |
| `src/app/api/story/[id]/run/route.test.ts` | **New** — tests for run route |
| `src/app/api/story/[id]/route.ts` | Add `phase` to response |
| `src/app/api/story/[id]/route.test.ts` | Add phase assertion |
| `src/components/GenerateStoryButton.tsx` | Two-call parallel flow + progress UI |
| `src/components/GenerateStoryButton.test.tsx` | **New** — component tests |

---

## Task 1: Add `phase` field to Story schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `phase` field to Story model**

In `prisma/schema.prisma`, inside the `Story` model, add after the `status` line:

```prisma
phase     String?   // "beats" | "panels" | "narrative" | null
```

The Story model block should look like:

```prisma
model Story {
  id      String @id @default(cuid())
  roomId  String
  ownerId String

  title       String
  narrative   String
  beatsJson   Json    @default("[]")
  panelMap    Json    @default("[]")
  status      String  @default("PENDING")
  phase       String?
  shareSlug   String? @unique
  model       String?
  prompt      String?
  error       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  room  Room  @relation(fields: [roomId], references: [id])
  owner User  @relation(fields: [ownerId], references: [id])
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
pnpm prisma migrate dev --name add_phase_to_story
```

Expected output includes: `✔  Generated Prisma Client` and a new migration file in `prisma/migrations/`.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
pnpm prisma generate
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add phase field to Story for generation progress tracking"
```

---

## Task 2: Rewrite `POST /api/story` as fast init endpoint

**Files:**
- Modify: `src/app/api/story/route.ts`
- Modify: `src/app/api/story/route.test.ts`

The existing tests cover the full pipeline (beats, panels, narrative). After this task, `POST /api/story` only creates the Story row and returns `{ id }` — no AI calls. Tests must be rewritten to match.

- [ ] **Step 1: Write failing tests for the new init-only behavior**

Replace the entire contents of `src/app/api/story/route.test.ts` with:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { resolveDefaultProvider } from '@/lib/ai/providers';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: vi.fn() },
    room: { findUnique: vi.fn(), create: vi.fn() },
    photo: { findMany: vi.fn() },
    story: { create: vi.fn() },
  },
}));

vi.mock('@/lib/ai/providers', () => ({
  resolveDefaultProvider: vi.fn(),
}));

describe('/api/story (init)', () => {
  const mockUser = { id: 'user1' };
  const mockRoom = { id: 'room1' };
  const mockPhotos = [
    { id: 'photo1', storageUrl: 'http://example.com/1.jpg' },
    { id: 'photo2', storageUrl: 'http://example.com/2.jpg' },
  ];
  const mockStory = { id: 'story1' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDefaultProvider).mockReturnValue('mock');
  });

  it('should return { id } without running AI', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('story1');
    // init does not return status or model — those come from /run
    expect(data.status).toBeUndefined();
  });

  it('should create story with PROCESSING status and serialized params', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
        quality: 'fast',
        style: 'quirky',
        tone: 'snarky',
        comicAudience: 'adults',
      }),
    });

    await POST(request);

    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PROCESSING',
          prompt: expect.stringContaining('"quality":"fast"'),
        }),
      })
    );
  });

  it('should create room if it does not exist', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'NEWROOM', ownerHandle: 'testuser' }),
    });

    await POST(request);

    expect(prisma.room.create).toHaveBeenCalledWith({
      data: { code: 'NEWROOM', createdBy: 'user1' },
      select: { id: true },
    });
  });

  it('should return 400 when room has no photos', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('no_photos_in_room');
  });

  it('should return 500 on invalid request body', async () => {
    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('should return 500 when user upsert fails', async () => {
    vi.mocked(prisma.user.upsert).mockRejectedValue(new Error('DB error'));

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm vitest run src/app/api/story/route.test.ts
```

Expected: several tests fail (current route still returns `status: 'READY'` etc.)

- [ ] **Step 3: Rewrite `src/app/api/story/route.ts`**

Replace the entire file with:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveDefaultProvider, type ProviderKind } from "@/lib/ai/providers";

export const runtime = "nodejs";

const Body = z.object({
  roomCode: z.string().min(1),
  ownerHandle: z.string().min(1).default("devuser"),
  audience: z.string().optional(),
  style: z.string().optional(),
  tone: z.string().optional(),
  comicAudience: z.enum(["kids", "adults"]).default("kids"),
  quality: z.enum(["fast", "balanced", "premium"]).default("balanced"),
  provider: z.enum(["openai", "anthropic", "mock"]).optional(),
  panelCount: z.number().int().min(1).max(24).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const input = Body.parse(json);

    // 1) Ensure User
    const user = await prisma.user.upsert({
      where: { handle: input.ownerHandle },
      update: {},
      create: { handle: input.ownerHandle, displayName: input.ownerHandle },
      select: { id: true },
    });

    // 2) Ensure Room
    const code = input.roomCode.toUpperCase();
    let room = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!room) {
      room = await prisma.room.create({
        data: { code, createdBy: user.id },
        select: { id: true },
      });
    }

    // 3) Check photos exist and compute panelCount heuristic
    const photos = await prisma.photo.findMany({
      where: { roomId: room.id },
      select: { id: true },
      take: 12,
    });
    if (photos.length === 0) {
      return NextResponse.json({ error: "no_photos_in_room" }, { status: 400 });
    }

    // 4) Resolve provider and prompt knobs
    const chosen: ProviderKind =
      (input.provider as ProviderKind | undefined) ?? resolveDefaultProvider();
    const promptAudience =
      input.audience ?? (input.comicAudience === "kids" ? "kids-10-12" : "adults");
    const promptStyle = input.style ?? "funny";
    const promptTone =
      input.tone ?? (input.comicAudience === "kids" ? "wholesome" : "witty");
    const panelCount =
      input.panelCount ?? Math.min(6, Math.max(4, photos.length));

    // 5) Create Story row in PROCESSING; store params so /run can read them
    const created = await prisma.story.create({
      data: {
        roomId: room.id,
        ownerId: user.id,
        title: "Generating…",
        narrative: "",
        beatsJson: [],
        panelMap: [],
        status: "PROCESSING",
        phase: null,
        prompt: JSON.stringify({
          provider: chosen,
          quality: input.quality,
          comicAudience: input.comicAudience,
          audience: promptAudience,
          tone: promptTone,
          style: promptStyle,
          panelCount,
        }),
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err ?? "unknown_error");
    console.error("POST /api/story error", errMsg);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm vitest run src/app/api/story/route.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/story/route.ts src/app/api/story/route.test.ts
git commit -m "feat: slim POST /api/story to init-only (returns {id} immediately)"
```

---

## Task 3: Create `POST /api/story/[id]/run` with the AI pipeline

**Files:**
- Create: `src/app/api/story/[id]/run/route.ts`
- Create: `src/app/api/story/[id]/run/route.test.ts`

This route contains all the AI generation logic that was removed from `POST /api/story`. It updates the `phase` column before each AI step.

- [ ] **Step 1: Create the test file**

Create `src/app/api/story/[id]/run/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getStoryProvider, resolveDefaultProvider } from '@/lib/ai/providers';
import { captionPhotosOpenAI } from '@/lib/ai/captions-openai';
import { getModelForQuality } from '@/lib/ai/config';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: { findUnique: vi.fn(), update: vi.fn() },
    photo: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/ai/providers', () => ({
  getStoryProvider: vi.fn(),
  resolveDefaultProvider: vi.fn(),
}));

vi.mock('@/lib/ai/captions-openai', () => ({
  captionPhotosOpenAI: vi.fn(),
}));

vi.mock('@/lib/ai/config', () => ({
  getModelForQuality: vi.fn(),
}));

describe('POST /api/story/[id]/run', () => {
  const mockProvider = {
    genBeats: vi.fn(),
    genPanels: vi.fn(),
    genNarrative: vi.fn(),
  };

  const mockPrompt = JSON.stringify({
    provider: 'mock',
    quality: 'balanced',
    comicAudience: 'kids',
    audience: 'kids-10-12',
    tone: 'wholesome',
    style: 'funny',
    panelCount: 4,
  });

  const mockStory = { id: 'story1', roomId: 'room1', prompt: mockPrompt, status: 'PROCESSING' };
  const mockPhotos = [
    { id: 'photo1', storageUrl: 'http://example.com/1.jpg' },
    { id: 'photo2', storageUrl: 'http://example.com/2.jpg' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDefaultProvider).mockReturnValue('mock');
    vi.mocked(getStoryProvider).mockReturnValue(mockProvider as any);
    vi.mocked(getModelForQuality).mockReturnValue('mock-model');
  });

  it('should run pipeline and return READY with model and settings', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([{ index: 0, type: 'setup', summary: 'Test' }]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([{ index: 0, photoId: 'photo1' }]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test Story', narrative: 'Test narrative' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('READY');
    expect(data.model).toBe('mock-model');
    expect(data.settings).toBeDefined();
  });

  it('should update phase to beats → panels → narrative in order', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    expect(updateCalls[0][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'beats' } });
    expect(updateCalls[1][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'panels' } });
    expect(updateCalls[2][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'narrative' } });
  });

  it('should mark story READY with phase null on success', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const readyCall = updateCalls.find(c => c[0].data.status === 'READY');
    expect(readyCall).toBeDefined();
    expect(readyCall![0].data.phase).toBeNull();
  });

  it('should mark story ERROR with phase null on generation failure', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockRejectedValue(new Error('AI failed'));
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const errorCall = updateCalls.find(c => c[0].data.status === 'ERROR');
    expect(errorCall).toBeDefined();
    expect(errorCall![0]).toMatchObject({
      where: { id: 'story1' },
      data: { status: 'ERROR', phase: null, error: expect.stringContaining('AI failed') },
    });
  });

  it('should return 404 when story not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost/api/story/nonexistent/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should return 400 when story has no prompt', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({ ...mockStory, prompt: null } as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle caption failure gracefully and still succeed', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockRejectedValue(new Error('Caption failed'));
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('READY');
  });

  it('should use "Untitled Comic" when genNarrative returns no title', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({} as any);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const readyCall = updateCalls.find(c => c[0].data.status === 'READY');
    expect(readyCall![0].data.title).toBe('Untitled Comic');
    expect(readyCall![0].data.narrative).toBe('');
  });
});
```

- [ ] **Step 2: Run tests — expect import error (file doesn't exist yet)**

```bash
pnpm vitest run src/app/api/story/[id]/run/route.test.ts
```

Expected: error — `Cannot find module './route'`

- [ ] **Step 3: Create `src/app/api/story/[id]/run/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getStoryProvider,
  resolveDefaultProvider,
  type ProviderKind,
  type TitleNarrative,
} from "@/lib/ai/providers";
import { captionPhotosOpenAI } from "@/lib/ai/captions-openai";
import { getModelForQuality } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

function getIdFromUrl(url: string): string | undefined {
  const match = new URL(url).pathname.match(/\/api\/story\/([^/]+)\/run$/);
  return match?.[1];
}

async function withTimeout<T>(p: Promise<T>, ms = 45_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)
    ),
  ]);
}

export async function POST(req: Request) {
  const started = Date.now();
  let storyId: string | null = null;

  try {
    const id = getIdFromUrl(req.url);
    if (!id) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Fetch story
    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true, roomId: true, prompt: true, status: true },
    });
    if (!story) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (!story.prompt) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    storyId = story.id;

    // Parse params stored by init endpoint
    let params: {
      provider: ProviderKind;
      quality: "fast" | "balanced" | "premium";
      comicAudience: "kids" | "adults";
      audience: string;
      tone: string;
      style: string;
      panelCount: number;
    };
    try {
      params = JSON.parse(story.prompt);
    } catch {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Fetch photos for this room
    const photos = await prisma.photo.findMany({
      where: { roomId: story.roomId },
      orderBy: { createdAt: "asc" },
      select: { id: true, storageUrl: true },
      take: 12,
    });
    if (photos.length === 0) {
      return new Response(JSON.stringify({ error: "no_photos_in_room" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Resolve provider
    const chosen: ProviderKind = params.provider ?? resolveDefaultProvider();
    const provider = getStoryProvider(chosen);

    // Prepare photo args
    let photoArgs = photos.map((p) => ({
      id: p.id,
      url: p.storageUrl,
      caption: undefined as string | undefined,
    }));

    // Caption pass (best-effort, non-fatal)
    try {
      const caps = await captionPhotosOpenAI(
        photos.map((p) => ({ id: p.id, url: p.storageUrl }))
      );
      const byId = new Map(caps.map((c) => [c.id, c]));
      photoArgs = photoArgs.map((p) => {
        const hit = byId.get(p.id);
        return hit?.caption ? { ...p, caption: hit.caption } : p;
      });
      await prisma.$transaction(
        caps
          .filter((c) => c.caption)
          .map((c) =>
            prisma.photo.update({ where: { id: c.id }, data: { caption: c.caption } })
          )
      );
    } catch (e) {
      console.warn("[captions] skipping due to error:", (e as Error)?.message || e);
    }

    // AI pipeline with phase updates between steps
    const { beats, panels, title, narrative } = await withTimeout(
      (async () => {
        // Phase 1: beats
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "beats" } });
        const beats = await provider.genBeats({
          photos: photoArgs,
          audience: params.audience,
          style: params.style,
          tone: params.tone,
          comicAudience: params.comicAudience,
          quality: params.quality,
        });

        // Phase 2: panels
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "panels" } });
        const panels = await provider.genPanels({
          beats,
          photos: photoArgs,
          panelCount: params.panelCount,
          comicAudience: params.comicAudience,
          quality: params.quality,
        });

        // Phase 3: narrative
        await prisma.story.update({ where: { id: storyId! }, data: { phase: "narrative" } });
        const tn = (await provider.genNarrative({
          beats,
          audience: params.audience,
          style: params.style,
          tone: params.tone,
          wordCount: 90,
          comicAudience: params.comicAudience,
          quality: params.quality,
        })) as TitleNarrative | undefined;

        if (tn && typeof tn !== "object") {
          console.warn("[story] genNarrative returned unexpected type:", typeof tn);
        }

        return {
          beats,
          panels,
          title: tn?.title || "Untitled Comic",
          narrative: tn?.narrative || "",
        };
      })()
    );

    // Mark READY
    const resolvedModel = getModelForQuality(chosen, params.quality);
    await prisma.story.update({
      where: { id: storyId },
      data: {
        title,
        narrative,
        beatsJson: beats as unknown as object,
        panelMap: panels as unknown as object,
        status: "READY",
        phase: null,
        model: resolvedModel,
        prompt: JSON.stringify({
          provider: chosen,
          quality: params.quality,
          comicAudience: params.comicAudience,
          audience: params.audience,
          tone: params.tone,
          style: params.style,
          panelCount: params.panelCount,
          startedAt: started,
        }),
        error: null,
      },
    });

    return NextResponse.json({
      status: "READY",
      model: resolvedModel,
      settings: {
        provider: chosen,
        quality: params.quality,
        comicAudience: params.comicAudience,
        audience: params.audience,
        tone: params.tone,
        style: params.style,
        panelCount: params.panelCount,
      },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err ?? "unknown_error");
    console.error("POST /api/story/[id]/run error", errMsg);
    if (storyId) {
      try {
        await prisma.story.update({
          where: { id: storyId },
          data: { status: "ERROR", phase: null, error: errMsg.slice(0, 512) },
        });
      } catch (e) {
        console.error("Failed to mark story as ERROR", e);
      }
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm vitest run src/app/api/story/[id]/run/route.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/story/[id]/run/
git commit -m "feat: add POST /api/story/[id]/run with phase tracking"
```

---

## Task 4: Add `phase` to `GET /api/story/[id]` response

**Files:**
- Modify: `src/app/api/story/[id]/route.ts`
- Modify: `src/app/api/story/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

In `src/app/api/story/[id]/route.test.ts`, add this test inside the `describe` block after the existing tests:

```typescript
it('should include phase in response', async () => {
  const mockStory = {
    id: 'story1',
    title: 'Test Story',
    narrative: 'Test narrative',
    status: 'PROCESSING',
    phase: 'panels',
    beatsJson: [],
    panelMap: [],
    shareSlug: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    room: { code: 'ROOM1' },
  };

  vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);

  const request = new Request('http://localhost/api/story/story1');
  const response = await GET(request);
  const data = await response.json();

  expect(data.phase).toBe('panels');
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm vitest run src/app/api/story/[id]/route.test.ts
```

Expected: `should include phase in response` fails — `phase` is `undefined` in the response.

- [ ] **Step 3: Add `phase` to the response in `src/app/api/story/[id]/route.ts`**

Find the `return new Response(JSON.stringify({...` block and add `phase: story.phase,`:

```typescript
    return new Response(
      JSON.stringify({
        id: story.id,
        roomCode: story.room.code,
        title: story.title,
        narrative: story.narrative,
        status: story.status,
        phase: story.phase,
        beats: story.beatsJson,
        panels: story.panelMap,
        shareSlug: story.shareSlug,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm vitest run src/app/api/story/[id]/route.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/story/[id]/route.ts src/app/api/story/[id]/route.test.ts
git commit -m "feat: expose phase field in GET /api/story/[id] response"
```

---

## Task 5: Update `GenerateStoryButton` with parallel flow and progress UI

**Files:**
- Create: `src/components/GenerateStoryButton.test.tsx`
- Modify: `src/components/GenerateStoryButton.tsx`

The button now orchestrates: init → (run + poll in parallel) → share → navigate. Phase from poll responses drives a three-step checklist UI.

- [ ] **Step 1: Create the test file**

Create `src/components/GenerateStoryButton.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GenerateStoryButton from './GenerateStoryButton';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

type FetchCall = { url: string; method: string };

function makeFetch(handler: (call: FetchCall) => Promise<{ ok: boolean; data: unknown }>) {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    return handler({ url, method }).then(({ ok, data }) => ({
      ok,
      json: () => Promise.resolve(data),
    }));
  });
}

describe('GenerateStoryButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders a generate button', () => {
    render(<GenerateStoryButton roomCode="TEST" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows Beats, Panels, Narrative step labels while loading', async () => {
    // All fetches hang so the component stays in loading state
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    // setLoading(true) fires synchronously before the first await, so steps appear immediately
    expect(screen.getByText('Beats')).toBeInTheDocument();
    expect(screen.getByText('Panels')).toBeInTheDocument();
    expect(screen.getByText('Narrative')).toBeInTheDocument();
  });

  it('shows error message when init fails', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(async () => ({ ok: false, data: { error: 'internal_error' } }))
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/internal_error/i)).toBeInTheDocument();
    });
  });

  it('navigates to story after successful generation', async () => {
    let pollCount = 0;
    vi.stubGlobal(
      'fetch',
      makeFetch(async ({ url, method }) => {
        if (url === '/api/story' && method === 'POST') {
          return { ok: true, data: { id: 'story1' } };
        }
        if (url === '/api/story/story1/run' && method === 'POST') {
          return { ok: true, data: { status: 'READY', model: 'mock-model', settings: {} } };
        }
        if (url === '/api/story/story1') {
          pollCount++;
          return { ok: true, data: { status: 'READY', phase: null } };
        }
        if (url === '/api/story/story1/share' && method === 'POST') {
          return { ok: true, data: { id: 'story1', shareSlug: 'test-slug' } };
        }
        return { ok: true, data: {} };
      })
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    // Advance past the 1500ms poll interval
    await vi.advanceTimersByTimeAsync(1600);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/s/test-slug');
    });
  });

  it('shows error when story status becomes ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(async ({ url, method }) => {
        if (url === '/api/story' && method === 'POST') {
          return { ok: true, data: { id: 'story1' } };
        }
        if (url === '/api/story/story1/run' && method === 'POST') {
          return { ok: true, data: { status: 'ERROR' } };
        }
        if (url === '/api/story/story1') {
          return { ok: true, data: { status: 'ERROR', phase: null } };
        }
        return { ok: true, data: {} };
      })
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    await vi.advanceTimersByTimeAsync(1600);

    await waitFor(() => {
      expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm vitest run src/components/GenerateStoryButton.test.tsx
```

Expected: several tests fail (component doesn't show step labels yet, navigation test fails because `/run` endpoint isn't called).

- [ ] **Step 3: Rewrite `src/components/GenerateStoryButton.tsx`**

Replace the entire file with:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = 'openai' | 'anthropic' | 'mock' | undefined;
type Phase = 'beats' | 'panels' | 'narrative' | null;
export type Quality = 'fast' | 'balanced' | 'premium';

type Props = {
  roomCode: string;
  ownerHandle?: string;
  className?: string;
  provider?: Provider;
  comicAudience?: 'kids' | 'adults';
  style?: string;
  tone?: string;
  quality?: Quality;
};

const STEPS: { key: NonNullable<Phase>; label: string }[] = [
  { key: 'beats', label: 'Beats' },
  { key: 'panels', label: 'Panels' },
  { key: 'narrative', label: 'Narrative' },
];

export default function GenerateStoryButton({
  roomCode,
  ownerHandle = 'devuser',
  className = '',
  provider,
  comicAudience,
  style,
  tone,
  quality = 'balanced',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clientLabel = `Generate ${comicAudience === 'adults' ? 'Adult' : 'Kids'} Comic`;
  const label = mounted ? clientLabel : 'Generate Story';

  function pollUntilDone(id: string): Promise<void> {
    let failCount = 0;
    return new Promise<void>((resolve, reject) => {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/story/${id}`);
          const j = await r.json();
          failCount = 0;

          if (j.phase) setPhase(j.phase as Phase);

          if (j.status === 'READY') {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            resolve();
          } else if (j.status === 'ERROR') {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            reject(new Error('Generation failed'));
          }
        } catch {
          failCount++;
          if (failCount >= 5) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            reject(new Error('Connection error'));
          }
        }
      }, 1500);
    });
  }

  async function onClick() {
    try {
      setLoading(true);
      setErr(null);
      setPhase(null);

      // Step 1: init — create story row, get id back immediately
      const initRes = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode, ownerHandle, provider, comicAudience, style, tone, quality }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || 'Failed creating story');
      const { id } = initJson;

      // Step 2: fire run (don't await yet) + poll in parallel
      // run failure is non-fatal here — polling drives completion via DB status
      const runPromise = fetch(`/api/story/${id}/run`, { method: 'POST' })
        .then((r) => r.json())
        .catch(() => null);

      await pollUntilDone(id);

      const runJson = await runPromise;

      // Step 3: share
      const shareRes = await fetch(`/api/story/${id}/share`, { method: 'POST' });
      const shareJson = await shareRes.json();
      if (!shareRes.ok) throw new Error(shareJson.error || 'Failed sharing story');

      // Stash meta in sessionStorage for the story page to pick up
      try {
        const key = `story-meta:/api/story/by-slug/${shareJson.shareSlug}`;
        sessionStorage.setItem(key, JSON.stringify({
          model: runJson?.model,
          settings: runJson?.settings,
        }));
      } catch {}

      router.push(`/s/${shareJson.shareSlug}`);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  const phaseIndex = phase ? STEPS.findIndex((s) => s.key === phase) : -1;

  return (
    <div className={className}>
      <button
        onClick={onClick}
        disabled={loading}
        className="btn btn-primary"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="ml-1">Generating…</span>
          </>
        ) : (
          <span suppressHydrationWarning>✨ {label}</span>
        )}
      </button>

      {loading && (
        <div className="mt-3 space-y-1.5">
          {STEPS.map((step, i) => {
            const done = i < phaseIndex;
            const active = i === phaseIndex;
            return (
              <div key={step.key} className="flex items-center gap-2 text-sm">
                {done ? (
                  <span className="text-green-600 font-bold w-3">✓</span>
                ) : active ? (
                  <svg className="h-3 w-3 animate-spin text-blue-500 shrink-0" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                ) : (
                  <span className="text-gray-400 w-3">○</span>
                )}
                <span className={done ? 'line-through text-gray-400' : active ? 'font-medium' : 'text-gray-500'}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm vitest run src/components/GenerateStoryButton.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/GenerateStoryButton.tsx src/components/GenerateStoryButton.test.tsx
git commit -m "feat: GenerateStoryButton shows live phase progress during generation"
```

---

## Task 6: Full test suite + build verification

- [ ] **Step 1: Run all tests**

```bash
pnpm vitest run
```

Expected: all tests pass. Zero failures.

- [ ] **Step 2: Run the production build**

```bash
pnpm build
```

Expected: exits 0. If TypeScript errors appear, fix them before continuing.

- [ ] **Step 3: Push**

```bash
git push
```

Expected: CI passes (the GitHub Actions workflow will verify the health endpoint still works).

---

## Manual smoke test checklist

After deploying, verify end-to-end:

1. Open a room that has photos
2. Click "Generate Story"
3. Confirm the three step labels appear (Beats, Panels, Narrative)
4. Watch beats check off (✓) when panels spinner starts
5. Watch panels check off when narrative spinner starts
6. Confirm automatic navigation to the story page when done
7. Confirm story renders correctly (no regression)
