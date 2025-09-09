// components/RoomSwitcher.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomSwitcher() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function normalizedCode(v: string) {
    return v.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }

  async function openRoom() {
    const c = normalizedCode(code);
    if (!c) {
      setErr('Enter a room code');
      setTimeout(() => setErr(null), 1500);
      return;
    }
    router.push(`/u/${c}`);
  }

  async function createRandom() {
    try {
      setBusy(true);
      setErr(null);
      const res = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' } });
      if (!res.ok) throw new Error('Failed to create room');
      const { code } = await res.json();
      router.push(`/u/${code}`);
    } catch (e: any) {
      setErr(e?.message || 'Unexpected error');
      setTimeout(() => setErr(null), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && openRoom()}
        placeholder="Enter room code (e.g., DEVROOM)"
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
      />
      <button
        onClick={openRoom}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        disabled={busy}
      >
        Open room
      </button>
      <button
        onClick={createRandom}
        className="rounded-lg bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
        disabled={busy}
      >
        {busy ? 'Creating…' : 'Create random room'}
      </button>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
