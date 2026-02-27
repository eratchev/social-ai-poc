import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveDefaultProvider, getProvider, getStoryProvider } from './providers';
import { MockProvider } from './provider-mock';

// Mock the real AI provider modules so their SDKs are never loaded in tests.
vi.mock('./provider-openai', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({ providerName: () => 'openai' })),
}));

vi.mock('./provider-anthropic', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({ providerName: () => 'anthropic' })),
}));

vi.mock('./provider-mock', () => ({
  MockProvider: vi.fn().mockImplementation(() => ({ providerName: () => 'mock' })),
}));

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

  describe('getProvider', () => {
    it('returns an OpenAIProvider instance for kind "openai"', () => {
      const provider = getProvider('openai');
      expect(provider.providerName()).toBe('openai');
    });

    it('returns an AnthropicProvider instance for kind "anthropic"', () => {
      const provider = getProvider('anthropic');
      expect(provider.providerName()).toBe('anthropic');
    });

    it('returns a MockProvider instance for kind "mock"', () => {
      const provider = getProvider('mock');
      expect(provider.providerName()).toBe('mock');
    });
  });

  describe('getStoryProvider', () => {
    it('uses resolveDefaultProvider() when no argument is given (no API keys → mock)', () => {
      // No API keys set, so resolveDefaultProvider() returns "mock"
      const provider = getStoryProvider();
      expect(provider.providerName()).toBe('mock');
    });

    it('returns a MockProvider when explicitly passed "mock"', () => {
      const provider = getStoryProvider('mock');
      expect(provider.providerName()).toBe('mock');
    });
  });
});

