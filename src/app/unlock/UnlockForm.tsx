'use client';
import { useState } from 'react';

export default function UnlockForm({ next }: { next: string }) {
  const [pw, setPw] = useState('');
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Enter Access Password</h1>
      <form method="POST" action={`/api/unlock?next=${encodeURIComponent(next)}`}>
        <input
          type="password"
          name="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="w-full border rounded p-2 mb-3"
          autoFocus
          required
        />
        <button className="w-full rounded bg-black text-white p-2">Unlock</button>
      </form>
    </main>
  );
}
