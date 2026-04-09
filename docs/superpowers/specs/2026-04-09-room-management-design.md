# Room Management — Design Spec

**Date:** 2026-04-09
**Feature:** Room names, enriched home page list, delete room with cascade
**Status:** Approved

---

## Goal

Give users a clear view of all their rooms (name, photo/story counts, activity) and the ability to rename or delete any room directly from the home page and room workspace.

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Room names | Optional `name` field, set via rename | Existing code field stays; name is display-only |
| Delete behaviour | Cascade — Cloudinary photos + DB records | Consistent with photo delete; no orphaned assets |
| Where to rename | Inline on room workspace header | Rename is a room-level action, natural where you're working in the room |
| Where to delete | Home page list | You delete rooms when managing across rooms, not while inside one |

---

## Data Model

One migration, one nullable field added to `Room`:

```prisma
model Room {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String?  // user-set display name; null → shown as "Untitled room"
  createdBy String
  creator   User     @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  photos  Photo[]
  stories Story[]

  @@index([createdBy])
  @@index([createdAt])
}
```

No other schema changes. `Photo` and `Story` rows cascade-delete when their room is deleted (already enforced by existing `onDelete: Cascade` relations).

---

## API

### `PATCH /api/rooms/[code]`

**Request body:** `{ name: string }` — trimmed, max 80 chars.

**Response (200):** `{ code: string, name: string }`

**Errors:**
- `404` — room not found
- `400` — name missing or exceeds 80 chars
- `500` — DB error

### `DELETE /api/rooms/[code]`

**Request body:** empty.

**Response (200):** `{ ok: true }`

**Handler steps:**
1. Load room from DB; return 404 if not found.
2. Fetch all photos in the room (`select: { publicId: true }`).
3. For each photo with a `publicId`: call `cloudinary.uploader.destroy(publicId)` — best-effort (log errors, do not abort).
4. `prisma.room.delete({ where: { code } })` — DB cascade deletes all photos and stories.
5. Return `{ ok: true }`.

**Errors:**
- `404` — room not found
- `500` — DB error (Cloudinary failures are non-fatal)

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `name String?` to `Room` |
| `prisma/migrations/…` | Migration for `name` column |
| `src/app/api/rooms/[code]/route.ts` | **New** — PATCH (rename) + DELETE (cascade delete) |
| `src/app/api/rooms/[code]/route.test.ts` | **New** — tests for both handlers |
| `src/app/page.tsx` | Update query to include name + counts; replace list UI |
| `src/components/RoomNameEditor.tsx` | **New** — `'use client'` inline rename component |
| `src/components/RoomNameEditor.test.tsx` | **New** — RTL tests for rename states |
| `src/app/u/[roomCode]/page.tsx` | Replace plain heading with `<RoomNameEditor>` |

---

## Components

### `RoomNameEditor`

```tsx
'use client';
export default function RoomNameEditor({
  roomCode,
  initialName,  // null if no name set yet
}: {
  roomCode: string;
  initialName: string | null;
})
```

**States:**
- **Idle** — shows `name` (or `Room {code}` if null) + pencil icon button. Clicking pencil enters edit mode.
- **Editing** — input pre-filled with current name (or empty if null), Save + Cancel buttons. Save on Enter, cancel on Escape.
- **Saving** — input disabled, Save button shows "Saving…"

**On save:** `PATCH /api/rooms/[code]` with `{ name: trimmed }`. On success, update local state; on error, restore previous value and show no-op (silent fail acceptable for POC).

### Home page room list

Server component (no client state needed). Each room row:
- **Name** — `room.name` or *Untitled room* (gray italic) if null
- **Code** — `room.code` in monospace below name
- **Stats** — `{photoCount} photos · {storyCount} stories · {createdAt}`
- **Open button** — links to `/u/[roomCode]`
- **Delete button** — `'use client'` `RoomDeleteButton` component; shows `window.confirm()` before calling `DELETE /api/rooms/[code]`; optimistic removal on success

### `RoomDeleteButton`

Small `'use client'` component (not worth a separate file — inline in the home page or a tiny component). Calls `DELETE /api/rooms/[code]`, calls `onDeleted()` prop on success to remove the row from the parent's state.

Since the home page is a server component, the room list must be rendered inside a client component wrapper to support optimistic removal. Extract a `RoomList` client component that holds `rooms` state and renders the rows.

---

## Home page query

```ts
const rooms = await prisma.room.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50,
  select: {
    code: true,
    name: true,
    createdAt: true,
    _count: { select: { photos: true, stories: true } },
  },
});
```

---

## Error Handling

| Failure | Behaviour |
|---|---|
| Rename API fails | Input restores previous value; no toast (POC) |
| Delete API fails | Row reappears (optimistic restore); no toast (POC) |
| Cloudinary destroy fails (per photo) | Logged, ignored — room DB record still deleted |
| Room not found on delete | 404 returned; client treats as success (already gone) |

---

## Testing

### `route.test.ts` (PATCH + DELETE)

**PATCH scenarios:**
- Returns 404 when room not found
- Returns 400 when name is missing
- Returns 400 when name exceeds 80 chars
- Happy path: updates name, returns `{ code, name }`

**DELETE scenarios:**
- Returns 404 when room not found
- Happy path: destroys Cloudinary assets (best-effort), deletes room, returns `{ ok: true }`
- Cloudinary failure does not prevent DB delete

### `RoomNameEditor.test.tsx`

- Renders room name in idle state
- Falls back to `Room {code}` when name is null
- Clicking pencil enters edit mode with input pre-filled
- Save button calls PATCH with trimmed name
- Enter key saves
- Escape key cancels and restores previous value
- Saving state disables input

### `RoomList` (implicit via home page)

- Clicking Delete calls DELETE endpoint
- Room row is removed optimistically on success
- Row is restored if DELETE fails

---

## Out of Scope

- Rename from home page (rename is on room workspace only)
- Reordering rooms
- Room sharing / access control
- Bulk delete
- Undo delete
