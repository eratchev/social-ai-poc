// provider-mock.test.ts
//
// MockProvider is a pure deterministic implementation with no API calls,
// so no mocking of external dependencies is needed.

import { describe, it, expect } from 'vitest';
import { MockProvider } from './provider-mock';
import type { Photo } from './providers';
import type { Beat } from './structured';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePhotos(count: number): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i}`,
    url: `https://example.com/photo-${i}.jpg`,
  }));
}

function makeBeats(count: number): Beat[] {
  const kinds: Beat['type'][] = ['setup', 'inciting', 'rising', 'climax', 'resolution', 'button'];
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    type: kinds[i % kinds.length],
    summary: `Beat ${i} summary`,
    callouts: ['item'],
    imageRefs: [i],
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockProvider', () => {
  const provider = new MockProvider();

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  it('providerName() returns "mock"', () => {
    expect(provider.providerName()).toBe('mock');
  });

  it('modelName() returns "mock:v0"', () => {
    expect(provider.modelName()).toBe('mock:v0');
  });

  // -------------------------------------------------------------------------
  // genBeats
  // -------------------------------------------------------------------------

  describe('genBeats()', () => {
    it('returns an array of Beat objects with the required fields', async () => {
      const photos = makePhotos(5);
      const beats = await provider.genBeats({ photos });

      expect(Array.isArray(beats)).toBe(true);
      expect(beats.length).toBeGreaterThan(0);

      for (const beat of beats) {
        expect(typeof beat.index).toBe('number');
        expect(typeof beat.type).toBe('string');
        expect(typeof beat.summary).toBe('string');
        expect(beat.summary.length).toBeGreaterThan(0);
        // callouts and imageRefs are optional in the schema but MockProvider always sets them
        expect(Array.isArray(beat.callouts)).toBe(true);
        expect(Array.isArray(beat.imageRefs)).toBe(true);
      }
    });

    it('clamps beat count to 5 when fewer than 5 photos are supplied', async () => {
      const beats = await provider.genBeats({ photos: makePhotos(2) });
      expect(beats.length).toBe(5);
    });

    it('clamps beat count to 5 when exactly 5 photos are supplied', async () => {
      const beats = await provider.genBeats({ photos: makePhotos(5) });
      expect(beats.length).toBe(5);
    });

    it('clamps beat count to 7 when more than 7 photos are supplied', async () => {
      const beats = await provider.genBeats({ photos: makePhotos(20) });
      expect(beats.length).toBe(7);
    });

    it('returns 6 beats for 6 photos (within the 5–7 range)', async () => {
      const beats = await provider.genBeats({ photos: makePhotos(6) });
      expect(beats.length).toBe(6);
    });

    it('beat indexes are sequential starting from 0', async () => {
      const beats = await provider.genBeats({ photos: makePhotos(5) });
      beats.forEach((beat, i) => {
        expect(beat.index).toBe(i);
      });
    });
  });

  // -------------------------------------------------------------------------
  // genPanels
  // -------------------------------------------------------------------------

  describe('genPanels()', () => {
    it('returns exactly panelCount panels', async () => {
      const photos = makePhotos(3);
      const beats = makeBeats(5);

      for (const panelCount of [1, 4, 6, 10]) {
        const panels = await provider.genPanels({ beats, photos, panelCount });
        expect(panels.length).toBe(panelCount);
      }
    });

    it('each panel has index, photoId, and narration fields', async () => {
      const photos = makePhotos(3);
      const beats = makeBeats(5);
      const panels = await provider.genPanels({ beats, photos, panelCount: 6 });

      for (const panel of panels) {
        expect(typeof panel.index).toBe('number');
        expect(typeof panel.photoId).toBe('string');
        expect(panel.photoId!.length).toBeGreaterThan(0);
        expect(typeof panel.narration).toBe('string');
        expect(panel.narration!.length).toBeGreaterThan(0);
      }
    });

    it('panel indexes are sequential starting from 0', async () => {
      const photos = makePhotos(2);
      const beats = makeBeats(3);
      const panels = await provider.genPanels({ beats, photos, panelCount: 4 });

      panels.forEach((panel, i) => {
        expect(panel.index).toBe(i);
      });
    });

    it('photoId values refer to one of the supplied photos', async () => {
      const photos = makePhotos(3);
      const beats = makeBeats(3);
      const photoIds = new Set(photos.map((p) => p.id));
      const panels = await provider.genPanels({ beats, photos, panelCount: 9 });

      for (const panel of panels) {
        expect(photoIds.has(panel.photoId!)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // genNarrative
  // -------------------------------------------------------------------------

  describe('genNarrative()', () => {
    it('returns an object with title (string) and narrative (string)', async () => {
      const beats = makeBeats(5);
      const result = await provider.genNarrative({ beats });

      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('title is deterministic for the same inputs', async () => {
      const beats = makeBeats(5);
      const result1 = await provider.genNarrative({ beats });
      const result2 = await provider.genNarrative({ beats });

      expect(result1.title).toBe(result2.title);
    });

    it('title changes when beats change', async () => {
      const beatsA = makeBeats(5);
      const beatsB = makeBeats(7);
      const resultA = await provider.genNarrative({ beats: beatsA });
      const resultB = await provider.genNarrative({ beats: beatsB });

      // Different beat counts produce different titles because makeMockTitle
      // uses beats.length as part of its index calculation.
      expect(resultA.title).not.toBe(resultB.title);
    });

    it('narrative incorporates the beat arc', async () => {
      const beats = makeBeats(3);
      const result = await provider.genNarrative({ beats });
      const arc = beats.map((b) => b.type).join(' → ');

      expect(result.narrative).toContain(arc);
    });
  });
});
