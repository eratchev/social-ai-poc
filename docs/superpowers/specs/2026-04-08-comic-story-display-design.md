# Comic Story Display — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

## Problem

The story page at `/s/[slug]` shows panels as masonry cards — photo on top, text below. This reads like a blog post, not a comic. The narrative prose appears first and dominates the page, pushing the actual panels below the fold.

## Goal

Make the story page feel like a **comic book page**: sequential panels in a 2-column grid, photos filling their cells, speech bubbles and narration overlaid directly on the images, narrative prose de-emphasized below.

---

## Page Structure

New render order (replacing the current narrative-first layout):

1. **Header** — title gradient + share button (unchanged)
2. **Comic grid** — panels, visually dominant
3. **Narrative disclosure** — collapsed `<details>` below the comic
4. **Meta card** — bottom (unchanged)

---

## Panel Anatomy

Each panel is a fixed-aspect-ratio cell (4:3) with `position: relative`. All text overlays use absolute positioning on top of the photo.

```
┌──────────────────────────────┐
│  [1]              💥 POW!   │  ← panel number badge (top-left), SFX (top-right)
│                              │
│         photo (cover)        │
│                              │
│   "She said what?!"          │  ← bubble chips, floating over photo
│                              │
├──────────────────────────────┤
│ Caption box (dark strip)     │  ← narration text, white on semi-dark bg
└──────────────────────────────┘
```

### Photo
- `object-fit: cover`, fills the entire cell
- `position: absolute, inset: 0`
- No border-radius

### Panel border
- `border-2 border-black dark:border-zinc-700`
- No border-radius (hard corners, comic style)

### Panel number badge
- Top-left, `position: absolute`
- Small dark pill: `bg-black/60 text-white text-xs px-1.5 py-0.5 font-bold`

### SFX
- Top-right, `position: absolute`
- Bold uppercase, comic-feel: `font-black text-yellow-300 text-sm uppercase tracking-widest drop-shadow`
- Only rendered if `panel.sfx` is non-empty (join multiple SFX with space)

### Speech bubble chips
- Absolutely positioned, bottom of photo area, above caption box
- `z-10` to stack above the caption box (`z-0`)
- Same pill shape as current `BubbleChip` but rendered over the image
- `bg-white/90 dark:bg-zinc-800/90` for legibility
- `flex-wrap gap-1.5`, centered horizontally
- Max 3 bubbles shown; extras truncated silently (edge case)

### Caption box (narration)
- Pinned to the bottom of the cell: `position: absolute, bottom: 0, left: 0, right: 0`
- `bg-black/70 text-white text-sm px-3 py-2 leading-snug`
- Max 4 lines (`line-clamp-4`)
- Only rendered if `panel.narration` is non-empty

### No-photo fallback
- `bg-zinc-800` dark background filling the cell
- Panel number centered in large text

---

## Grid Layout

```css
grid-cols-1 md:grid-cols-2
gap-0.5   /* 2px gutter, comic page feel */
```

Contained in a `<section>` with `border-2 border-black dark:border-zinc-700` around the whole grid (comic page border).

---

## Narrative Disclosure

Below the comic grid, a native `<details>`/`<summary>` element:

```html
<details>
  <summary>Read the full story</summary>
  <!-- prose paragraphs, same as current -->
</details>
```

- Closed by default (`open` attribute absent)
- Styled as a card: `card p-5 mt-6`
- Summary: `cursor-pointer font-semibold text-sm`
- Prose inside unchanged from current implementation

---

## Header Change

Subtitle line updated from:

> Room `ABC` · Published April 8

To:

> 6 panels · Room `ABC` · April 8

Panel count derived from `panels.length`.

---

## File Changes

**Modify only:** `src/app/s/[slug]/page.tsx`

- Replace the `<section>` masonry panels block with the comic grid
- Move narrative `<article>` below panels, wrap in `<details>`
- Update subtitle line in header
- Keep `BubbleChip` component but adjust positioning to overlay mode
- Keep `StoryMetaCard` at bottom, unchanged

No new files. No new dependencies.

---

## Testing

- Component render test: panel with photo renders caption box + bubble overlays
- Component render test: panel without photo renders dark fallback
- Component render test: narrative section is collapsed by default (`details` has no `open`)
- Component render test: SFX rendered when present, absent when empty
- Visual check: 6-panel story reads left-to-right in 2 columns on desktop, single column on mobile
