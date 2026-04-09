'use client';

import { useState } from 'react';
import Link from 'next/link';

type Room = {
  code: string;
  name: string | null;
  createdAt: string;
  _count: { photos: number; stories: number };
};

export default function RoomList({ rooms: initialRooms }: { rooms: Room[] }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  async function handleDelete(code: string) {
    const confirmed = window.confirm(`Delete room ${code}? This will remove all photos and stories.`);
    if (!confirmed) return;

    const index = rooms.findIndex((r) => r.code === code);
    const room = rooms[index];
    if (!room) return;

    // Optimistic remove
    setRooms((prev) => prev.filter((r) => r.code !== code));

    try {
      const res = await fetch(`/api/rooms/${code}`, { method: 'DELETE' });
      // 404 means already gone — treat as success
      if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    } catch {
      // Restore at original position
      setRooms((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, room);
        return next;
      });
    }
  }

  if (rooms.length === 0) {
    return <p className="muted">No rooms yet — create one above!</p>;
  }

  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li
          key={r.code}
          className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            {r.name ? (
              <div className="font-semibold text-gray-900">{r.name}</div>
            ) : (
              <div className="font-semibold text-gray-400 italic">Untitled room</div>
            )}
            <div className="text-xs text-gray-400 font-mono">{r.code}</div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-gray-500">{r._count.photos} photos</span>
              <span className="text-xs text-gray-500">{r._count.stories} stories</span>
              <span className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/u/${r.code}`}
              className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
            >
              Open
            </Link>
            <button
              onClick={() => handleDelete(r.code)}
              aria-label="Delete room"
              className="text-xs px-3 py-1.5 rounded-md bg-red-50 text-red-600 border border-red-200 font-medium hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
