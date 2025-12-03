import { describe, it, expect, beforeEach } from 'vitest';
import { resolveDefaultProvider } from './providers';

describe('providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('resolveDefaultProvider', () => {
    it('should return openai when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(resolveDefaultProvider()).toBe('openai');
    });

    it('should return anthropic when only ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      expect(resolveDefaultProvider()).toBe('anthropic');
    });

    it('should prefer openai over anthropic', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.ANTHROPIC_API_KEY = 'test-key';
      expect(resolveDefaultProvider()).toBe('openai');
    });

    it('should return mock when no keys are set', () => {
      expect(resolveDefaultProvider()).toBe('mock');
    });
  });

});

