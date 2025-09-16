// lib/ai/comic.ts
import type { Panel } from "./structured";

export type ComicAudience = "kids" | "adults";

export const COMIC_PRESETS: Record<ComicAudience, {
  panelCount?: number;
  narrationWords: number;
  bubbleWords: number;
  bubblesPerPanel: number;
}> = {
  kids:   { panelCount: 6, narrationWords: 10, bubbleWords: 8,  bubblesPerPanel: 2 },
  adults: { panelCount: 6, narrationWords: 12, bubbleWords: 10, bubblesPerPanel: 2 },
};

export function clampWords(s = "", max = 10) {
  const parts = s.trim().split(/\s+/);
  if (parts.length <= max) return s.trim();
  return parts.slice(0, max).join(" ").replace(/[.,;:!?-]*$/, "…");
}

export function enforceComicCaps(panels: Panel[], preset = COMIC_PRESETS.kids): Panel[] {
  return panels.map((p) => {
    const narration = p.narration ? clampWords(p.narration, preset.narrationWords) : p.narration;
    const bubbles = (p.bubbles ?? [])
      .slice(0, preset.bubblesPerPanel)
      .map(b => ({ ...b, text: clampWords(b.text, preset.bubbleWords) }));
    return { ...p, narration, bubbles };
  });
}
