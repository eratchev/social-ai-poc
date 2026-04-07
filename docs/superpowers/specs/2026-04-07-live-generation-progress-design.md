# Live Generation Progress — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Problem

Story generation takes 15–45 seconds. The current UI shows a plain spinner until `POST /api/story` returns, giving the user no feedback about which phase is running. The user must manually refresh to confirm the story appeared.

## Goal

Show real step-by-step progress while the story is generating:

```
[✓] Beats
[⏳] Panels...
[ ] Narrative
```

Each step checks off as it completes. No manual refresh needed — the user is navigated to the story automatically when done.

---

## Schema

Add a nullable `phase` field to the `Story` model in `prisma/schema.prisma`:

```prisma
phase  String?   // "beats" | "panels" | "narrative" | null
```

- `null` when not yet started or when complete
- Set to the currently-running phase during generation
- No enum — kept as a plain string to avoid a Prisma enum migration

---

## API

### `POST /api/story` (changed — now fast)

**Before:** runs the full AI pipeline, returns when done (~15–45s).  
**After:** creates the story row only, returns immediately (~100ms).

- Validates the request body (same schema as today)
- Upserts user + room (same as today)
- Creates `Story` row: `status=PROCESSING`, `phase=null`
- Stores all generation params in the existing `prompt` JSON field so `/run` can read them
- Returns `{ id }` — nothing else

### `POST /api/story/[id]/run` (new)

Contains all pipeline logic moved from `POST /api/story`.

- Reads and parses generation params from `story.prompt` (JSON string); returns `400` if missing or unparseable
- Collects photos for the room
- Runs caption pass (best-effort, non-fatal)
- Runs the 3-phase pipeline with phase updates:
  1. Set `phase = "beats"` → run `genBeats`
  2. Set `phase = "panels"` → run `genPanels`
  3. Set `phase = "narrative"` → run `genNarrative`
- On success: set `status=READY`, `phase=null`, persist beats/panels/narrative/title/model
- On error: set `status=ERROR`, `error=<message>`
- Returns `{ status, model, settings }` (same shape as current `POST /api/story` response)
- Exports `maxDuration = 60` for Vercel

### `GET /api/story/[id]` (minor change)

Add `phase` to the response body alongside the existing fields.

---

## Client — `GenerateStoryButton`

Replace the current single-fetch flow with a two-call parallel flow:

### Step 1 — Init
```
POST /api/story  →  { id }
```
On failure: show error, stop.

### Step 2 — Run + Poll (in parallel)
- Fire `POST /api/story/[id]/run` (don't await immediately)
- Start polling `GET /api/story/[id]` every 1.5 seconds
- Poll response drives the progress UI (see below)

### Step 3 — Completion
When polling sees `status=READY` (or `/run` returns with `status=READY`):
- Stop polling
- Call `POST /api/story/[id]/share`
- Stash meta in `sessionStorage` (same as today)
- Navigate to `/s/[shareSlug]`

On `status=ERROR`: stop polling, show error message.

### Progress UI

Replace the spinner with a three-step checklist rendered inside the button area:

| Phase value | Beats | Panels | Narrative |
|---|---|---|---|
| `"beats"` | ⏳ | ○ | ○ |
| `"panels"` | ✓ | ⏳ | ○ |
| `"narrative"` | ✓ | ✓ | ⏳ |
| `READY` | ✓ | ✓ | ✓ |

The button remains disabled throughout. No polling interval survives navigation (cleanup on unmount).

---

## Error Handling

- `/api/story` init failure → show error, reset button
- `/api/story/[id]/run` failure → server marks `status=ERROR`; polling detects it and shows error
- Poll network error → non-fatal, retry on next tick; give up after 5 consecutive failures
- Timeout → `/run` has a 45s internal timeout (same as today); Vercel `maxDuration=60` gives buffer

---

## Testing

- Unit test: `POST /api/story` creates a PROCESSING row and returns `{ id }` without running AI
- Unit test: `POST /api/story/[id]/run` updates phase at each step, marks READY on success, marks ERROR on failure
- Unit test: `GET /api/story/[id]` includes `phase` in response
- Component test: `GenerateStoryButton` renders each phase label correctly based on mocked poll responses
- Component test: navigates to story on READY, shows error on ERROR
