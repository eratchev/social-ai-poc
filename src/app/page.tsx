// app/page.tsx
import { prisma } from '@/lib/prisma';
import RoomSwitcher from '@/components/RoomSwitcher';
import RoomList from '@/components/RoomList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const rawRooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      code: true,
      name: true,
      createdAt: true,
      _count: { select: { photos: true, stories: true } },
    },
  });

  // Serialize Date → string for the client component
  const rooms = rawRooms.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

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
        <h2 className="text-sm font-semibold mb-3">Your rooms</h2>
        <RoomList rooms={rooms} />
      </section>
    </main>
  );
}
