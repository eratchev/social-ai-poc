import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

describe('prisma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the module cache to test singleton behavior
    vi.resetModules();
  });

  it('should create PrismaClient instance', async () => {
    const mockPrisma = { $connect: vi.fn() };
    vi.mocked(PrismaClient).mockImplementation(() => mockPrisma as any);

    const { prisma } = await import('./prisma');
    expect(prisma).toBeDefined();
    expect(PrismaClient).toHaveBeenCalledWith({
      log: ['error', 'warn'],
    });
  });

  it('should reuse global instance in non-production', async () => {
    const mockPrisma = { $connect: vi.fn() };
    vi.mocked(PrismaClient).mockImplementation(() => mockPrisma as any);

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { prisma: prisma1 } = await import('./prisma');
    const { prisma: prisma2 } = await import('./prisma');

    expect(prisma1).toBe(prisma2);

    process.env.NODE_ENV = originalEnv;
  });
});

