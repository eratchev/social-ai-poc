import { COMIC_LIMITS, type Panel } from './structured';

export function clampWords(s = '', maxWords = 10): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length <= maxWords) return s.trim();
  return parts.slice(0, maxWords).join(' ').replace(/[.,;:!?-]*$/, '…');
}

export function enforceComicCaps(panels: Panel[]): Panel[] {
  return panels.map((p) => {
    const narration = p.narration
      ? clampWords(p.narration, Math.min(12, COMIC_LIMITS.narrationMax))
      : p.narration;
    const bubbles = (p.bubbles ?? [])
      .slice(0, COMIC_LIMITS.bubblesPerPanel)
      .map((b) => ({
        ...b,
        text: clampWords(b.text, Math.min(10, COMIC_LIMITS.bubbleTextMax)),
      }));
    return { ...p, narration, bubbles };
  });
}
