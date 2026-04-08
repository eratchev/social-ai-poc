import { describe, it, expect } from 'vitest';
import { buildComicPrompt } from './comic-image';
import type { Panel } from './structured';

const base: Panel = { index: 0 };

describe('buildComicPrompt', () => {
  it('returns a prompt containing the comic style keywords', () => {
    const prompt = buildComicPrompt(base);
    expect(prompt).toMatch(/comic book/i);
    expect(prompt).toMatch(/ink/i);
    expect(prompt).toMatch(/halftone/i);
  });

  it('includes the narration in the scene when present', () => {
    const panel: Panel = { index: 0, narration: 'The hero leaps across rooftops.' };
    const prompt = buildComicPrompt(panel);
    expect(prompt).toContain('The hero leaps across rooftops.');
  });

  it('falls back to a generic prompt when narration is absent', () => {
    const prompt = buildComicPrompt(base);
    expect(prompt).not.toMatch(/Scene:/);
    expect(prompt.length).toBeGreaterThan(20);
  });

  it('appends an SFX clause when sfx array is non-empty', () => {
    const panel: Panel = { index: 0, sfx: ['BOOM', 'CRASH'] };
    const prompt = buildComicPrompt(panel);
    expect(prompt).toContain('BOOM');
    expect(prompt).toContain('CRASH');
  });

  it('does not mention speech bubbles or text in the prompt', () => {
    const panel: Panel = { index: 0, narration: 'Drama unfolds.', sfx: ['ZAP'] };
    const prompt = buildComicPrompt(panel);
    expect(prompt).not.toMatch(/speech bubble/i);
    expect(prompt).not.toMatch(/\btext\b/i);
    expect(prompt).not.toMatch(/caption/i);
  });

  it('includes the photo description when provided', () => {
    const panel: Panel = { index: 0 };
    const prompt = buildComicPrompt(panel, 'A woman in a red jacket laughing outdoors.');
    expect(prompt).toContain('A woman in a red jacket laughing outdoors.');
  });

  it('omits Depict clause when no photo description is provided', () => {
    const prompt = buildComicPrompt(base);
    expect(prompt).not.toMatch(/Depict:/);
  });
});
