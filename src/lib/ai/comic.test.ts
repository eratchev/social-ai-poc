import { describe, it, expect } from 'vitest';
import { clampWords, enforceComicCaps, COMIC_PRESETS } from './comic';
import type { Panel } from './structured';

describe('comic', () => {
  describe('clampWords', () => {
    it('should return original string if within limit', () => {
      expect(clampWords('one two three', 10)).toBe('one two three');
    });

    it('should truncate to max words', () => {
      const result = clampWords('one two three four five six seven eight', 5);
      expect(result.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(result).toContain('…');
    });

    it('should handle empty string', () => {
      expect(clampWords('', 10)).toBe('');
    });

    it('should handle string with only whitespace', () => {
      expect(clampWords('   ', 10)).toBe('');
    });

    it('should remove trailing punctuation and add ellipsis', () => {
      const result = clampWords('one two three four five six.', 3);
      expect(result).toMatch(/…$/);
      expect(result).not.toMatch(/\.$/);
    });

    it('should use default max of 10', () => {
      const short = clampWords('one two three');
      expect(short).toBe('one two three');
      
      const long = clampWords('one two three four five six seven eight nine ten eleven twelve');
      expect(long.split(/\s+/).length).toBeLessThanOrEqual(10);
    });
  });

  describe('enforceComicCaps', () => {
    it('should enforce kids preset limits', () => {
      const panels: Panel[] = [
        {
          index: 0,
          photoId: 'photo1',
          narration: 'This is a very long narration that should be truncated to fit the kids preset limits which are quite short',
          bubbles: [
            { text: 'First bubble with lots of words that need truncation' },
            { text: 'Second bubble' },
            { text: 'Third bubble that should be removed' },
          ],
        },
      ];

      const result = enforceComicCaps(panels, COMIC_PRESETS.kids);

      expect(result[0].narration?.split(/\s+/).length).toBeLessThanOrEqual(10);
      expect(result[0].bubbles?.length).toBe(2);
      expect(result[0].bubbles?.[0].text.split(/\s+/).length).toBeLessThanOrEqual(8);
    });

    it('should enforce adults preset limits', () => {
      const panels: Panel[] = [
        {
          index: 0,
          photoId: 'photo1',
          narration: 'This is a very long narration that should be truncated',
          bubbles: [
            { text: 'First bubble with lots of words' },
            { text: 'Second bubble' },
          ],
        },
      ];

      const result = enforceComicCaps(panels, COMIC_PRESETS.adults);

      expect(result[0].narration?.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(result[0].bubbles?.[0].text.split(/\s+/).length).toBeLessThanOrEqual(10);
    });

    it('should handle panels without narration', () => {
      const panels: Panel[] = [
        {
          index: 0,
          photoId: 'photo1',
          bubbles: [{ text: 'Test bubble' }],
        },
      ];

      const result = enforceComicCaps(panels);
      expect(result[0].narration).toBeUndefined();
    });

    it('should handle panels without bubbles', () => {
      const panels: Panel[] = [
        {
          index: 0,
          photoId: 'photo1',
          narration: 'Test narration',
        },
      ];

      const result = enforceComicCaps(panels);
      expect(result[0].bubbles).toEqual([]);
    });

    it('should preserve other panel properties', () => {
      const panels: Panel[] = [
        {
          index: 0,
          photoId: 'photo1',
          narration: 'Test',
          alt: 'Alt text',
          sfx: ['Boom'],
        },
      ];

      const result = enforceComicCaps(panels);
      expect(result[0].photoId).toBe('photo1');
      expect(result[0].alt).toBe('Alt text');
      expect(result[0].sfx).toEqual(['Boom']);
    });
  });

  describe('COMIC_PRESETS', () => {
    it('should have kids preset', () => {
      expect(COMIC_PRESETS.kids).toEqual({
        panelCount: 6,
        narrationWords: 10,
        bubbleWords: 8,
        bubblesPerPanel: 2,
      });
    });

    it('should have adults preset', () => {
      expect(COMIC_PRESETS.adults).toEqual({
        panelCount: 6,
        narrationWords: 12,
        bubbleWords: 10,
        bubblesPerPanel: 2,
      });
    });
  });
});

