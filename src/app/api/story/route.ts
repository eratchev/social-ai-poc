import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateFunnyStory } from '@/lib/story-llm';

export const runtime = 'nodejs';

// simple timeout wrapper
async function withTimeout<T>(p: Promise<T>, ms = 45000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)) as any
  ]);
}

export async function POST(req: Request) {
  const started = Date.now();
  let storyId: string | null = null;

  try {
    const { roomCode, ownerHandle = 'devuser', style } = await req.json();

    if (!roomCode || typeof roomCode !== 'string') {
      return NextResponse.json({ error: 'roomCode required' }, { status: 400 });
    }

    // 1) Ensure User
    const user = await prisma.user.upsert({
      where: { handle: ownerHandle },
      update: {},
      create: { handle: ownerHandle, displayName: ownerHandle },
      select: { id: true },
    });

    // 2) Ensure Room
    let room = await prisma.room.findUnique({
      where: { code: roomCode },
      select: { id: true },
    });
    if (!room) {
      room = await prisma.room.create({
        data: { code: roomCode, createdBy: user.id },
        select: { id: true },
      });
    }

    // 3) Collect photos
    const photos = await prisma.photo.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storageUrl: true },
      take: 12,
    });
    if (photos.length === 0) {
      return NextResponse.json({ error: 'no_photos_in_room' }, { status: 400 });
    }

    // 4) Create Story in PROCESSING
    const story = await prisma.story.create({
      data: {
        roomId: room.id,
        ownerId: user.id,
        title: 'Generating…',
        narrative: '',
        beatsJson: [],
        panelMap: [],
        status: 'PROCESSING',
      },
      select: { id: true },
    });
    storyId = story.id;

    // 5) Generate with hard timeout + logging
    console.log(`[story ${storyId}] generate start; photos=${photos.length}`);
    const result = await withTimeout(
      generateFunnyStory({
        photos: photos.map(p => ({ id: p.id, url: p.storageUrl })),
        style,
      }),
      45000, // 45s
    );
    console.log(`[story ${storyId}] generate done in ${Date.now() - started}ms`);

    // 6) Persist READY
    await prisma.story.update({
      where: { id: story.id },
      data: {
        title: result.title,
        narrative: result.narrative,
        beatsJson: result.beatsJson as any,
        panelMap: result.panelMap as any,
        status: 'READY',
        model: result.model,
        prompt: result.prompt,
        error: null,
      },
    });

    return NextResponse.json({ id: story.id, status: 'READY' });
  } catch (err: any) {
    console.error('POST /api/story error', err?.message || err);
    // flip to ERROR if we already created a story row
    if (storyId) {
      await prisma.story.update({
        where: { id: storyId },
        data: {
          status: 'ERROR',
          error: String(err?.message || err || 'unknown_error').slice(0, 512),
        },
      });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
