'use client';

import { useState } from 'react';
import GenerateStoryButton from './GenerateStoryButton';

type Props = {
  roomCode: string;
  ownerHandle?: string;
};

const STYLES = ['funny', 'dramatic', 'quirky', 'epic', 'witty'];
const TONES = ['wholesome', 'witty', 'sarcastic', 'dark', 'snarky'];

export default function StoryControls({ roomCode, ownerHandle }: Props) {
  const [audience, setAudience] = useState<'kids' | 'adults'>('kids');
  const [style, setStyle] = useState<string>('funny');
  const [tone, setTone] = useState<string>('wholesome');

  return (
    <div className="space-y-6">
      {/* Audience toggle */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Audience</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAudience('kids');
              if (style === 'witty') setStyle('funny');
              if (tone === 'sarcastic' || tone === 'dark') setTone('wholesome');
            }}
            className={`btn ${audience === 'kids' ? 'btn-primary' : 'btn-outline'}`}
          >
            Kids
          </button>
          <button
            onClick={() => {
              setAudience('adults');
              if (tone === 'wholesome') setTone('witty');
            }}
            className={`btn ${audience === 'adults' ? 'btn-primary' : 'btn-outline'}`}
          >
            Adults
          </button>
        </div>
      </div>

      {/* Style dropdown */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Style</h3>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Tone dropdown */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Tone</h3>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Generate button */}
      <GenerateStoryButton
        roomCode={roomCode}
        ownerHandle={ownerHandle}
        comicAudience={audience}
        style={style}
        tone={tone}
        label={`Generate ${audience === 'kids' ? 'Kids' : 'Adult'} Comic`}
      />
    </div>
  );
}
