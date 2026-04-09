import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PATCH, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    photo: {
      findMany: vi.fn(),
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

function makeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

function makeRequest(method: string, body?: unknown) {
  return new Request(`http://localhost/api/rooms/ABC`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('PATCH /api/rooms/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when room not found', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const res = await PATCH(makeRequest('PATCH', { name: 'My Room' }), makeParams('ABC'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('returns 400 when name is missing', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', {}), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('returns 400 when name exceeds 80 chars', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', { name: 'x'.repeat(81) }), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('returns 400 when name is empty after trimming', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);

    const res = await PATCH(makeRequest('PATCH', { name: '   ' }), makeParams('ABC'));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_name');
  });

  it('updates name and returns { code, name }', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);
    vi.mocked(prisma.room.update).mockResolvedValue({ code: 'ABC', name: 'My Room' } as any);

    const res = await PATCH(makeRequest('PATCH', { name: '  My Room  ' }), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe('ABC');
    expect(data.name).toBe('My Room');
    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { code: 'ABC' },
      data: { name: 'My Room' },
      select: { code: true, name: true },
    });
  });

  it('accepts name of exactly 80 chars', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC', name: null } as any);
    vi.mocked(prisma.room.update).mockResolvedValue({ code: 'ABC', name: 'x'.repeat(80) } as any);

    const res = await PATCH(makeRequest('PATCH', { name: 'x'.repeat(80) }), makeParams('ABC'));

    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/rooms/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.room.delete).mockResolvedValue({} as any);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as any);
  });

  it('returns 404 when room not found', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue(null);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
    expect(prisma.room.delete).not.toHaveBeenCalled();
  });

  it('destroys Cloudinary assets and deletes room', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { publicId: 'social-ai-poc/img1' },
      { publicId: 'social-ai-poc/img2' },
      { publicId: null },
    ] as any);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/img1');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('social-ai-poc/img2');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2); // null publicId skipped
    expect(prisma.room.delete).toHaveBeenCalledWith({ where: { code: 'ABC' } });
  });

  it('still deletes room when Cloudinary destroy throws', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { publicId: 'social-ai-poc/img1' },
    ] as any);
    vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(new Error('Cloudinary error'));

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    expect(prisma.room.delete).toHaveBeenCalledWith({ where: { code: 'ABC' } });
  });

  it('returns { ok: true } when room has no photos', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('returns 500 when DB delete throws', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({ code: 'ABC' } as any);
    vi.mocked(prisma.photo.findMany).mockResolvedValue([]);
    vi.mocked(prisma.room.delete).mockRejectedValue(new Error('DB error'));

    const res = await DELETE(makeRequest('DELETE'), makeParams('ABC'));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('internal_error');
  });
});
