'use client';

import { useState } from 'react';
import ComicPanel from './ComicPanel';
import ComicifyButton from './ComicifyButton';
import type { Panel } from '@/lib/ai/structured';

type StoryViewerProps = {
  storyId: string;
  initialPanels: Panel[];
  photoUrlById: Record<string, string>;
  canComicify?: boolean;
  canToggle?: boolean;
};

export default function StoryViewer({ storyId, initialPanels, photoUrlById, canComicify, canToggle = true }: StoryViewerProps) {
  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  // Set of panel indices currently showing the original photo instead of comic art
  const [showOriginal, setShowOriginal] = useState<Set<number>>(new Set());

  function handlePanelDone(index: number, url: string) {
    setPanels((prev) => prev.map((p) => (p.index === index ? { ...p, generatedImageUrl: url } : p)));
    // Auto-switch to comic view when generation completes
    setShowOriginal((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function toggleView(index: number) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <>
      <section className="border-2 border-black dark:border-zinc-700">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-black dark:bg-zinc-700">
          {panels.map((p) => {
            const isShowingOriginal = showOriginal.has(p.index);
            const hasComicArt = !!p.generatedImageUrl;
            return (
              <div key={p.index} className="relative">
                <ComicPanel
                  index={p.index}
                  narration={p.narration}
                  bubbles={p.bubbles}
                  sfx={p.sfx}
                  photoUrl={p.photoId ? (photoUrlById[p.photoId] ?? null) : null}
                  generatedImageUrl={isShowingOriginal ? null : (p.generatedImageUrl ?? null)}
                  alt={p.alt}
                />
                {hasComicArt && canToggle && (
                  <button
                    onClick={() => toggleView(p.index)}
                    className="absolute bottom-2 right-2 z-10 rounded px-2 py-1 text-xs font-semibold bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    {isShowingOriginal ? '🎨 Comic' : '📷 Original'}
                  </button>
                )}
              </div>
            );
          })}
        </ul>
      </section>

      {canComicify && (
        <div className="flex justify-center mt-4">
          <ComicifyButton
            storyId={storyId}
            panels={panels}
            onPanelDone={handlePanelDone}
          />
        </div>
      )}
    </>
  );
}
