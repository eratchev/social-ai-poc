// lib/ai/providers.ts
import type { Beat, Panel } from "./structured";

export type Photo = { id: string; url: string; caption?: string };

export type TitleNarrative = { title: string; narrative: string };

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
  }): Promise<TitleNarrative>;

  providerName(): string;
  modelName(): string;
}

export function getStoryProvider() {
  const p = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (p === "openai") return new (require("./provider-openai").OpenAIProvider)();
  if (p === "anthropic") return new (require("./provider-anthropic").AnthropicProvider)();
  return new (require("./provider-mock").MockProvider)();
}
