// app/components/StoryMetaCard.tsx
'use client';

import { useEffect, useState } from 'react';

type Settings = {
  provider: 'openai' | 'anthropic' | 'mock';
  quality: 'fast' | 'balanced' | 'premium';
  comicAudience: 'kids' | 'adults';
  audience?: string;
  tone?: string;
  style?: string;
  panelCount?: number;
};

type Props = { shareSlug: string };

export default function StoryMetaCard({ shareSlug }: Props) {
  const [model, setModel] = useState<string | undefined>();
  const [settings, setSettings] = useState<Settings | undefined>();

  useEffect(() => {
    // ✅ Try session cache first (mirrors the by-slug API path)
    const key = `story-meta:/api/story/by-slug/${shareSlug}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        setModel(parsed.model);
        setSettings(parsed.settings);
        return;
      }
    } catch {}

    // Fallback to server
    let alive = true;
    fetch(`/api/story/by-slug/${shareSlug}/meta`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { if (alive) { setModel(data.model); setSettings(data.settings); } })
      .catch(() => {})
    return () => { alive = false; };
  }, [shareSlug]);

  if (!settings && !model) return null;

  return (
    <div className="mt-4 rounded-xl border p-4 text-sm">
      <div className="mb-2 font-semibold">Generation settings</div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
        {model && <div><dt className="text-gray-500">Resolved model</dt><dd className="font-mono">{model}</dd></div>}
        {settings?.provider && <div><dt className="text-gray-500">Provider</dt><dd className="font-mono">{settings.provider}</dd></div>}
        {settings?.quality && <div><dt className="text-gray-500">Quality</dt><dd className="font-mono">{settings.quality}</dd></div>}
        {settings?.comicAudience && <div><dt className="text-gray-500">Comic audience</dt><dd className="font-mono">{settings.comicAudience}</dd></div>}
        {settings?.audience && <div><dt className="text-gray-500">Audience prompt</dt><dd className="font-mono">{settings.audience}</dd></div>}
        {settings?.style && <div><dt className="text-gray-500">Style</dt><dd className="font-mono">{settings.style}</dd></div>}
        {settings?.tone && <div><dt className="text-gray-500">Tone</dt><dd className="font-mono">{settings.tone}</dd></div>}
        {typeof settings?.panelCount === 'number' && <div><dt className="text-gray-500">Panel count</dt><dd className="font-mono">{settings.panelCount}</dd></div>}
      </dl>
    </div>
  );
}
