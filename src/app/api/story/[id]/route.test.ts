import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: {
      findUnique: vi.fn(),
    },
  },
}));

describe('/api/story/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return story when found', async () => {
    const mockStory = {
      id: 'story1',
      title: 'Test Story',
      narrative: 'Test narrative',
      status: 'READY',
      beatsJson: [{ index: 0, type: 'setup', summary: 'Test' }],
      panelMap: [{ index: 0, photoId: 'photo1' }],
      shareSlug: 'test-slug',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      room: { code: 'ROOM1' },
    };

    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story/story1');
    const response = await GET(request);
    const data = await response.json();

    expect(data.id).toBe('story1');
    expect(data.title).toBe('Test Story');
    expect(data.roomCode).toBe('ROOM1');
    expect(data.status).toBe('READY');
    expect(prisma.story.findUnique).toHaveBeenCalledWith({
      where: { id: 'story1' },
      include: { room: { select: { code: true } } },
    });
  });

  it('should return 404 when story not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost/api/story/nonexistent');
    const response = await GET(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('not_found');
  });

  it('should return 400 when id is missing', async () => {
    const request = new Request('http://localhost/api/story/');
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
  });

  it('should handle errors', async () => {
    vi.mocked(prisma.story.findUnique).mockRejectedValue(new Error('DB error'));

    const request = new Request('http://localhost/api/story/story1');
    const response = await GET(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
  });
});

