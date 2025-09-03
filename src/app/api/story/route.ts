import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateFunnyStory } from '@/lib/story-llm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

    // 3) Collect photos for this room
    const photos = await prisma.photo.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storageUrl: true },
      take: 12, // cap for POC cost
    });
    if (photos.length === 0) {
      return NextResponse.json({ error: 'no_photos_in_room' }, { status: 400 });
    }

    // 4) Create a Story row in PROCESSING
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

    // 5) Generate (inline for POC)
    const result = await generateFunnyStory({
      photos: photos.map((p) => ({ id: p.id, url: p.storageUrl })),
      style,
    });

    // 6) Persist and mark READY
    await prisma.story.update({
      where: { id: story.id },
      data: {
        title: result.title,
        narrative: result.narrative,
        beatsJson: result.beatsJson as unknown as any,
        panelMap: result.panelMap as unknown as any,
        status: 'READY',
        model: result.model,
        prompt: result.prompt,
      },
    });

    return NextResponse.json({ id: story.id, status: 'READY' });
  } catch (err) {
    console.error('POST /api/story error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
