import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, DELETE } from './route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    story: {
      update: vi.fn(),
    },
  },
}));

describe('/api/story/[id]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('should generate share slug', async () => {
      const mockStory = { id: 'story1', shareSlug: 'test-slug-123' };
      vi.mocked(prisma.story.update).mockResolvedValue(mockStory as any);

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.id).toBe('story1');
      expect(data.shareSlug).toBe('test-slug-123');
      expect(prisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story1' },
        data: { shareSlug: expect.any(String) },
        select: { id: true, shareSlug: true },
      });
    });

    it('should return 400 when id is missing', async () => {
      const request = new Request('http://localhost/api/story//share', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('bad_request');
    });

    it('should retry on unique constraint violation', async () => {
      const mockStory = { id: 'story1', shareSlug: 'new-slug' };
      
      // First call fails with unique constraint, second succeeds
      vi.mocked(prisma.story.update)
        .mockRejectedValueOnce({ code: 'P2002', message: 'Unique constraint' } as any)
        .mockResolvedValueOnce(mockStory as any);

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.shareSlug).toBe('new-slug');
      expect(prisma.story.update).toHaveBeenCalledTimes(2);
    });

    it('should return error after max retries', async () => {
      vi.mocked(prisma.story.update).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint',
      } as any);

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('could_not_generate_slug');
    });

    it('should handle other errors', async () => {
      vi.mocked(prisma.story.update).mockRejectedValue(new Error('DB error'));

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('internal_error');
    });
  });

  describe('DELETE', () => {
    it('should remove share slug', async () => {
      const mockStory = { id: 'story1', shareSlug: null };
      vi.mocked(prisma.story.update).mockResolvedValue(mockStory as any);

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.id).toBe('story1');
      expect(data.shareSlug).toBeNull();
      expect(prisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story1' },
        data: { shareSlug: null },
        select: { id: true, shareSlug: true },
      });
    });

    it('should return 400 when id is missing', async () => {
      const request = new Request('http://localhost/api/story//share', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('bad_request');
    });

    it('should handle errors', async () => {
      vi.mocked(prisma.story.update).mockRejectedValue(new Error('DB error'));

      const request = new Request('http://localhost/api/story/story1/share', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('internal_error');
    });
  });
});

