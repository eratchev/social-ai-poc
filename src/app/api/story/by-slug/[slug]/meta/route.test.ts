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

describe('/api/story/by-slug/[slug]/meta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return story meta', async () => {
    const mockStory = {
      model: 'gpt-4',
      prompt: JSON.stringify({ provider: 'openai', quality: 'premium' }),
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = {} as any;
    const params = { params: Promise.resolve({ slug: 'test-slug' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(data.model).toBe('gpt-4');
    expect(data.settings).toEqual({ provider: 'openai', quality: 'premium' });
  });

  it('should return 404 when story not found', async () => {
    vi.mocked(prisma.story.findFirst).mockResolvedValue(null);

    const request = {} as any;
    const params = { params: Promise.resolve({ slug: 'nonexistent' }) };

    const response = await GET(request, params);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('not_found');
  });

  it('should handle missing prompt', async () => {
    const mockStory = {
      model: 'gpt-4',
      prompt: null,
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = {} as any;
    const params = { params: Promise.resolve({ slug: 'test-slug' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(data.model).toBe('gpt-4');
    expect(data.settings).toBeUndefined();
  });

  it('should handle invalid prompt JSON', async () => {
    const mockStory = {
      model: null,
      prompt: 'invalid json{',
    };

    vi.mocked(prisma.story.findFirst).mockResolvedValue(mockStory as any);

    const request = {} as any;
    const params = { params: Promise.resolve({ slug: 'test-slug' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(data.settings).toBeUndefined();
  });

  it('should only query READY stories', async () => {
    vi.mocked(prisma.story.findFirst).mockResolvedValue(null);

    const request = {} as any;
    const params = { params: Promise.resolve({ slug: 'test-slug' }) };

    await GET(request, params);

    expect(prisma.story.findFirst).toHaveBeenCalledWith({
      where: { shareSlug: 'test-slug', status: 'READY' },
      select: { model: true, prompt: true },
    });
  });
});

