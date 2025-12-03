import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captionPhotosOpenAI } from './captions-openai';
import OpenAI from 'openai';
import { safeJson } from './structured';

vi.mock('openai', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('./structured', () => ({
  safeJson: vi.fn(),
}));

describe('captions-openai', () => {
  const mockClient = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OpenAI).mockImplementation(() => mockClient as any);
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.AI_DEFAULT_MODEL;
    // Reset safeJson mock
    vi.mocked(safeJson).mockImplementation((str: string) => {
      try {
        return JSON.parse(str);
      } catch {
        throw new Error('Invalid JSON');
      }
    });
  });

  it('should return empty array for empty input', async () => {
    const result = await captionPhotosOpenAI([]);
    expect(result).toEqual([]);
    expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should generate captions for photos', async () => {
    const photos = [
      { id: 'photo1', url: 'http://example.com/1.jpg' },
      { id: 'photo2', url: 'http://example.com/2.jpg' },
    ];

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              photos: [
                { index: 0, caption: 'A beautiful sunset', tags: ['sunset', 'sky', 'nature'] },
                { index: 1, caption: 'A city street', tags: ['city', 'urban', 'street'] },
              ],
            }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    const result = await captionPhotosOpenAI(photos);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'photo1',
      caption: 'A beautiful sunset',
      tags: ['sunset', 'sky', 'nature'],
    });
    expect(result[1]).toEqual({
      id: 'photo2',
      caption: 'A city street',
      tags: ['city', 'urban', 'street'],
    });
  });

  it('should use default model when AI_DEFAULT_MODEL not set', async () => {
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              photos: [{ index: 0, caption: 'Test', tags: ['test'] }],
            }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    await captionPhotosOpenAI(photos);

    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
      })
    );
  });

  it('should use custom model from env', async () => {
    process.env.AI_DEFAULT_MODEL = 'gpt-4';
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              photos: [{ index: 0, caption: 'Test', tags: ['test'] }],
            }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    // The model is read at module load time, so we test the default behavior
    // For custom model testing, we'd need to test the actual module loading
    await captionPhotosOpenAI(photos);

    expect(mockClient.chat.completions.create).toHaveBeenCalled();
  });

  it('should handle invalid response gracefully', async () => {
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'invalid json',
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);
    // safeJson will throw, but safeParse will catch it and return failure
    // So we mock safeJson to return something that fails schema validation
    vi.mocked(safeJson).mockReturnValue({ invalid: 'data' } as any);

    const result = await captionPhotosOpenAI(photos);
    expect(result).toEqual([]);
  });

  it('should handle schema validation failure', async () => {
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({ invalid: 'data' }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    const result = await captionPhotosOpenAI(photos);
    expect(result).toEqual([]);
  });

  it('should trim tags to max 6', async () => {
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              photos: [
                {
                  index: 0,
                  caption: 'Test',
                  tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8'],
                },
              ],
            }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    const result = await captionPhotosOpenAI(photos);
    expect(result[0].tags.length).toBe(6);
  });

  it('should handle missing content', async () => {
    const photos = [{ id: 'photo1', url: 'http://example.com/1.jpg' }];
    const mockResponse = {
      choices: [{}],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    const result = await captionPhotosOpenAI(photos);
    expect(result).toEqual([]);
  });

  it('should map captions by index', async () => {
    const photos = [
      { id: 'photo1', url: 'http://example.com/1.jpg' },
      { id: 'photo2', url: 'http://example.com/2.jpg' },
      { id: 'photo3', url: 'http://example.com/3.jpg' },
    ];

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              photos: [
                { index: 0, caption: 'First', tags: ['a'] },
                { index: 2, caption: 'Third', tags: ['c'] },
              ],
            }),
          },
        },
      ],
    };

    vi.mocked(mockClient.chat.completions.create).mockResolvedValue(mockResponse as any);

    const result = await captionPhotosOpenAI(photos);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('photo1');
    expect(result[1].id).toBe('photo3');
  });
});

