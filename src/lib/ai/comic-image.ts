import type { Panel } from './structured';

export function buildComicPrompt(panel: Panel): string {
  const base =
    'Comic book panel illustration with bold ink outlines, halftone shading, and vivid saturated colors.';

  const scene = panel.narration ? ` Scene: ${panel.narration}.` : '';

  const motion =
    panel.sfx?.length
      ? ` Energy and motion suggest: ${panel.sfx.join(', ')}.`
      : '';

  return `${base}${scene}${motion}`;
}
