import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      destroy: vi.fn(),
    },
  },
}));

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/photos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.photo.delete).mockResolvedValue({} as any);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as any);
  });

  it('returns 404 when photo not found', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null);

    const res = await DELETE(new Request('http://localhost'), makeParams('nonexistent'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
    expect(prisma.photo.delete).not.toHaveBeenCalled();
  });

  it('deletes from Cloudinary and DB when photo has publicId', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: 'social-ai-poc/ABC/img123',
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/ABC/img123');
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });

  it('still deletes DB record when Cloudinary destroy throws', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: 'social-ai-poc/ABC/img123',
    } as any);
    vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(new Error('Cloudinary error'));

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });

  it('skips Cloudinary call when publicId is null', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo-1',
      publicId: null,
    } as any);

    const res = await DELETE(new Request('http://localhost'), makeParams('photo-1'));

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
  });
});
