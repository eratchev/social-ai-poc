'use client';

import { useState } from 'react';
import type { Panel } from '@/lib/ai/structured';

type ComicifyButtonProps = {
  storyId: string;
  panels: Panel[];
  onPanelDone: (index: number, url: string) => void;
};

export default function ComicifyButton({ storyId, panels, onPanelDone }: ComicifyButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const panelsWithPhotos = panels.filter((p) => p.photoId);
  const allAlreadyDone = panelsWithPhotos.length > 0 && panelsWithPhotos.every((p) => p.generatedImageUrl);

  if (panelsWithPhotos.length === 0 || allAlreadyDone) return null;

  if (done) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 cursor-default"
      >
        ✓ Comic art ready
      </button>
    );
  }

  async function handleComicify() {
    setGenerating(true);
    setProgress(0);
    let successCount = 0;

    for (const panel of panelsWithPhotos) {
      setProgress(panel.index + 1);
      try {
        const res = await fetch(
          `/api/story/${storyId}/panels/${panel.index}/comicify`,
          { method: 'POST' }
        );
        if (!res.ok) continue;
        const { generatedImageUrl } = await res.json();
        onPanelDone(panel.index, generatedImageUrl);
        successCount++;
      } catch {
        // skip failed panels silently
      }
    }

    setGenerating(false);
    if (successCount > 0) setDone(true);
  }

  return (
    <button
      onClick={handleComicify}
      disabled={generating}
      className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {generating
        ? `Generating panel ${progress} / ${panelsWithPhotos.length}…`
        : '✨ Generate comic art'}
    </button>
  );
}
