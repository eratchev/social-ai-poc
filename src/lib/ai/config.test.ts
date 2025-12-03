import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCfg, getModelForQuality } from './config';
import type { ProviderKind } from './providers';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_TEMPERATURE;
    delete process.env.OPENAI_MAX_TOKENS;
    delete process.env.OPENAI_VISION_BEATS;
    delete process.env.OPENAI_VISION_PANELS;
    delete process.env.OPENAI_MODEL_FAST;
    delete process.env.OPENAI_MODEL_BALANCED;
    delete process.env.OPENAI_MODEL_PREMIUM;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_TEMPERATURE;
    delete process.env.ANTHROPIC_MAX_TOKENS;
    delete process.env.ANTHROPIC_VISION_BEATS;
    delete process.env.ANTHROPIC_VISION_PANELS;
    delete process.env.ANTHROPIC_MODEL_FAST;
    delete process.env.ANTHROPIC_MODEL_BALANCED;
    delete process.env.ANTHROPIC_MODEL_PREMIUM;
  });

  describe('getCfg', () => {
    it('should return OpenAI defaults when no env vars set', () => {
      const cfg = getCfg('openai');
      expect(cfg.MODEL).toBe('gpt-4o-mini');
      expect(cfg.TEMPERATURE).toBe(0.8);
      expect(cfg.MAX_TOKENS).toBe(1200);
      expect(cfg.VISION_BEATS).toBe(true);
      expect(cfg.VISION_PANELS).toBe(false);
    });

    it('should return Anthropic defaults when no env vars set', () => {
      const cfg = getCfg('anthropic');
      expect(cfg.MODEL).toBe('claude-3-5-sonnet-latest');
      expect(cfg.TEMPERATURE).toBe(0.8);
      expect(cfg.MAX_TOKENS).toBe(1200);
      expect(cfg.VISION_BEATS).toBe(true);
      expect(cfg.VISION_PANELS).toBe(false);
    });

    it('should return mock defaults', () => {
      const cfg = getCfg('mock');
      expect(cfg.MODEL).toBe('mock:v0');
      expect(cfg.TEMPERATURE).toBe(0.0);
      expect(cfg.MAX_TOKENS).toBe(1000);
      expect(cfg.VISION_BEATS).toBe(false);
      expect(cfg.VISION_PANELS).toBe(false);
    });

    it('should read OpenAI env vars', () => {
      process.env.OPENAI_MODEL = 'gpt-4';
      process.env.OPENAI_TEMPERATURE = '0.5';
      process.env.OPENAI_MAX_TOKENS = '2000';
      process.env.OPENAI_VISION_BEATS = 'false';
      process.env.OPENAI_VISION_PANELS = 'true';

      const cfg = getCfg('openai');
      expect(cfg.MODEL).toBe('gpt-4');
      expect(cfg.TEMPERATURE).toBe(0.5);
      expect(cfg.MAX_TOKENS).toBe(2000);
      expect(cfg.VISION_BEATS).toBe(false);
      expect(cfg.VISION_PANELS).toBe(true);
    });

    it('should read Anthropic env vars', () => {
      process.env.ANTHROPIC_MODEL = 'claude-3-opus';
      process.env.ANTHROPIC_TEMPERATURE = '0.7';
      process.env.ANTHROPIC_MAX_TOKENS = '3000';
      process.env.ANTHROPIC_VISION_BEATS = '0';
      process.env.ANTHROPIC_VISION_PANELS = '1';

      const cfg = getCfg('anthropic');
      expect(cfg.MODEL).toBe('claude-3-opus');
      expect(cfg.TEMPERATURE).toBe(0.7);
      expect(cfg.MAX_TOKENS).toBe(3000);
      expect(cfg.VISION_BEATS).toBe(false);
      expect(cfg.VISION_PANELS).toBe(true);
    });

    it('should handle boolean env vars with various formats', () => {
      const testCases = [
        { value: '1', expected: true },
        { value: 'true', expected: true },
        { value: 'yes', expected: true },
        { value: 'on', expected: true },
        { value: '0', expected: false },
        { value: 'false', expected: false },
        { value: 'no', expected: false },
        { value: 'off', expected: false },
        { value: 'invalid', expected: true }, // defaults to true
      ];

      testCases.forEach(({ value, expected }) => {
        process.env.OPENAI_VISION_BEATS = value;
        const cfg = getCfg('openai');
        expect(cfg.VISION_BEATS).toBe(expected);
      });
    });

    it('should handle invalid number env vars', () => {
      process.env.OPENAI_TEMPERATURE = 'invalid';
      process.env.OPENAI_MAX_TOKENS = 'not-a-number';

      const cfg = getCfg('openai');
      expect(cfg.TEMPERATURE).toBe(0.8); // default
      expect(cfg.MAX_TOKENS).toBe(1200); // default
    });
  });

  describe('getModelForQuality', () => {
    it('should return OpenAI model for fast quality', () => {
      const model = getModelForQuality('openai', 'fast');
      expect(model).toBe('gpt-4o-mini');
    });

    it('should return OpenAI model for balanced quality', () => {
      const model = getModelForQuality('openai', 'balanced');
      expect(model).toBe('gpt-4o-mini');
    });

    it('should return OpenAI model for premium quality', () => {
      const model = getModelForQuality('openai', 'premium');
      expect(model).toBe('gpt-4o-mini');
    });

    it('should use env var overrides for OpenAI', () => {
      process.env.OPENAI_MODEL_FAST = 'gpt-3.5-turbo';
      process.env.OPENAI_MODEL_BALANCED = 'gpt-4';
      process.env.OPENAI_MODEL_PREMIUM = 'gpt-4-turbo';

      expect(getModelForQuality('openai', 'fast')).toBe('gpt-3.5-turbo');
      expect(getModelForQuality('openai', 'balanced')).toBe('gpt-4');
      expect(getModelForQuality('openai', 'premium')).toBe('gpt-4-turbo');
    });

    it('should return Anthropic model for fast quality', () => {
      const model = getModelForQuality('anthropic', 'fast');
      expect(model).toBe('claude-3-haiku-20240307');
    });

    it('should return Anthropic model for balanced quality', () => {
      const model = getModelForQuality('anthropic', 'balanced');
      expect(model).toBe('claude-3-5-sonnet-latest');
    });

    it('should return Anthropic model for premium quality', () => {
      const model = getModelForQuality('anthropic', 'premium');
      expect(model).toBe('claude-3-5-sonnet-latest');
    });

    it('should use env var overrides for Anthropic', () => {
      process.env.ANTHROPIC_MODEL_FAST = 'claude-3-haiku';
      process.env.ANTHROPIC_MODEL_BALANCED = 'claude-3-sonnet';
      process.env.ANTHROPIC_MODEL_PREMIUM = 'claude-3-opus';

      expect(getModelForQuality('anthropic', 'fast')).toBe('claude-3-haiku');
      expect(getModelForQuality('anthropic', 'balanced')).toBe('claude-3-sonnet');
      expect(getModelForQuality('anthropic', 'premium')).toBe('claude-3-opus');
    });

    it('should default to balanced when quality not provided', () => {
      const model = getModelForQuality('openai');
      expect(model).toBe('gpt-4o-mini');
    });

    it('should return mock model', () => {
      const model = getModelForQuality('mock', 'fast');
      expect(model).toBe('mock:v0');
    });
  });
});

