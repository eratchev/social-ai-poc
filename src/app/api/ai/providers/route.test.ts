import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';

describe('/api/ai/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should return providers status with mock when no keys', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.openai).toBe(false);
    expect(data.anthropic).toBe(false);
    expect(data.mock).toBe(true);
    expect(data.default).toBe('mock');
  });

  it('should return openai as default when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const response = await GET();
    const data = await response.json();

    expect(data.openai).toBe(true);
    expect(data.default).toBe('openai');
  });

  it('should return anthropic as default when only ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const response = await GET();
    const data = await response.json();

    expect(data.anthropic).toBe(true);
    expect(data.default).toBe('anthropic');
  });

  it('should prefer openai over anthropic', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const response = await GET();
    const data = await response.json();

    expect(data.openai).toBe(true);
    expect(data.anthropic).toBe(true);
    expect(data.default).toBe('openai');
  });
});

