// lib/ai/config.ts
import type { ProviderKind } from "./providers";

function bool(v: unknown, def: boolean) {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return def;
}
function num(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Provider-specific config with sensible defaults.
 * - Reads provider-scoped env vars first.
 * - Finally falls back to sane hardcoded defaults.
 *
 * OpenAI envs (all optional):
 *   OPENAI_MODEL
 *   OPENAI_TEMPERATURE
 *   OPENAI_MAX_TOKENS
 *   OPENAI_VISION_BEATS
 *   OPENAI_VISION_PANELS
 *
 * Anthropic envs (all optional):
 *   ANTHROPIC_MODEL
 *   ANTHROPIC_TEMPERATURE
 *   ANTHROPIC_MAX_TOKENS
 *   ANTHROPIC_VISION_BEATS
 *   ANTHROPIC_VISION_PANELS
 *
 */

export type ProviderConfig = {
  MODEL: string;
  TEMPERATURE: number;
  MAX_TOKENS: number;
  VISION_BEATS: boolean;
  VISION_PANELS: boolean;
};

const OPENAI_DEFAULTS: ProviderConfig = {
  MODEL: "gpt-4o-mini",
  TEMPERATURE: 0.8,
  MAX_TOKENS: 1200,
  VISION_BEATS: true,
  VISION_PANELS: false,
};

const ANTHROPIC_DEFAULTS: ProviderConfig = {
  MODEL: "claude-3-5-sonnet-latest",
  TEMPERATURE: 0.8,
  MAX_TOKENS: 1200,
  VISION_BEATS: true,
  VISION_PANELS: false,
};

export function getCfg(kind: ProviderKind): ProviderConfig {
  if (kind === "openai") {
    return {
      MODEL: process.env.OPENAI_MODEL || OPENAI_DEFAULTS.MODEL,
      TEMPERATURE: num(process.env.OPENAI_TEMPERATURE, OPENAI_DEFAULTS.TEMPERATURE),
      MAX_TOKENS: num(process.env.OPENAI_MAX_TOKENS, OPENAI_DEFAULTS.MAX_TOKENS),
      VISION_BEATS: bool(process.env.OPENAI_VISION_BEATS, OPENAI_DEFAULTS.VISION_BEATS),
      VISION_PANELS: bool(process.env.OPENAI_VISION_PANELS, OPENAI_DEFAULTS.VISION_PANELS),
    };
  }
  if (kind === "anthropic") {
    return {
      MODEL: process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULTS.MODEL,
      TEMPERATURE: num(process.env.ANTHROPIC_TEMPERATURE, ANTHROPIC_DEFAULTS.TEMPERATURE),
      MAX_TOKENS: num(process.env.ANTHROPIC_MAX_TOKENS, ANTHROPIC_DEFAULTS.MAX_TOKENS),
      VISION_BEATS: bool(process.env.ANTHROPIC_VISION_BEATS, ANTHROPIC_DEFAULTS.VISION_BEATS),
      VISION_PANELS: bool(process.env.ANTHROPIC_VISION_PANELS, ANTHROPIC_DEFAULTS.VISION_PANELS),
    };
  }
  // mock uses conservative defaults
  return {
    MODEL: "mock:v0",
    TEMPERATURE: 0.0,
    MAX_TOKENS: 1_000,
    VISION_BEATS: false,
    VISION_PANELS: false,
  };
}
