# Comic Panel Art — Design Spec

**Date:** 2026-04-08
**Feature:** AI-generated comic-style illustrations for story panels
**Status:** Approved

---

## Goal

Add a "✨ Generate comic art" button to the shared story page that transforms each panel's user-uploaded photo into a comic-book style illustration using OpenAI's image API. Generated images are stored in Cloudinary and replace the original photo in the panel display.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| What role does AI play? | Stylize existing photo (image-to-image) | Preserves personal connection — users see themselves in comic form |
| Image generation API | OpenAI `gpt-image-1` | Already integrated (key, SDK, client) — zero setup cost |
| When does generation happen? | On demand, user-triggered | Avoids slowing story generation; gives cost control |
| Trigger mechanism | Client-driven per-panel loop | No Vercel timeout risk; panels swap in progressively; simple server code |
| Data storage | `generatedImageUrl` field in `panelMap` JSON | No migration needed — `Story.panelMap` is already a `Json` column |

---

## Architecture

### New file

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/story/[id]/panels/[index]/comicify/route.ts` | Create | POST handler — fetches photo, calls OpenAI, uploads to Cloudinary, patches DB |
| `src/app/api/story/[id]/panels/[index]/comicify/route.test.ts` | Create | Unit tests for the endpoint |
| `src/lib/ai/comic-image.ts` | Create | `buildComicPrompt(panel)` — constructs the OpenAI image prompt from panel narration/SFX |
| `src/lib/ai/comic-image.test.ts` | Create | Unit tests for prompt builder |
| `src/components/ComicifyButton.tsx` | Create | Client component — drives the per-panel generation loop, shows progress |
| `src/components/ComicifyButton.test.tsx` | Create | RTL tests for button states and loop behavior |

### Modified files

| File | Change |
|---|---|
| `src/lib/ai/structured.ts` | Add `generatedImageUrl?: string` to `PanelBase` schema |
| `src/components/ComicPanel.tsx` | Add `generatedImageUrl?: string \| null` prop; prefer it over `photoUrl` |
| `src/components/ComicPanel.test.tsx` | Add test: `generatedImageUrl` takes priority over `photoUrl` |
| `src/app/s/[slug]/page.tsx` | Refactor: extract `StoryViewer` client component; pass `generatedImageUrl` per panel; render `ComicifyButton` |

---

## Data Model

No Prisma migration required. `Story.panelMap` is a `Json` column storing `Panel[]`. One optional field is added to the `Panel` type:

```ts
// src/lib/ai/structured.ts — PanelBase additions
generatedImageUrl?: string   // Cloudinary URL of the AI-generated comic illustration
```

Existing panels without this field continue to display the original photo. The field is written by the comicify endpoint and read by `ComicPanel`.

---

## API Endpoint

### `POST /api/story/[id]/panels/[index]/comicify`

**Auth:** None (protected by site-access cookie via middleware, same as all routes).

**Params:** `id` (story ID), `index` (0-based panel index) — from URL path.

**Request body:** Empty.

**Response (200):**
```json
{ "generatedImageUrl": "https://res.cloudinary.com/..." }
```

**Error responses:**
- `404` — story not found, or panel at `index` does not exist
- `400` — story is not `READY`, or panel has no `photoId`
- `500` — OpenAI or Cloudinary failure

**Handler steps:**

1. Load story from DB (`panelMap`, `status`). Return 404/400 as appropriate.
2. Look up `photo.storageUrl` via `panel.photoId`. Return 400 if missing.
3. Fetch photo bytes: `fetch(storageUrl)` → `ArrayBuffer` → `Buffer` → `File`.
4. Call `openai.images.edit({ model: 'gpt-image-1', image: file, prompt: buildComicPrompt(panel) })`. The response includes `data[0].b64_json` (base64-encoded PNG).
5. Decode `data[0].b64_json` → upload to Cloudinary as a data URI: `cloudinary.uploader.upload('data:image/png;base64,...')`.
6. Patch `panelMap[index].generatedImageUrl` in DB → return `{ generatedImageUrl }`.

**Module-level setup** (same pattern as `provider-openai.ts`):
```ts
export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
cloudinary.config({ ... });
```

---

## Prompt Builder

`src/lib/ai/comic-image.ts` exports a single pure function:

```ts
export function buildComicPrompt(panel: Panel): string
```

Produces a prompt like:
> "Comic book panel illustration with bold ink outlines, halftone shading, and vivid saturated colors. Scene: [panel.narration]. No text, no speech bubbles, no captions."

If `panel.sfx` is non-empty, appends: `"Energy and motion suggest: [sfx.join(', ')]."`

If `panel.narration` is absent, falls back to a generic comic style prompt without a scene description.

The function is pure (no side effects) and fully unit-testable.

---

## UI

### `ComicifyButton.tsx`

```ts
'use client';
export default function ComicifyButton({
  storyId,
  panels,           // Panel[] — to know which panels have photoIds
  onPanelDone,      // (index: number, url: string) => void
}: ComicifyButtonProps)
```

**States:**
- **Idle** — renders `✨ Generate comic art` button. Hidden if no panels have a `photoId`, or if every panel that has a `photoId` already has a `generatedImageUrl` (i.e. nothing left to generate).
- **Generating** — button disabled, label: `Generating panel 2 / 4…`
- **Done** — button text changes to `✓ Comic art ready`, disabled.

**Loop logic:**
```ts
for (const panel of panelsWithPhotos) {
  setProgress(panel.index + 1);
  const res = await fetch(`/api/story/${storyId}/panels/${panel.index}/comicify`, { method: 'POST' });
  if (!res.ok) continue;  // skip failed panels silently
  const { generatedImageUrl } = await res.json();
  onPanelDone(panel.index, generatedImageUrl);
}
```

### `ComicPanel.tsx`

New prop: `generatedImageUrl?: string | null`

Image priority: `generatedImageUrl ?? photoUrl`. No other changes — the panel doesn't know or care how the image was produced.

### `StoryViewer` (extracted from `/s/[slug]/page.tsx`)

The shared story page becomes a server shell that fetches data and renders a `'use client'` `StoryViewer` component. `StoryViewer` holds:
- `panels` state (initially server-fetched, updated by `onPanelDone`)
- Renders `ComicPanel` for each panel
- Renders `ComicifyButton`

The server page remains a server component — only `StoryViewer` is client-side.

---

## Error Handling

| Failure | Behavior |
|---|---|
| OpenAI `images.edit()` throws | Endpoint returns 500; client skips panel, continues loop |
| Cloudinary upload fails | Endpoint returns 500; client skips panel, continues loop |
| Panel already has `generatedImageUrl` | Endpoint re-generates (idempotent, last-write-wins) |
| Story not `READY` | Endpoint returns 400; button is only shown when `status === 'READY'` |
| Network drop mid-loop | Already-persisted panels keep their URL; user can re-click to fill gaps |

---

## Testing

### `route.test.ts`
Mock: `prisma`, `fetch` (photo download), `openai.images.edit`, `cloudinary.uploader.upload`.

Scenarios:
- Returns 404 when story not found
- Returns 404 when panel index out of range
- Returns 400 when panel has no `photoId`
- Returns 400 when story is not `READY`
- Happy path: calls OpenAI with correct prompt, uploads to Cloudinary, patches DB, returns URL
- Returns 500 when OpenAI throws (DB not patched)
- Returns 500 when Cloudinary throws (DB not patched)

### `comic-image.test.ts`
- Returns prompt with narration when present
- Appends SFX clause when sfx array is non-empty
- Falls back to generic prompt when narration is absent
- Never includes "speech bubbles" or "text" in the prompt (regression guard)

### `ComicifyButton.test.tsx`
Mock: `fetch`

Scenarios:
- Renders button when panels have photos
- Does not render when no panels have photos
- Clicking calls fetch for each panel in order
- Shows progress label during generation
- Calls `onPanelDone` for each successful panel
- Skips failed panels (non-ok response) and continues
- Button disabled during generation

### `ComicPanel.test.tsx` addition
- When `generatedImageUrl` is provided, renders it instead of `photoUrl`

---

## Out of Scope

- Regenerating individual panels (button regenerates all)
- Style selection (comic style is fixed — bold ink, halftone, vivid colors)
- Cost display or usage limits
- Video or animated panels
- Downloading the comic as a PDF/image
