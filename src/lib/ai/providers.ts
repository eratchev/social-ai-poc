// lib/ai/providers.ts
import type { Beat, Panel } from "./structured";

export type ComicAudience = "kids" | "adults";

export type Photo = { id: string; url: string; caption?: string };

export type TitleNarrative = { title: string; narrative: string };

export interface StoryProvider {
  genBeats(args: {
    photos: Photo[];
    audience?: string;
    tone?: string;
    style?: string;
    comicAudience?: ComicAudience; // optional preset knob
  }): Promise<Beat[]>;

  genPanels(args: {
    beats: Beat[];
    photos: Photo[];
    panelCount: number;
    comicAudience?: ComicAudience; // optional preset knob
  }): Promise<Panel[]>;

  genNarrative(args: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
    comicAudience?: ComicAudience; // optional preset knob
  }): Promise<TitleNarrative>;

  providerName(): string;
  modelName(): string;
}

export type ProviderKind = "openai" | "anthropic" | "mock";

/**
 * Factory: explicit provider
 */
export function getProvider(kind: ProviderKind): StoryProvider {
  if (kind === "openai") {
    const { OpenAIProvider } = require("./provider-openai");
    return new OpenAIProvider();
  }
  if (kind === "anthropic") {
    const { AnthropicProvider } = require("./provider-anthropic");
    return new AnthropicProvider();
  }
  const { MockProvider } = require("./provider-mock");
  return new MockProvider();
}

/**
 * Back-compat: env-based factory (AI_PROVIDER)
 *  - Keeps existing callers working.
 */
export function getStoryProvider(): StoryProvider {
  const p = (process.env.AI_PROVIDER || "mock").toLowerCase() as ProviderKind;
  return getProvider(
    p === "openai" || p === "anthropic" || p === "mock" ? p : "mock"
  );
}
