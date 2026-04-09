'use client';

import { useState } from 'react';

type Props = {
  roomCode: string;
  initialName: string | null;
};

export default function RoomNameEditor({ roomCode, initialName }: Props) {
  const [name, setName] = useState<string | null>(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(name ?? '');
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name);
        setEditing(false);
      } else {
        // Restore on failure — silent, no toast (POC)
        setEditing(false);
      }
    } catch {
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  }

  const displayName = name ?? `Room ${roomCode}`;

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold tracking-tight">{displayName}</span>
        <button
          onClick={startEditing}
          aria-label="Rename room"
          className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        maxLength={80}
        autoFocus
        className="text-2xl font-bold border-2 border-indigo-500 rounded-md px-2 py-0.5 outline-none w-64 disabled:opacity-50"
      />
      <button
        onClick={save}
        disabled={saving}
        aria-label={saving ? 'Saving…' : 'Save name'}
        className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={cancel}
        disabled={saving}
        aria-label="Cancel rename"
        className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
