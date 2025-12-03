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

  describe('GET', () => {
    it('should return photos', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      const mockPhotos = [
        { id: '1', storageUrl: 'http://example.com/1.jpg', publicId: 'id1', createdAt: date1 },
        { id: '2', storageUrl: 'http://example.com/2.jpg', publicId: 'id2', createdAt: date2 },
      ];

      vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);

      const response = await GET();
      const data = await response.json();

      expect(data.photos).toHaveLength(2);
      expect(data.photos[0].id).toBe('1');
      expect(data.photos[1].id).toBe('2');
      expect(prisma.photo.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: { id: true, storageUrl: true, publicId: true, createdAt: true },
        take: 60,
      });
    });

    it('should handle errors', async () => {
      vi.mocked(prisma.photo.findMany).mockRejectedValue(new Error('DB error'));

      const response = await GET();
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('internal_error');
    });
  });
});

