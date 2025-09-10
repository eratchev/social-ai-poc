// lib/ai/providers.ts
import type { Beat, Panel } from "./structured";

export type Photo = { id: string; url: string; caption?: string };

export interface StoryProvider {
  genBeats(args: {
    photos: Photo[];
    audience?: string;
    tone?: string;
    style?: string;
  }): Promise<Beat[]>;

  genPanels(args: {
    beats: Beat[];
    photos: Photo[];
    panelCount: number;
  }): Promise<Panel[]>;

  genNarrative(args: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
  }): Promise<string>;

  providerName(): string;
  modelName(): string;
}

export function getStoryProvider(): StoryProvider {
  const p = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (p === "openai") {
    const { OpenAIProvider } = require("./provider-openai");
    return new OpenAIProvider();
  }
  if (p === "anthropic") {
    const { AnthropicProvider } = require("./provider-anthropic");
    return new AnthropicProvider();
  }
  const { MockProvider } = require("./provider-mock");
  return new MockProvider();
}
