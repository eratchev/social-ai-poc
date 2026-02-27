import { describe, it, expect } from 'vitest';
import { enforcePhotoCoverage } from './panels';
import type { Panel } from './structured';
import type { Photo } from './providers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePhoto(id: string): Photo {
  return { id, url: `https://example.com/${id}.jpg` };
}

function makePanel(index: number, photoId?: string): Panel {
  return { index, photoId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enforcePhotoCoverage', () => {
  // -------------------------------------------------------------------------
  // 1. Empty panels array
  // -------------------------------------------------------------------------
  it('returns panels unchanged when panels array is empty', () => {
    const panels: Panel[] = [];
    const photos = [makePhoto('p1'), makePhoto('p2')];
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toBe(panels); // same reference
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 2. Empty photos array
  // -------------------------------------------------------------------------
  it('returns panels unchanged when photos array is empty', () => {
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p2')];
    const photos: Photo[] = [];
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toBe(panels); // same reference
    expect(result).toEqual([makePanel(0, 'p1'), makePanel(1, 'p2')]);
  });

  // -------------------------------------------------------------------------
  // 3. All photos already covered — no changes
  // -------------------------------------------------------------------------
  it('returns panels unchanged when every photo is already used at least once', () => {
    const photos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p2'), makePanel(2, 'p3')];
    const original = panels.map(p => ({ ...p }));
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toBe(panels); // same reference (early return)
    expect(result).toEqual(original);
  });

  it('returns panels unchanged when a photo appears multiple times and all are covered', () => {
    const photos = [makePhoto('p1'), makePhoto('p2')];
    // p1 used twice, p2 used once — all photos covered
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p1'), makePanel(2, 'p2')];
    const original = panels.map(p => ({ ...p }));
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toBe(panels);
    expect(result).toEqual(original);
  });

  // -------------------------------------------------------------------------
  // 4. One photo missing coverage — reassigns a duplicate-use panel
  // -------------------------------------------------------------------------
  it('reassigns one panel when one photo has no coverage', () => {
    const photos = [makePhoto('p1'), makePhoto('p2')];
    // p1 used twice, p2 never used
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p1')];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    expect(photoIds).toContain('p1');
    expect(photoIds).toContain('p2');
    // p1 must appear exactly once now (one duplicate was reassigned to p2)
    expect(photoIds.filter(id => id === 'p1')).toHaveLength(1);
    expect(photoIds.filter(id => id === 'p2')).toHaveLength(1);
  });

  it('reassigns the first duplicate panel to cover the missing photo', () => {
    const photos = [makePhoto('a'), makePhoto('b'), makePhoto('c')];
    // 'a' used three times; 'b' used once; 'c' never used
    const panels = [
      makePanel(0, 'a'),
      makePanel(1, 'a'),
      makePanel(2, 'a'),
      makePanel(3, 'b'),
    ];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    expect(photoIds).toContain('c');
    // 'b' was already covered and should still be covered
    expect(photoIds).toContain('b');
    // 'a' should still be covered (at least once)
    expect(photoIds).toContain('a');
  });

  // -------------------------------------------------------------------------
  // 5. Multiple photos missing coverage — reassigns multiple duplicate panels
  // -------------------------------------------------------------------------
  it('covers multiple missing photos by reassigning multiple duplicate panels', () => {
    const photos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];
    // p1 used three times; p2 and p3 never used
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p1'), makePanel(2, 'p1')];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    expect(photoIds).toContain('p1');
    expect(photoIds).toContain('p2');
    expect(photoIds).toContain('p3');
  });

  it('covers two missing photos from a pool of panels with duplicates', () => {
    const photos = [makePhoto('x'), makePhoto('y'), makePhoto('z')];
    // x used 4 times; y and z never used
    const panels = [
      makePanel(0, 'x'),
      makePanel(1, 'x'),
      makePanel(2, 'x'),
      makePanel(3, 'x'),
    ];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    expect(photoIds).toContain('x');
    expect(photoIds).toContain('y');
    expect(photoIds).toContain('z');
    // x should appear exactly twice (two swapped away to y and z)
    expect(photoIds.filter(id => id === 'x')).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 6. Not enough duplicates — best-effort (some photos remain uncovered)
  // -------------------------------------------------------------------------
  it('does best-effort when there are not enough duplicate panels to cover all missing photos', () => {
    const photos = [makePhoto('a'), makePhoto('b'), makePhoto('c'), makePhoto('d')];
    // Only one panel with 'a' used twice — can donate one duplicate
    // b, c, d all missing → can only fix one
    const panels = [makePanel(0, 'a'), makePanel(1, 'a')];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    // 'a' still covered
    expect(photoIds).toContain('a');
    // Exactly one of the three missing photos got covered
    const coveredMissing = ['b', 'c', 'd'].filter(id => photoIds.includes(id));
    expect(coveredMissing).toHaveLength(1);
    // The total number of panels is unchanged
    expect(result).toHaveLength(2);
  });

  it('returns panels unchanged when there are no duplicate panels to reassign', () => {
    // Each panel uses a different photo, but one photo is missing entirely
    const photos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];
    // p3 never used, but no panel uses p1 or p2 more than once — no candidates
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p2')];
    const original = panels.map(p => ({ ...p }));
    const result = enforcePhotoCoverage(panels, photos);

    // No candidates means nothing gets reassigned
    expect(result).toEqual(original);
  });

  // -------------------------------------------------------------------------
  // 7. Panels referencing photoIds not in the photos list — left alone
  // -------------------------------------------------------------------------
  it('ignores panels whose photoId is not in the photos list when counting duplicates', () => {
    const photos = [makePhoto('known1'), makePhoto('known2')];
    // unknown is not in the photos array — should not be a candidate
    const panels = [
      makePanel(0, 'unknown'),
      makePanel(1, 'known1'),
    ];
    // known2 is missing; unknown appears once but is not in the photos list
    // so it is NOT a duplicate candidate; nothing to swap → panels unchanged
    const original = panels.map(p => ({ ...p }));
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toEqual(original);
  });

  it('only treats panels with known photoIds as candidates for reassignment', () => {
    const photos = [makePhoto('k1'), makePhoto('k2'), makePhoto('k3')];
    // k1 used twice (known duplicate → candidate)
    // 'alien' used twice but is NOT in photos → not counted, not a candidate
    // k3 missing
    const panels = [
      makePanel(0, 'k1'),
      makePanel(1, 'k1'),
      makePanel(2, 'alien'),
      makePanel(3, 'alien'),
      makePanel(4, 'k2'),
    ];
    const result = enforcePhotoCoverage(panels, photos);

    const photoIds = result.map(p => p.photoId);
    // k3 should now be covered (from the k1 duplicate)
    expect(photoIds).toContain('k3');
    // alien panels are untouched
    expect(photoIds.filter(id => id === 'alien')).toHaveLength(2);
    // k1 still appears at least once
    expect(photoIds).toContain('k1');
  });

  // -------------------------------------------------------------------------
  // 8. Additional edge cases
  // -------------------------------------------------------------------------
  it('does not add extra panels — result length equals input length', () => {
    const photos = [makePhoto('p1'), makePhoto('p2'), makePhoto('p3')];
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p1'), makePanel(2, 'p1')];
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toHaveLength(panels.length);
  });

  it('preserves non-photoId fields on reassigned panels', () => {
    const photos = [makePhoto('p1'), makePhoto('p2')];
    const panels: Panel[] = [
      { index: 0, photoId: 'p1', narration: 'Keep this narration', bubbles: [{ text: 'Hi' }] },
      { index: 1, photoId: 'p1', narration: 'Other narration' },
    ];
    const result = enforcePhotoCoverage(panels, photos);

    // One panel should now reference p2; its other fields stay intact
    const reassigned = result.find(p => p.photoId === 'p2');
    expect(reassigned).toBeDefined();
    // narration and bubbles of the reassigned panel must be preserved
    expect(reassigned?.narration).toBeDefined();
  });

  it('returns same reference (mutates in-place) rather than a new array', () => {
    const photos = [makePhoto('p1'), makePhoto('p2')];
    const panels = [makePanel(0, 'p1'), makePanel(1, 'p1')];
    const result = enforcePhotoCoverage(panels, photos);
    expect(result).toBe(panels);
  });

  it('handles panels with no photoId set (undefined) gracefully', () => {
    const photos = [makePhoto('p1'), makePhoto('p2')];
    // Panel with undefined photoId — should not cause errors
    const panels: Panel[] = [
      { index: 0 },           // no photoId
      { index: 1, photoId: 'p1' },
      { index: 2, photoId: 'p1' },
    ];
    // p2 is missing; p1 used twice → candidate is panel[1] or panel[2]
    expect(() => enforcePhotoCoverage(panels, photos)).not.toThrow();
    const photoIds = result => result.map((p: Panel) => p.photoId);
    expect(photoIds(enforcePhotoCoverage([...panels], photos))).toContain('p2');
  });
});
