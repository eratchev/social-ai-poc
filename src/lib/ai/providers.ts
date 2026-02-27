// lib/ai/providers.ts
import type { Beat, Panel } from "./structured";
import { OpenAIProvider } from "./provider-openai";
import { AnthropicProvider } from "./provider-anthropic";
import { MockProvider } from "./provider-mock";

export type ComicAudience = "kids" | "adults";
export type Quality = "fast" | "balanced" | "premium";

export type Photo = { id: string; url: string; caption?: string };
export type TitleNarrative = { title: string; narrative: string };

export interface StoryProvider {
  genBeats(args: {
    photos: Photo[];
    audience?: string;
    tone?: string;
    style?: string;
    comicAudience?: ComicAudience; // optional preset knob
    quality?: Quality;             // NEW: quality preset -> model selection
  }): Promise<Beat[]>;

  genPanels(args: {
    beats: Beat[];
    photos: Photo[];
    panelCount: number;
    comicAudience?: ComicAudience; // optional preset knob
    quality?: Quality;             // NEW
  }): Promise<Panel[]>;

  genNarrative(args: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
    comicAudience?: ComicAudience; // optional preset knob
    quality?: Quality;             // NEW
  }): Promise<TitleNarrative>;

  providerName(): string;
  modelName(): string; // returns the default model for the provider (legacy)
}

export type ProviderKind = "openai" | "anthropic" | "mock";

/**
 * Resolve a sane default based on available server credentials.
 * Priority: OpenAI → Anthropic → Mock
 */
export function resolveDefaultProvider(): ProviderKind {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "mock";
}

/**
 * Explicit factory: construct a provider by kind.
 */
export function getProvider(kind: ProviderKind): StoryProvider {
  if (kind === "openai") return new OpenAIProvider();
  if (kind === "anthropic") return new AnthropicProvider();
  return new MockProvider();
}

/**
 * Flexible factory:
 * - If kind is provided, use it.
 * - If omitted, fall back to resolveDefaultProvider() (no env default).
 */
export function getStoryProvider(kind?: ProviderKind) {
  const chosen = kind ?? resolveDefaultProvider();
  return getProvider(chosen);
}
