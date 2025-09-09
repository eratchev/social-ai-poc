'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShareStoryQuick({ storyId }: { storyId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function share() {
    try {
      setBusy(true);
      setErr(null);
      const res = await fetch(`/api/story/${storyId}/share`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to share');
      const { shareSlug } = await res.json();
      router.push(`/s/${shareSlug}`);
    } catch (e: any) {
      setErr(e?.message || 'Error');
      setTimeout(() => setErr(null), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={share}
        disabled={busy}
        className="btn btn-outline text-xs px-3 py-1"
        aria-busy={busy}
        title="Make this story shareable"
      >
        {busy ? 'Sharing…' : 'Share'}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
