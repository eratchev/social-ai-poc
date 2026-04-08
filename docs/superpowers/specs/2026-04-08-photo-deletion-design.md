# Photo Deletion — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

## Problem

There is no way to remove a photo from a room after uploading it. Bad uploads stay in the gallery forever and get included in story generation.

## Goal

Add a hover ✕ button to each gallery tile. Clicking it removes the photo immediately (optimistic UI) and deletes it from both the database and Cloudinary.

---

## API

### `DELETE /api/photos/[id]` (new)

- Looks up photo by ID in the DB; returns `404` if not found
- Attempts to delete the Cloudinary asset using `publicId`:
  - Signs the request with `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` + timestamp + SHA1 signature (same credential pattern as `/api/sign`)
  - If Cloudinary deletion fails (asset already gone, network error), logs the error server-side and continues — no point keeping a broken DB reference
- Deletes the DB record
- Returns `{ ok: true }`

No changes to `POST /api/photos` or `GET /api/photos`.

---

## UI — `GalleryLive.tsx`

Each photo `<li>` gets `relative group` classes. A ✕ button is absolutely positioned top-right with `opacity-0 group-hover:opacity-100 transition-opacity`.

### Delete flow

1. User hovers tile → ✕ button fades in
2. User clicks ✕ → photo removed from local `photos` state immediately (optimistic)
3. `DELETE /api/photos/[id]` fires in the background
4. While in-flight: ✕ button shows a spinner; clicking again is a no-op (prevents double-delete)
5. On success: nothing to do (photo already removed from state)
6. On failure: photo restored to its original position in the list; tile gets a brief red border to signal the error

### Button styling

- `absolute top-1.5 right-1.5 z-10`
- Dark circle: `bg-black/70 hover:bg-black text-white rounded-full w-6 h-6 flex items-center justify-center`
- ✕ icon when idle, spinner (same SVG as other buttons in the codebase) when in-flight

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Photo not found (404) | Treat as success — already gone |
| Cloudinary failure | Log server-side, delete DB record anyway, return `{ ok: true }` |
| API network error (client) | Restore photo to gallery, flash red border on tile |
| Double-click | Button disabled while in-flight; second click is a no-op |
| Photo referenced by a story | Story keeps its `photoId` reference; that comic panel shows the no-photo fallback |

---

## File Changes

| File | Action |
|---|---|
| `src/app/api/photos/[id]/route.ts` | Create — `DELETE` handler |
| `src/app/api/photos/[id]/route.test.ts` | Create — unit tests for the delete endpoint |
| `src/components/GalleryLive.tsx` | Modify — add hover ✕ button with optimistic delete |
| `src/components/GalleryLive.test.tsx` | Create — component tests for delete interaction |

No schema changes. No new dependencies (Cloudinary signing uses `crypto` from Node stdlib, same as `/api/sign`).

---

## Testing

- Unit test: `DELETE /api/photos/[id]` deletes from DB and calls Cloudinary destroy
- Unit test: returns `404` when photo not found
- Unit test: deletes DB record even when Cloudinary destroy fails
- Component test: ✕ button absent when not hovering, present on hover
- Component test: photo removed optimistically on click
- Component test: photo restored if API returns error
- Component test: ✕ button disabled while delete in flight
