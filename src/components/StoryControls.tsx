'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GenerateStoryButton from './GenerateStoryButton';

const STYLES = ['funny', 'dramatic', 'quirky', 'epic', 'witty'] as const;
const TONES  = ['wholesome', 'witty', 'sarcastic', 'dark', 'snarky'] as const;
type Style = (typeof STYLES)[number];
type Tone  = (typeof TONES)[number];
type Provider = 'openai' | 'anthropic' | 'mock' | undefined;

type Props = { roomCode: string; ownerHandle?: string };

function lsKey(code: string) {
  return `story-controls:${(code || '').trim().toUpperCase()}`;
}

export default function StoryControls({ roomCode, ownerHandle }: Props) {
  const key = useMemo(() => lsKey(roomCode), [roomCode]);

  // ✅ SSR-safe defaults (match on server and client's first render)
  const [audience, _setAudience] = useState<'kids' | 'adults'>('kids');
  const [style, _setStyle]       = useState<Style>('funny');
  const [tone, _setTone]         = useState<Tone>('wholesome');
  const [provider, _setProvider] = useState<Provider>(undefined);

  // mark dirty only on *user* interactions
  const dirty = useRef(false);
  const setAudience = (v: 'kids' | 'adults') => { dirty.current = true; _setAudience(v); };
  const setStyle    = (v: Style)               => { dirty.current = true; _setStyle(v); };
  const setTone     = (v: Tone)                => { dirty.current = true; _setTone(v); };
  const setProvider = (v: Provider)            => { dirty.current = true; _setProvider(v); };

  // ✅ Load saved values AFTER mount (no SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // IMPORTANT: use internal setters so we don't mark dirty during load
      if (saved.audience === 'kids' || saved.audience === 'adults') _setAudience(saved.audience);
      if (typeof saved.style === 'string' && (STYLES as readonly string[]).includes(saved.style)) _setStyle(saved.style as Style);
      if (typeof saved.tone === 'string' && (TONES as readonly string[]).includes(saved.tone)) _setTone(saved.tone as Tone);
      if (saved.provider === 'openai' || saved.provider === 'anthropic' || saved.provider === 'mock' || saved.provider == null) {
        _setProvider(saved.provider ?? undefined);
      }
    } catch (e) {
      console.error('[StoryControls] INIT_READ_ERROR', e);
    }
  }, [key]);

  // Save only when user changed something
  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(key, JSON.stringify({ audience, style, tone, provider }));
    } catch (e) {
      console.error('[StoryControls] SAVE_ERROR', { key, error: e });
    }
  }, [key, audience, style, tone, provider]);

  // Audience helpers: gentle defaults only if user hasn't changed anything yet
  const pickKids = () => {
    setAudience('kids');
    if (!dirty.current) {
      if (tone === 'sarcastic' || tone === 'dark') setTone('wholesome');
      if (style === 'witty') setStyle('funny');
    }
  };
  const pickAdults = () => {
    setAudience('adults');
    if (!dirty.current) {
      if (tone === 'wholesome') setTone('witty');
    }
  };

  // (Optional) show summary only after mount if you want to be extra-safe for hydration of text
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="space-y-4">
      {mounted && (
        <div className="text-xs text-gray-600" suppressHydrationWarning>
          Preset: <span className="font-medium">{audience}</span> · Style <span className="font-medium">{style}</span> · Tone <span className="font-medium">{tone}</span> · Provider <span className="font-medium">{provider ?? '(env default)'}</span>
        </div>
      )}

      {/* Audience */}
      <div className="flex gap-2">
        <button
          onClick={pickKids}
          className={`btn ${audience === 'kids' ? 'btn-primary' : 'btn-outline'}`}
        >
          Kids
        </button>
        <button
          onClick={pickAdults}
          className={`btn ${audience === 'adults' ? 'btn-primary' : 'btn-outline'}`}
        >
          Adults
        </button>
      </div>

      {/* Style / Tone / Provider */}
      <div className="flex gap-2">
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={style}
          onChange={(e) => setStyle(e.target.value as Style)}
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
        >
          {TONES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={provider ?? ''}
          onChange={(e) => setProvider((e.target.value || undefined) as Provider)}
        >
          <option value="">(env default)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="mock">Mock</option>
        </select>
      </div>

      <GenerateStoryButton
        roomCode={roomCode}
        ownerHandle={ownerHandle}
        comicAudience={audience}
        style={style}
        tone={tone}
        provider={provider}
      />
    </div>
  );
}
