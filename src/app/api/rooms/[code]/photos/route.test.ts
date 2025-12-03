import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
    },
  },
}));

describe('/api/rooms/[code]/photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return photos for room', async () => {
    const mockRoom = {
      photos: [
        {
          id: 'photo1',
          storageUrl: 'http://example.com/1.jpg',
          width: 100,
          height: 200,
          publicId: 'id1',
        },
        {
          id: 'photo2',
          storageUrl: 'http://example.com/2.jpg',
          width: 150,
          height: 250,
          publicId: 'id2',
        },
      ],
    };

    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);

    const request = {} as any;
    const ctx = { params: Promise.resolve({ code: 'testroom' }) };

    const response = await GET(request, ctx);
    const data = await response.json();

    expect(data.photos).toEqual(mockRoom.photos);
    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { code: 'TESTROOM' },
      select: {
        photos: {
          select: { id: true, storageUrl: true, width: true, height: true, publicId: true },
          orderBy: { createdAt: 'desc' },
          take: 60,
        },
      },
    });
  });

  it('should return empty array when room not found', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const request = {} as any;
    const ctx = { params: Promise.resolve({ code: 'nonexistent' }) };

    const response = await GET(request, ctx);
    const data = await response.json();

    expect(data.photos).toEqual([]);
  });

  it('should uppercase room code', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ photos: [] } as any);

    const request = {} as any;
    const ctx = { params: Promise.resolve({ code: 'lowercase' }) };

    await GET(request, ctx);

    expect(prisma.room.findUnique).toHaveBeenCalledWith({
      where: { code: 'LOWERCASE' },
      select: expect.any(Object),
    });
  });

  it('should handle errors', async () => {
    vi.mocked(prisma.room.findUnique).mockRejectedValue(new Error('DB error'));

    const request = {} as any;
    const ctx = { params: Promise.resolve({ code: 'testroom' }) };

    const response = await GET(request, ctx);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
  });
});

