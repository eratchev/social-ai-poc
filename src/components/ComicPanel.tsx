'use client';

import Image from 'next/image';
import { blurDataURL } from '@/lib/blur';

type Bubble = { text: string; speaker?: string; aside?: boolean };

export type ComicPanelProps = {
  index: number;
  narration?: string;
  bubbles?: Bubble[];
  sfx?: string[];
  photoUrl?: string | null;
  generatedImageUrl?: string | null;
  alt?: string;
};

function BubbleChip({ b }: { b: Bubble }) {
  return (
    <div
      className={[
        'inline-flex items-start gap-1 rounded-2xl px-3 py-1.5',
        'border bg-white/90 shadow text-zinc-800',
        'dark:bg-zinc-800/90 dark:border-zinc-700 dark:text-zinc-200',
        b.aside ? 'opacity-80 italic' : 'font-medium',
      ].join(' ')}
    >
      {b.speaker ? <span className="font-semibold">{b.speaker}:</span> : null}
      <span>{b.text}</span>
    </div>
  );
}

export default function ComicPanel({
  index,
  narration,
  bubbles,
  sfx,
  photoUrl,
  generatedImageUrl,
  alt,
}: ComicPanelProps) {
  return (
    <li
      className="relative overflow-hidden bg-zinc-800"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Photo or large-number fallback */}
      {(generatedImageUrl ?? photoUrl) ? (
        <Image
          src={(generatedImageUrl ?? photoUrl)!}
          alt={alt ?? `Panel ${index + 1}`}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          priority={index < 2}
          placeholder="blur"
          blurDataURL={blurDataURL(16, 12)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-black text-zinc-600">{index + 1}</span>
        </div>
      )}

      {/* Panel number badge — top-left */}
      <div className="absolute top-2 left-2 z-20 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
        {index + 1}
      </div>

      {/* SFX — top-right */}
      {sfx?.length ? (
        <div className="absolute top-2 right-2 z-20 font-black text-yellow-300 text-sm uppercase tracking-widest drop-shadow">
          {sfx.join(' ')}
        </div>
      ) : null}

      {/* Bottom overlay: bubble chips above caption box */}
      <div className="absolute inset-0 flex flex-col justify-end z-10">
        {bubbles?.length ? (
          <div className="flex flex-wrap justify-center gap-1.5 px-2 pb-1">
            {/* Show up to 2 bubble chips — matches COMIC_LIMITS.bubblesPerPanel in structured.ts */}
            {bubbles.slice(0, 2).map((b, i) => (
              <BubbleChip key={i} b={b} />
            ))}
          </div>
        ) : null}
        {narration ? (
          <div className="bg-black/70 text-white text-sm px-3 py-2 leading-snug line-clamp-4">
            {narration}
          </div>
        ) : null}
      </div>
    </li>
  );
}
