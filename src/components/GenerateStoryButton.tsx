// app/components/GenerateStoryButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = 'openai' | 'anthropic' | 'mock' | undefined;
export type Quality = 'fast' | 'balanced' | 'premium';

type Props = {
  roomCode: string;
  ownerHandle?: string;
  className?: string;
  provider?: Provider;
  comicAudience?: 'kids' | 'adults';
  style?: string;
  tone?: string;
  quality?: Quality;
};

export default function GenerateStoryButton({
  roomCode,
  ownerHandle = 'devuser',
  className = '',
  provider,
  comicAudience,
  style,
  tone,
  quality = 'balanced',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err,   setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const clientLabel = `Generate ${comicAudience === 'adults' ? 'Adult' : 'Kids'} Comic`;
  const label = mounted ? clientLabel : 'Generate Story';

  async function onClick() {
    try {
      setLoading(true);
      setErr(null);

      const createRes = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          ownerHandle,
          provider,        // undefined => server resolves default
          comicAudience,   // 'kids' | 'adults'
          style,
          tone,
          quality,         // forwarded to server, maps to a concrete model
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || 'Failed creating story');
      const { id } = createJson;

      const shareRes = await fetch(`/api/story/${id}/share`, { method: 'POST' });
      const shareJson = await shareRes.json();
      if (!shareRes.ok) throw new Error(shareJson.error || 'Failed sharing story');

      // ✅ Stash meta using a key that mirrors the by-slug API path
      try {
        const key = `story-meta:/api/story/by-slug/${shareJson.shareSlug}`;
        const meta = {
          model: createJson.model,      // resolved concrete model id
          settings: createJson.settings // provider/quality/audience/tone/style/panelCount
        };
        sessionStorage.setItem(key, JSON.stringify(meta));
      } catch {}

      router.push(`/s/${shareJson.shareSlug}`);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={onClick}
        disabled={loading}
        className="btn btn-primary"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="ml-1" suppressHydrationWarning>Generating…</span>
          </>
        ) : (
          <span suppressHydrationWarning>✨ {label}</span>
        )}
      </button>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
