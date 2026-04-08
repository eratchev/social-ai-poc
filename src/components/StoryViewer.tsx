'use client';

import { useState } from 'react';
import ComicPanel from './ComicPanel';
import ComicifyButton from './ComicifyButton';
import type { Panel } from '@/lib/ai/structured';

type StoryViewerProps = {
  storyId: string;
  initialPanels: Panel[];
  photoUrlById: Record<string, string>;
};

export default function StoryViewer({ storyId, initialPanels, photoUrlById }: StoryViewerProps) {
  const [panels, setPanels] = useState<Panel[]>(initialPanels);

  function handlePanelDone(index: number, url: string) {
    setPanels((prev) => prev.map((p) => (p.index === index ? { ...p, generatedImageUrl: url } : p)));
  }

  return (
    <>
      <section className="border-2 border-black dark:border-zinc-700">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-black dark:bg-zinc-700">
          {panels.map((p) => (
            <ComicPanel
              key={p.index}
              index={p.index}
              narration={p.narration}
              bubbles={p.bubbles}
              sfx={p.sfx}
              photoUrl={p.photoId ? (photoUrlById[p.photoId] ?? null) : null}
              generatedImageUrl={p.generatedImageUrl ?? null}
              alt={p.alt}
            />
          ))}
        </ul>
      </section>

      <div className="flex justify-center mt-4">
        <ComicifyButton
          storyId={storyId}
          panels={panels}
          onPanelDone={handlePanelDone}
        />
      </div>
    </>
  );
}
