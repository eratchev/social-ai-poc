'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  roomCode: string;
  ownerHandle?: string; // default 'devuser'
  className?: string;
  label?: string;
};

export default function RegenerateButton({
  roomCode,
  ownerHandle = 'devuser',
  className = '',
  label = 'Regenerate Story',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onClick() {
    try {
      setLoading(true);
      setErr(null);

      // 1) Create a new story
      const createRes = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode, ownerHandle }),
      });
      if (!createRes.ok) {
        const j = await createRes.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed creating story');
      }
      const { id } = await createRes.json();

      // 2) Make it shareable
      const shareRes = await fetch(`/api/story/${id}/share`, { method: 'POST' });
      if (!shareRes.ok) {
        const j = await shareRes.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed sharing story');
      }
      const { shareSlug } = await shareRes.json();

      // 3) Navigate to the new slug
      router.push(`/s/${shareSlug}`);
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
        className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            Regenerating…
          </>
        ) : (
          <>
            <span aria-hidden>🔁</span> {label}
          </>
        )}
      </button>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
