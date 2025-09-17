'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GenerateStoryButton from './GenerateStoryButton';

type Quality = 'fast' | 'balanced' | 'premium';
const QUALITY_LABEL: Record<Quality, string> = {
  fast: 'Fast', balanced: 'Balanced', premium: 'Premium'
};

const STYLES = ['funny', 'dramatic', 'quirky', 'epic', 'witty'] as const;
const TONES  = ['wholesome', 'witty', 'sarcastic', 'dark', 'snarky'] as const;
type Style = (typeof STYLES)[number];
type Tone  = (typeof TONES)[number];
type Provider = 'openai' | 'anthropic' | 'mock' | undefined;
type Props = { roomCode: string; ownerHandle?: string };

type Availability = {
  openai: boolean;
  anthropic: boolean;
  mock: boolean;
  default: 'openai' | 'anthropic' | 'mock';
};

function lsKey(code: string) {
  return `story-controls:${(code || '').trim().toUpperCase()}`;
}

export default function StoryControls({ roomCode, ownerHandle }: Props) {
  const key = useMemo(() => lsKey(roomCode), [roomCode]);

  const [audience, _setAudience] = useState<'kids' | 'adults'>('kids');
  const [style, _setStyle]       = useState<Style>('funny');
  const [tone, _setTone]         = useState<Tone>('wholesome');
  const [provider, _setProvider] = useState<Provider>(undefined);
  const [quality, _setQuality]   = useState<Quality>('balanced');

  const [avail, setAvail] = useState<Availability>({
    openai: false, anthropic: false, mock: true, default: 'mock',
  });

  const dirty = useRef(false);
  const setAudience = (v: 'kids' | 'adults') => { dirty.current = true; _setAudience(v); };
  const setStyle    = (v: Style)               => { dirty.current = true; _setStyle(v); };
  const setTone     = (v: Tone)                => { dirty.current = true; _setTone(v); };
  const setProvider = (v: Provider)            => { dirty.current = true; _setProvider(v); };
  const setQuality  = (v: Quality)             => { dirty.current = true; _setQuality(v); };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.audience === 'kids' || saved.audience === 'adults') _setAudience(saved.audience);
      if (typeof saved.style === 'string' && (STYLES as readonly string[]).includes(saved.style)) _setStyle(saved.style as Style);
      if (typeof saved.tone === 'string' && (TONES as readonly string[]).includes(saved.tone)) _setTone(saved.tone as Tone);
      if (saved.provider === 'openai' || saved.provider === 'anthropic' || saved.provider === 'mock' || saved.provider == null) {
        _setProvider(saved.provider ?? undefined);
      }
      if (saved.quality === 'fast' || saved.quality === 'balanced' || saved.quality === 'premium') {
        _setQuality(saved.quality as Quality);
      }
    } catch (e) {
      console.error('[StoryControls] INIT_READ_ERROR', e);
    }
  }, [key]);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/providers')
      .then(r => r.json())
      .then((a: Availability) => { if (alive) setAvail(a); })
      .catch(() => { /* non-fatal */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(key, JSON.stringify({ audience, style, tone, provider, quality }));
    } catch (e) {
      console.error('[StoryControls] SAVE_ERROR', { key, error: e });
    }
  }, [key, audience, style, tone, provider, quality]);

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

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const providerLabel = provider ?? `(default: ${avail.default})`;
  const qualityLabel = QUALITY_LABEL[quality];

  return (
    <div className="space-y-4">
      {mounted && (
        <div className="text-xs text-gray-600" suppressHydrationWarning>
          Preset: <span className="font-medium">{audience}</span> · Style <span className="font-medium">{style}</span> · Tone <span className="font-medium">{tone}</span> · Provider <span className="font-medium">{providerLabel}</span> · Quality <span className="font-medium">{qualityLabel}</span>
        </div>
      )}

      {/* Audience */}
      <div className="flex gap-2">
        <button onClick={pickKids} className={`btn ${audience === 'kids' ? 'btn-primary' : 'btn-outline'}`}>Kids</button>
        <button onClick={pickAdults} className={`btn ${audience === 'adults' ? 'btn-primary' : 'btn-outline'}`}>Adults</button>
      </div>

      {/* Style / Tone / Provider / Quality */}
      <div className="flex flex-wrap gap-2">
        <select className="rounded-lg border px-3 py-2 text-sm" value={style} onChange={(e) => setStyle(e.target.value as Style)}>
          {STYLES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>

        <select className="rounded-lg border px-3 py-2 text-sm" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
          {TONES.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>

        <select className="rounded-lg border px-3 py-2 text-sm" value={provider ?? ''} onChange={(e) => setProvider((e.target.value || undefined) as Provider)} title={provider ?? `Default: ${avail.default}`}>
          <option value="">{`(default: ${avail.default})`}</option>
          <option value="openai" disabled={!avail.openai}>OpenAI</option>
          <option value="anthropic" disabled={!avail.anthropic}>Anthropic</option>
          <option value="mock" disabled={!avail.mock}>Mock</option>
        </select>

        <select className="rounded-lg border px-3 py-2 text-sm" value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
          <option value="fast">Fast</option>
          <option value="balanced">Balanced (default)</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      <GenerateStoryButton
        roomCode={roomCode}
        ownerHandle={ownerHandle}
        comicAudience={audience}
        style={style}
        tone={tone}
        provider={provider}
        // NOTE: Pass through for newer API. If your current GenerateStoryButton
        // type doesn't include `quality`, you can either add it there or ignore
        // TS by uncommenting the next line.
        // @ts-ignore
        quality={quality}
      />
    </div>
  );
}
