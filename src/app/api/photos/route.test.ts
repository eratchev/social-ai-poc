import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    photo: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('/api/photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('should create photo with valid payload', async () => {
      const mockUser = { id: 'user1' };
      const mockRoom = { id: 'room1' };
      const mockPhoto = { id: 'photo1', storageUrl: 'http://example.com/photo.jpg' };

      vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
      vi.mocked(prisma.photo.create).mockResolvedValue(mockPhoto as any);

      const request = new Request('http://localhost/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: 'test-id',
          secureUrl: 'http://example.com/photo.jpg',
          width: 100,
          height: 200,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.photo).toEqual(mockPhoto);
      expect(prisma.photo.create).toHaveBeenCalled();
    });

    it('should create room if it does not exist', async () => {
      const mockUser = { id: 'user1' };
      const mockRoom = { id: 'room1' };
      const mockPhoto = { id: 'photo1' };

      vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.room.create).mockResolvedValue(mockRoom as any);
      vi.mocked(prisma.photo.create).mockResolvedValue(mockPhoto as any);

      const request = new Request('http://localhost/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: 'test-id',
          secureUrl: 'http://example.com/photo.jpg',
          roomCode: 'NEWROOM',
        }),
      });

      await POST(request);

      expect(prisma.room.create).toHaveBeenCalledWith({
        data: {
          code: 'NEWROOM',
          createdBy: 'user1',
        },
        select: { id: true },
      });
    });

    it('should return 400 for invalid payload', async () => {
      const request = new Request('http://localhost/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid body');
    });

    it('should handle errors', async () => {
      vi.mocked(prisma.user.upsert).mockRejectedValue(new Error('DB error'));

      const request = new Request('http://localhost/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: 'test-id',
          secureUrl: 'http://example.com/photo.jpg',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('internal_error');
    });
  });

  // Bug 5 — roomCode not uppercased
  it('should uppercase roomCode before querying/creating room', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhoto = { id: 'photo1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.create).mockResolvedValue(mockPhoto as any);

    const request = new Request('http://localhost/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId: 'test-id',
        secureUrl: 'http://example.com/photo.jpg',
        roomCode: 'devroom',
      }),
    });

    await POST(request);

    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { code: 'DEVROOM' },
      select: { id: true },
    });
    expect(prisma.room.create).toHaveBeenCalledWith({
      data: {
        code: 'DEVROOM',
        createdBy: 'user1',
      },
      select: { id: true },
    });
  });

  // Bug 6 — Invalid Date not validated
  it('should treat an invalid takenAt string as null', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhoto = { id: 'photo1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.create).mockResolvedValue(mockPhoto as any);

    const request = new Request('http://localhost/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId: 'test-id',
        secureUrl: 'http://example.com/photo.jpg',
        takenAt: 'garbage',
      }),
    });

    await POST(request);

    const createCall = vi.mocked(prisma.photo.create).mock.calls[0][0];
    expect(createCall.data.takenAt).toBeNull();
  });

  it('should store a valid takenAt date correctly', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhoto = { id: 'photo1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.create).mockResolvedValue(mockPhoto as any);

    const request = new Request('http://localhost/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId: 'test-id',
        secureUrl: 'http://example.com/photo.jpg',
        takenAt: '2024-06-15T12:00:00Z',
      }),
    });

    await POST(request);

    const createCall = vi.mocked(prisma.photo.create).mock.calls[0][0];
    expect(createCall.data.takenAt).toEqual(new Date('2024-06-15T12:00:00Z'));
  });

  describe('GET', () => {
    // Bug 7 — GET /api/photos returns all photos from all rooms
    it('should return empty array when no roomCode query param is provided', async () => {
      const request = new Request('http://localhost/api/photos', { method: 'GET' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.photos).toEqual([]);
      expect(prisma.photo.findMany).not.toHaveBeenCalled();
    });

    it('should filter photos by roomCode when provided as a query param', async () => {
      const mockRoom = { id: 'room1' };
      const mockPhotos = [
        { id: '1', storageUrl: 'http://example.com/1.jpg', publicId: 'id1', createdAt: new Date('2024-01-01') },
      ];

      vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
      vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);

      const request = new Request('http://localhost/api/photos?roomCode=DEVROOM', { method: 'GET' });

      const response = await GET(request);
      const data = await response.json();

      expect(data.photos).toHaveLength(1);
      expect(prisma.photo.findMany).toHaveBeenCalledWith({
        where: { room: { code: 'DEVROOM' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, storageUrl: true, publicId: true, createdAt: true },
        take: 60,
      });
    });

    it('should uppercase the roomCode query param before filtering', async () => {
      const mockRoom = { id: 'room1' };
      const mockPhotos: any[] = [];

      vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
      vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos);

      const request = new Request('http://localhost/api/photos?roomCode=devroom', { method: 'GET' });

      await GET(request);

      expect(prisma.photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { room: { code: 'DEVROOM' } },
        }),
      );
    });

    it('should return 404 with room_not_found when roomCode does not exist', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

      const request = new Request('http://localhost/api/photos?roomCode=UNKNOWN', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ error: 'room_not_found' });
      expect(prisma.photo.findMany).not.toHaveBeenCalled();
    });

    it('should handle GET errors', async () => {
      vi.mocked(prisma.room.findUnique).mockResolvedValue({ id: 'room1' } as any);
      vi.mocked(prisma.photo.findMany).mockRejectedValue(new Error('DB error'));

      const request = new Request('http://localhost/api/photos?roomCode=DEVROOM', { method: 'GET' });
      const response = await GET(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('internal_error');
    });
  });
});

