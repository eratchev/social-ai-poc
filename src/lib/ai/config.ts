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
 *   OPENAI_MODEL                      (legacy single/default)
 *   OPENAI_MODEL_FAST | _BALANCED | _PREMIUM  (new preset overrides)
 *   OPENAI_TEMPERATURE
 *   OPENAI_MAX_TOKENS
 *   OPENAI_VISION_BEATS
 *   OPENAI_VISION_PANELS
 *
 * Anthropic envs (all optional):
 *   ANTHROPIC_MODEL                   (legacy single/default)
 *   ANTHROPIC_MODEL_FAST | _BALANCED | _PREMIUM (new preset overrides)
 *   ANTHROPIC_TEMPERATURE
 *   ANTHROPIC_MAX_TOKENS
 *   ANTHROPIC_VISION_BEATS
 *   ANTHROPIC_VISION_PANELS
 */

export type ProviderConfig = {
  MODEL: string;              // legacy single/default model id
  TEMPERATURE: number;
  MAX_TOKENS: number;
  VISION_BEATS: boolean;
  VISION_PANELS: boolean;
};

export type Quality = "fast" | "balanced" | "premium";

const OPENAI_DEFAULTS: ProviderConfig = {
  MODEL: "gpt-4o-mini", // legacy default; kept for compatibility
  TEMPERATURE: 0.8,
  MAX_TOKENS: 1200,
  VISION_BEATS: true,
  VISION_PANELS: false,
};

const ANTHROPIC_DEFAULTS: ProviderConfig = {
  MODEL: "claude-haiku-4-5", // make sure your key sees this id
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

/**
 * Resolve a concrete model ID from a quality preset.
 * Order of precedence:
 *   1) Provider-specific QUALITY env (e.g., ANTHROPIC_MODEL_FAST)
 *   2) Provider-specific default QUALITY fallback (hardcoded below)
 *   3) Provider's legacy single MODEL from getCfg(kind)
 */
export function getModelForQuality(kind: ProviderKind, q?: Quality): string {
  const quality = q || "balanced";

  if (kind === "openai") {
    const envMap: Record<Quality, string | undefined> = {
      fast: process.env.OPENAI_MODEL_FAST,
      balanced: process.env.OPENAI_MODEL_BALANCED,
      premium: process.env.OPENAI_MODEL_PREMIUM,
    };
    const defaults: Record<Quality, string> = {
      fast: "gpt-4o-mini",
      balanced: "gpt-4o-mini",
      premium: "gpt-4o",
    };
    return envMap[quality] || defaults[quality];
  }

  if (kind === "anthropic") {
    const envMap: Record<Quality, string | undefined> = {
      fast: process.env.ANTHROPIC_MODEL_FAST,
      balanced: process.env.ANTHROPIC_MODEL_BALANCED,
      premium: process.env.ANTHROPIC_MODEL_PREMIUM,
    };
    const defaults: Record<Quality, string> = {
      fast: "claude-haiku-4-5",
      balanced: "claude-sonnet-4-5",
      premium: "claude-opus-4-5",
    };
    return envMap[quality] || defaults[quality];
  }

  // Only call getCfg for mock (or other unknown providers)
  const cfg = getCfg(kind);
  return cfg.MODEL;
}
