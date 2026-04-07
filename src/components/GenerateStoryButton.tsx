'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = 'openai' | 'anthropic' | 'mock' | undefined;
type Phase = 'beats' | 'panels' | 'narrative' | null;
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

const STEPS: { key: NonNullable<Phase>; label: string }[] = [
  { key: 'beats', label: 'Beats' },
  { key: 'panels', label: 'Panels' },
  { key: 'narrative', label: 'Narrative' },
];

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
  const [phase, setPhase] = useState<Phase>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clientLabel = `Generate ${comicAudience === 'adults' ? 'Adult' : 'Kids'} Comic`;
  const label = mounted ? clientLabel : 'Generate Story';

  function pollUntilDone(id: string): Promise<void> {
    let failCount = 0;
    return new Promise<void>((resolve, reject) => {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/story/${id}`);
          const j = await r.json();
          failCount = 0;

          if (j.phase) setPhase(j.phase as Phase);

          if (j.status === 'READY') {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            resolve();
          } else if (j.status === 'ERROR') {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            reject(new Error('Generation failed'));
          }
        } catch {
          failCount++;
          if (failCount >= 5) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            reject(new Error('Connection error'));
          }
        }
      }, 1500);
    });
  }

  async function onClick() {
    try {
      setLoading(true);
      setErr(null);
      setPhase(null);

      // Step 1: init — create story row, get id back immediately
      const initRes = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode, ownerHandle, provider, comicAudience, style, tone, quality }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok) throw new Error(initJson.error || 'Failed creating story');
      const { id } = initJson;

      // Step 2: fire run (don't await yet) + poll in parallel
      // run failure is non-fatal here — polling drives completion via DB status
      const runPromise = fetch(`/api/story/${id}/run`, { method: 'POST' })
        .then((r) => r.json())
        .catch(() => null);

      await pollUntilDone(id);

      const runJson = await runPromise;

      // Step 3: share
      const shareRes = await fetch(`/api/story/${id}/share`, { method: 'POST' });
      const shareJson = await shareRes.json();
      if (!shareRes.ok) throw new Error(shareJson.error || 'Failed sharing story');

      // Stash meta in sessionStorage for the story page to pick up
      try {
        const key = `story-meta:/api/story/by-slug/${shareJson.shareSlug}`;
        sessionStorage.setItem(key, JSON.stringify({
          model: runJson?.model,
          settings: runJson?.settings,
        }));
      } catch {}

      router.push(`/s/${shareJson.shareSlug}`);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  const phaseIndex = phase ? STEPS.findIndex((s) => s.key === phase) : -1;

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
            <span className="ml-1">Generating…</span>
          </>
        ) : (
          <span suppressHydrationWarning>✨ {label}</span>
        )}
      </button>

      {loading && (
        <div className="mt-3 space-y-1.5">
          {STEPS.map((step, i) => {
            const done = i < phaseIndex;
            const active = i === phaseIndex;
            return (
              <div key={step.key} className="flex items-center gap-2 text-sm">
                {done ? (
                  <span className="text-green-600 font-bold w-3">✓</span>
                ) : active ? (
                  <svg className="h-3 w-3 animate-spin text-blue-500 shrink-0" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                ) : (
                  <span className="text-gray-400 w-3">○</span>
                )}
                <span className={done ? 'line-through text-gray-400' : active ? 'font-medium' : 'text-gray-500'}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
