import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: {
      findFirst: vi.fn(),
    },
  },
}));

describe('/api/story/by-slug/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return story by slug', async () => {
    const mockStory = {
      id: 'story1',
      title: 'Test Story',
      narrative: 'Test narrative',
      beatsJson: [{ index: 0, type: 'setup', summary: 'Test' }],
      panelMap: [{ index: 0, photoId: 'photo1' }],
      model: 'gpt-4',
      prompt: JSON.stringify({ provider: 'openai', quality: 'balanced' }),
      createdAt: new Date('2024-01-01'),
      room: { code: 'ROOM1' },
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story/by-slug/test-slug');
    const response = await GET(request);
    const data = await response.json();

    expect(data.id).toBe('story1');
    expect(data.title).toBe('Test Story');
    expect(data.roomCode).toBe('ROOM1');
    expect(data.model).toBe('gpt-4');
    expect(data.settings).toEqual({ provider: 'openai', quality: 'balanced' });
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('should return 400 when slug is missing', async () => {
    const request = new Request('http://localhost/api/story/by-slug/');
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('bad_request');
  });

  it('should return 404 when story not found', async () => {
    vi.mocked(prisma.story.findFirst).mockResolvedValue(null);

    const request = new Request('http://localhost/api/story/by-slug/nonexistent');
    const response = await GET(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('not_found');
  });

  it('should handle missing prompt gracefully', async () => {
    const mockStory = {
      id: 'story1',
      title: 'Test',
      narrative: 'Test',
      beatsJson: [],
      panelMap: [],
      model: null,
      prompt: null,
      createdAt: new Date(),
      room: { code: 'ROOM1' },
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story/by-slug/test-slug');
    const response = await GET(request);
    const data = await response.json();

    expect(data.settings).toBeUndefined();
  });

  it('should handle invalid prompt JSON gracefully', async () => {
    const mockStory = {
      id: 'story1',
      title: 'Test',
      narrative: 'Test',
      beatsJson: [],
      panelMap: [],
      model: null,
      prompt: 'invalid json{',
      createdAt: new Date(),
      room: { code: 'ROOM1' },
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = new Request('http://localhost/api/story/by-slug/test-slug');
    const response = await GET(request);
    const data = await response.json();

    expect(data.settings).toBeUndefined();
  });

  it('should only return READY stories', async () => {
    vi.mocked(prisma.story.findFirst).mockResolvedValue(null);

    const request = new Request('http://localhost/api/story/by-slug/test-slug');
    await GET(request);

    expect(prisma.story.findFirst).toHaveBeenCalledWith({
      where: { shareSlug: 'test-slug', status: 'READY' },
      include: { room: { select: { code: true } } },
    });
  });

  it('should handle errors', async () => {
    vi.mocked(prisma.story.findFirst).mockRejectedValue(new Error('DB error'));

    const request = new Request('http://localhost/api/story/by-slug/test-slug');
    const response = await GET(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
  });
});

