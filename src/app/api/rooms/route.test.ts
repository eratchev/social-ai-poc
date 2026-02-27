import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { POST, randomCode } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
    room: {
      upsert: vi.fn(),
    },
  },
}));

describe('randomCode', () => {
  it('always produces a code with exactly 6 alphanumeric chars after R-', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomCode()).toMatch(/^R-[A-Z0-9]{6}$/);
    }
  });

  it('produces exactly 6 chars even when all random bytes are 0xFF', () => {
    // 0xFF bytes in hex → 'FFFFFF...' — all valid alphanumeric, no stripping needed
    vi.spyOn(crypto, 'randomBytes').mockReturnValueOnce(Buffer.alloc(6, 0xff));
    expect(randomCode()).toBe('R-FFFFFF');
    vi.restoreAllMocks();
  });
});

describe('/api/rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create room with provided code', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { code: 'TESTROOM' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.upsert).mockResolvedValue(mockRoom as any);

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'TESTROOM', ownerHandle: 'testuser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.code).toBe('TESTROOM');
    expect(prisma.room.upsert).toHaveBeenCalledWith({
      where: { code: 'TESTROOM' },
      update: {},
      create: { code: 'TESTROOM', createdBy: 'user1' },
      select: { code: true },
    });
  });

  it('should generate random code when not provided', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { code: 'R-ABCDEF' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.upsert).mockResolvedValue(mockRoom as any);

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.code).toBeDefined();
    expect(data.code).toMatch(/^R-[A-Z0-9]+$/);
  });

  it('should uppercase room code', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { code: 'LOWERCASE' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.upsert).mockResolvedValue(mockRoom as any);

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'lowercase' }),
    });

    await POST(request);

    expect(prisma.room.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'LOWERCASE' },
        create: expect.objectContaining({ code: 'LOWERCASE' }),
      })
    );
  });

  it('should handle errors', async () => {
    vi.mocked(prisma.user.upsert).mockRejectedValue(new Error('DB error'));

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('internal_error');
  });

  it('should handle invalid JSON', async () => {
    const mockUser = { id: 'user1' };
    const mockRoom = { code: 'R-TEST' };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.room.upsert).mockResolvedValue(mockRoom as any);

    const request = new Request('http://localhost/api/rooms', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();
    // Should still work with defaults
    expect(data.code).toBeDefined();
  });
});

