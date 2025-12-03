import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_UPLOAD_PRESET;
    delete process.env.VERCEL;
  });

  it('should return health status when DB is up', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_UPLOAD_PRESET = 'test-preset';

    const response = await GET();
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.db).toBe('up');
    expect(data.cloudinary.cloudName).toBe('set');
    expect(data.cloudinary.preset).toBe('set');
    expect(data.env).toBe('local');
  });

  it('should return error when DB is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB error'));

    const response = await GET();
    const data = await response.json();

    expect(data.ok).toBe(false);
    expect(data.error).toBe('health_check_failed');
    expect(response.status).toBe(500);
  });

  it('should indicate missing cloudinary config', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.cloudinary.cloudName).toBe('missing');
    expect(data.cloudinary.preset).toBe('missing');
  });

  it('should detect vercel environment', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    process.env.VERCEL = '1';

    const response = await GET();
    const data = await response.json();

    expect(data.env).toBe('vercel');
  });
});

