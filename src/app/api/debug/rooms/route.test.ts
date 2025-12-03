import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('/api/debug/rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return rooms list', async () => {
    const mockRooms = [
      { id: '1', code: 'ROOM1', createdAt: new Date('2024-01-01') },
      { id: '2', code: 'ROOM2', createdAt: new Date('2024-01-02') },
    ];

    vi.mocked(prisma.room.findMany).mockResolvedValue(mockRooms as any);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([{ current_database: 'test_db' }] as any);

    const response = await GET();
    const data = await response.json();

    expect(data.count).toBe(2);
    expect(data.rooms).toHaveLength(2);
    expect(data.rooms[0].code).toBe('ROOM1');
    expect(data.dbInfo).toEqual({ current_database: 'test_db' });
    expect(prisma.room.findMany).toHaveBeenCalledWith({
      select: { id: true, code: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('should handle missing db info gracefully', async () => {
    const mockRooms = [{ id: '1', code: 'ROOM1', createdAt: new Date() }];

    vi.mocked(prisma.room.findMany).mockResolvedValue(mockRooms as any);
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValue(new Error('Permission denied'));

    const response = await GET();
    const data = await response.json();

    expect(data.count).toBe(1);
    expect(data.dbInfo).toBeNull();
  });

  it('should handle errors', async () => {
    vi.mocked(prisma.room.findMany).mockRejectedValue(new Error('DB error'));

    const response = await GET();
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('DB error');
  });
});

