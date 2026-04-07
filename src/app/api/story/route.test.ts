import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { resolveDefaultProvider } from '@/lib/ai/providers';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: vi.fn() },
    room: { findUnique: vi.fn(), create: vi.fn() },
    photo: { findMany: vi.fn() },
    story: { create: vi.fn() },
  },
}));

vi.mock('@/lib/ai/providers', () => ({
  resolveDefaultProvider: vi.fn(),
}));

describe('/api/story (init)', () => {
  const mockUser = { id: 'user1' };
  const mockRoom = { id: 'room1' };
  const mockPhotos = [
    { id: 'photo1', storageUrl: 'http://example.com/1.jpg' },
    { id: 'photo2', storageUrl: 'http://example.com/2.jpg' },
  ];
  const mockStory = { id: 'story1' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDefaultProvider).mockReturnValue('mock');
  });

  it('should return { id } without running AI', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('story1');
    // init does not return status or model — those come from /run
    expect(data.status).toBeUndefined();
  });

  it('should create story with PROCESSING status and serialized params', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
        quality: 'fast',
        style: 'quirky',
        tone: 'snarky',
        comicAudience: 'adults',
      }),
    });

    await POST(request);

    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PROCESSING',
          prompt: expect.stringContaining('"quality":"fast"'),
        }),
      })
    );
  });

  it('should create room if it does not exist', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'NEWROOM', ownerHandle: 'testuser' }),
    });

    await POST(request);

    expect(prisma.room.create).toHaveBeenCalledWith({
      data: { code: 'NEWROOM', createdBy: 'user1' },
      select: { id: true },
    });
  });

  it('should return 400 when room has no photos', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('no_photos_in_room');
  });

  it('should return 500 on invalid request body', async () => {
    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('should return 500 when user upsert fails', async () => {
    vi.mocked(prisma.user.upsert).mockRejectedValue(new Error('DB error'));

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
