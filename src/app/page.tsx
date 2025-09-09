// app/page.tsx
import { prisma } from '@/lib/prisma';
import RoomSwitcher from '@/components/RoomSwitcher';
import Link from 'next/link';

export const runtime = 'nodejs';

export default async function Page() {
  // Fetch recent rooms (limit to 10)
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      code: true,
      createdAt: true,
      photos: { select: { id: true }, take: 1 }, // just to check if room has any photos
    },
  });

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">Funny Photo Story</h1>
        <p className="muted">
          Start by opening an existing room or creating a new one. Each room is like a workspace for
          your photos and stories.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Choose a room</h2>
        <RoomSwitcher />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Recent rooms</h2>
        {rooms.length === 0 ? (
          <p className="muted">No rooms yet — create one above!</p>
        ) : (
          <ul className="divide-y">
            {rooms.map((r) => (
              <li key={r.code} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    href={`/u/${r.code}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {r.code}
                  </Link>
                  <div className="text-xs text-gray-500">
                    Created {r.createdAt.toLocaleDateString()}
                  </div>
                </div>
                {r.photos.length > 0 ? (
                  <span className="inline-block text-xs rounded bg-green-100 text-green-700 px-2 py-0.5">
                    has photos
                  </span>
                ) : (
                  <span className="inline-block text-xs rounded bg-gray-100 text-gray-600 px-2 py-0.5">
                    empty
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
