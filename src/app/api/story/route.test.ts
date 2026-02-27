import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { getStoryProvider, resolveDefaultProvider } from '@/lib/ai/providers';
import { captionPhotosOpenAI } from '@/lib/ai/captions-openai';
import { getModelForQuality } from '@/lib/ai/config';

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
      findMany: vi.fn(),
      update: vi.fn(),
    },
    story: {
      create: vi.fn(),
      update: vi.fn(),
    },
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

describe('/api/story', () => {
  const mockProvider = {
    genBeats: vi.fn(),
    genPanels: vi.fn(),
    genNarrative: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDefaultProvider).mockReturnValue('mock');
    vi.mocked(getStoryProvider).mockReturnValue(mockProvider as any);
    vi.mocked(getModelForQuality).mockReturnValue('mock-model');
  });

  it('should create story successfully', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [
      { id: 'photo1', storageUrl: 'http://example.com/1.jpg' },
      { id: 'photo2', storageUrl: 'http://example.com/2.jpg' },
    ];
    const mockStory = { id: 'story1' };
    const mockBeats = [{ index: 0, type: 'setup' as const, summary: 'Test' }];
    const mockPanels = [{ index: 0, photoId: 'photo1' }];
    const mockNarrative = { title: 'Test Story', narrative: 'Test narrative' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue(mockBeats);
    vi.mocked(mockProvider.genPanels).mockResolvedValue(mockPanels);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue(mockNarrative);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.id).toBe('story1');
    expect(data.status).toBe('READY');
    expect(prisma.story.create).toHaveBeenCalled();
    expect(prisma.story.update).toHaveBeenCalled();
  });

  it('should create room if it does not exist', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.room.create).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'NEWROOM',
        ownerHandle: 'testuser',
      }),
    });

    await POST(request);

    expect(prisma.room.create).toHaveBeenCalledWith({
      data: { code: 'NEWROOM', createdBy: 'user1' },
      select: { id: true },
    });
  });

  it('should return error when no photos in room', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('no_photos_in_room');
  });

  it('should use provided provider', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
        provider: 'openai',
      }),
    });

    await POST(request);

    expect(getStoryProvider).toHaveBeenCalledWith('openai');
  });

  it('should handle caption generation failure gracefully', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockRejectedValue(new Error('Caption error'));
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    const response = await POST(request);
    // Should still succeed despite caption failure
    expect(response.status).toBe(200);
  });

  it('should handle generation errors and mark story as ERROR', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockRejectedValue(new Error('Generation failed'));
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
    expect(prisma.story.update).toHaveBeenCalledWith({
      where: { id: 'story1' },
      data: {
        status: 'ERROR',
        error: expect.stringContaining('Generation failed'),
      },
    });
  });

  it('should use custom panel count', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = Array.from({ length: 10 }, (_, i) => ({
      id: `photo${i}`,
      storageUrl: `http://example.com/${i}.jpg`,
    }));
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
        panelCount: 8,
      }),
    });

    await POST(request);

    expect(mockProvider.genPanels).toHaveBeenCalledWith(
      expect.objectContaining({ panelCount: 8 })
    );
  });

  it('should handle invalid request body', async () => {
    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('should persist captions to database', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };
    const mockCaptions = [
      { id: 'photo1', caption: 'Test caption', tags: ['test'] },
    ];

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue(mockCaptions);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({ title: 'Test', narrative: '' });
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    await POST(request);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should handle story update failure in error handler', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockRejectedValue(new Error('Generation failed'));
    vi.mocked(prisma.story.update).mockRejectedValue(new Error('Update failed'));

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'TESTROOM',
        ownerHandle: 'testuser',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('should use "Untitled Comic" fallback when genNarrative returns object without title', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    // genNarrative returns an object with neither title nor narrative
    vi.mocked(mockProvider.genNarrative).mockResolvedValue({} as any);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    await POST(request);

    // The story update should use "Untitled Comic" as title and "" as narrative
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Untitled Comic', narrative: '' }),
      })
    );
  });

  it('should produce empty narrative when genNarrative returns a plain string (legacy return type discarded)', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    // genNarrative returns a plain string (legacy provider behaviour)
    vi.mocked(mockProvider.genNarrative).mockResolvedValue('Plain string narrative' as any);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    await POST(request);

    // title falls back to "Untitled Comic", narrative falls back to "" (plain strings have no .narrative)
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Untitled Comic',
          narrative: '',
        }),
      })
    );
  });

  it('should warn when genNarrative returns a plain string (unexpected type)', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { id: 'room1' };
    const mockPhotos = [{ id: 'photo1', storageUrl: 'http://example.com/1.jpg' }];
    const mockStory = { id: 'story1' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.findUnique).mockResolvedValue(mockRoom as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue(mockPhotos as any);
    vi.mocked(prisma.story.create).mockResolvedValue(mockStory as any);
    vi.mocked(captionPhotosOpenAI).mockResolvedValue([]);
    vi.mocked(mockProvider.genBeats).mockResolvedValue([]);
    vi.mocked(mockProvider.genPanels).mockResolvedValue([]);
    // Legacy provider returns a plain string instead of { title, narrative }
    vi.mocked(mockProvider.genNarrative).mockResolvedValue('Some plain string' as any);
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    await POST(request);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unexpected'),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('should return 500 and not call story update when error occurs before story creation', async () => {
    vi.mocked(prisma.user.upsert).mockRejectedValue(null);

    const request = new Request('http://localhost/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
    // storyId was never set, so story.update should NOT have been called
    expect(prisma.story.update).not.toHaveBeenCalled();
  });
});

