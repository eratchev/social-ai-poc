import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getStoryProvider, resolveDefaultProvider } from '@/lib/ai/providers';
import { captionPhotosOpenAI } from '@/lib/ai/captions-openai';
import { getModelForQuality } from '@/lib/ai/config';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: { findUnique: vi.fn(), update: vi.fn() },
    photo: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/ai/providers', () => ({
  getStoryProvider: vi.fn(),
  resolveDefaultProvider: vi.fn(),
}));

vi.mock('@/lib/ai/captions-openai', () => ({
  captionPhotosOpenAI: vi.fn(),
}));

vi.mock('@/lib/ai/config', () => ({
  getModelForQuality: vi.fn(),
}));

describe('POST /api/story/[id]/run', () => {
  const mockProvider = {
    genBeats: vi.fn(),
    genPanels: vi.fn(),
    genNarrative: vi.fn(),
  };

  const mockPrompt = JSON.stringify({
    provider: 'mock',
    quality: 'balanced',
    comicAudience: 'kids',
    audience: 'kids-10-12',
    tone: 'wholesome',
    style: 'funny',
    panelCount: 4,
  });

  const mockStory = { id: 'story1', roomId: 'room1', prompt: mockPrompt, status: 'PROCESSING' };
  const mockPhotos = [
    { id: 'photo1', storageUrl: 'http://example.com/1.jpg' },
    { id: 'photo2', storageUrl: 'http://example.com/2.jpg' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDefaultProvider).mockReturnValue('mock');
    vi.mocked(getStoryProvider).mockReturnValue(mockProvider as any);
    vi.mocked(getModelForQuality).mockReturnValue('mock-model');
  });

  it('should run pipeline and return READY with model and settings', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([{ index: 0, type: 'setup', summary: 'Test' }]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([{ index: 0, photoId: 'photo1' }]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test Story', narrative: 'Test narrative' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('READY');
    expect(data.model).toBe('mock-model');
    expect(data.settings).toBeDefined();
  });

  it('should update phase to beats → panels → narrative in order', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    expect(updateCalls[0][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'beats' } });
    expect(updateCalls[1][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'panels' } });
    expect(updateCalls[2][0]).toMatchObject({ where: { id: 'story1' }, data: { phase: 'narrative' } });
  });

  it('should mark story READY with phase null on success', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const readyCall = updateCalls.find(c => c[0].data.status === 'READY');
    expect(readyCall).toBeDefined();
    expect(readyCall![0].data.phase).toBeNull();
  });

  it('should mark story ERROR with phase null on generation failure', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockRejectedValue(new Error('AI failed'));
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const errorCall = updateCalls.find(c => c[0].data.status === 'ERROR');
    expect(errorCall).toBeDefined();
    expect(errorCall![0]).toMatchObject({
      where: { id: 'story1' },
      data: { status: 'ERROR', phase: null, error: expect.stringContaining('AI failed') },
    });
  });

  it('should return 404 when story not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost/api/story/nonexistent/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should return 400 when story has no prompt', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({ ...mockStory, prompt: null } as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should handle caption failure gracefully and still succeed', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockRejectedValue(new Error('Caption failed'));
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('READY');
  });

  it('should use "Untitled Comic" when genNarrative returns no title', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(mockStory as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({} as any);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story/story1/run', { method: 'POST' });
    await POST(request);

    const updateCalls = vi.mocked(prisma.story.update).mock.calls;
    const readyCall = updateCalls.find(c => c[0].data.status === 'READY');
    expect(readyCall![0].data.title).toBe('Untitled Comic');
    expect(readyCall![0].data.narrative).toBe('');
  });
});
