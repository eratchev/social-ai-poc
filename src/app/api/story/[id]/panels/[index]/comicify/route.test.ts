import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';

const { mockImagesEdit } = vi.hoisted(() => ({ mockImagesEdit: vi.fn() }));
const { mockUpload } = vi.hoisted(() => ({ mockUpload: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: { findUnique: vi.fn(), update: vi.fn() },
    photo: { findUnique: vi.fn() },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn().mockReturnValue({ images: { edit: mockImagesEdit } }),
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload: mockUpload } },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeParams(id: string, index: string) {
  return { params: Promise.resolve({ id, index }) };
}

const readyStory = {
  status: 'READY',
  panelMap: [
    { index: 0, photoId: 'photo-1', narration: 'The hero leaps.' },
    { index: 1, photoId: 'photo-2', narration: 'Villain laughs.' },
  ],
};

describe('POST /api/story/[id]/panels/[index]/comicify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.story.update).mockResolvedValue({} as any);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as any);
    mockImagesEdit.mockResolvedValue({ data: [{ b64_json: 'abc123' }] });
    mockUpload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/comic.png' });
  });

  it('returns 404 when story not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(null);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when story is not READY', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({
      ...readyStory,
      status: 'PROCESSING',
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('story_not_ready');
  });

  it('returns 404 when panel index does not exist', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '99'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when panel has no photoId', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue({
      status: 'READY',
      panelMap: [{ index: 0, narration: 'No photo here.' }],
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('no_photo');
  });

  it('returns 404 when photo record not found', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('happy path: calls OpenAI, uploads to Cloudinary, patches DB, returns URL', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
      format: 'jpg',
    } as any);

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generatedImageUrl).toBe('https://res.cloudinary.com/test/comic.png');

    // OpenAI called with correct model
    expect(mockImagesEdit).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-1' })
    );

    // Cloudinary called with base64 data URI
    expect(mockUpload).toHaveBeenCalledWith(
      'data:image/png;base64,abc123',
      expect.objectContaining({ folder: expect.any(String) })
    );

    // DB updated with generatedImageUrl
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({
          panelMap: expect.arrayContaining([
            expect.objectContaining({ index: 0, generatedImageUrl: 'https://res.cloudinary.com/test/comic.png' }),
          ]),
        }),
      })
    );
  });

  it('returns 500 when OpenAI throws (DB not updated)', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
      format: 'jpg',
    } as any);
    mockImagesEdit.mockRejectedValue(new Error('OpenAI error'));

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(500);
    expect(prisma.story.update).not.toHaveBeenCalled();
  });

  it('returns 500 when Cloudinary throws (DB not updated)', async () => {
    vi.mocked(prisma.story.findUnique).mockResolvedValue(readyStory as any);
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      storageUrl: 'https://res.cloudinary.com/test/original.jpg',
      format: 'jpg',
    } as any);
    mockUpload.mockRejectedValue(new Error('Cloudinary error'));

    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost'), makeParams('s1', '0'));

    expect(res.status).toBe(500);
    expect(prisma.story.update).not.toHaveBeenCalled();
  });
});
