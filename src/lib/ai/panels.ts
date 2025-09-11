import type { Panel } from "./structured";
import type { Photo } from "./providers";

/**
 * Ensure each photo is used at least once in panels.
 * - If some photos are missing, reassign panels that currently use duplicates.
 * - Keeps panel order; only swaps photoId fields.
 */
export function enforcePhotoCoverage(panels: Panel[], photos: Photo[]): Panel[] {
  if (!panels.length || !photos.length) return panels;

  const photoIds = photos.map(p => p.id);
  const counts = new Map<string, number>();
  for (const pid of photoIds) counts.set(pid, 0);

  // Count usage
  for (const p of panels) {
    const pid = p.photoId;
    if (pid && counts.has(pid)) counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  // Which photos are unused?
  const missing = photoIds.filter(pid => (counts.get(pid) || 0) === 0);
  if (missing.length === 0) return panels;

  // Candidates: panels we can reassign (those whose current photo occurs >1)
  const candidates = panels
    .map((p, idx) => ({ p, idx, pid: p.photoId }))
    .filter(x => x.pid && counts.get(x.pid!)! > 1);

  // Reassign in order so layout feels even
  let candIdx = 0;
  for (const neededPid of missing) {
    // find next candidate
    while (candIdx < candidates.length && counts.get(candidates[candIdx].pid!)! <= 1) {
      candIdx++;
    }
    if (candIdx >= candidates.length) break; // nothing left to swap, best effort
    const { p, idx, pid } = candidates[candIdx];

    // swap
    panels[idx] = { ...p, photoId: neededPid };
    counts.set(neededPid, (counts.get(neededPid) || 0) + 1);
    counts.set(pid!, counts.get(pid!)! - 1);
    candIdx++;
  }

  return panels;
}
