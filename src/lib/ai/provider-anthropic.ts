import Anthropic from "@anthropic-ai/sdk";
import type { StoryProvider, Photo } from "./providers";
import {
  safeJson,
  validateBeats,
  validatePanels,
  type Beat,
  type Panel,
} from "./structured";
import { AI_CFG } from "./config";
import { enforcePhotoCoverage } from "./panels";
import { parseTitleNarrative } from "./text";

function inferMime(url: string): "image/jpeg" | "image/png" {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  return "image/jpeg";
}
function makeAnthropicUserContent(text: string, imageUrls: string[]) {
  const content: any[] = [{ type: "text", text }];
  for (const url of imageUrls) {
    content.push({ type: "image", source: { type: "url", url, media_type: inferMime(url) } });
  }
  return content;
}

const MODEL = AI_CFG.MODEL || "claude-3-5-sonnet";

export class AnthropicProvider implements StoryProvider {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  providerName() { return "anthropic"; }
  modelName() { return MODEL; }

  async genBeats({
    photos,
    audience = "kids-10-12",
    tone = "wholesome",
    style = "funny",
  }: {
    photos: Photo[];
    audience?: string;
    tone?: string;
    style?: string;
  }): Promise<Beat[]> {
    const text = [
      "Create an outline of 5–7 beats for a short, kid-friendly humorous story.",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      "Each beat: index, type (setup|inciting|rising|climax|twist|resolution|button), summary (1–2 sentences), callouts[], imageRefs[] (indices by attachment order).",
      'Return STRICT JSON only: {"beats": Beat[] }',
    ].join("\n");

    const content = AI_CFG.VISION_BEATS
      ? makeAnthropicUserContent(text, photos.map(p => p.url))
      : [{ type: "text", text: text + "\n\nPhoto order:\n" + photos.map((p, i) => `- [${i}] ${p.url}`).join("\n") }];

    const resp = await this.client.messages.create({
      model: MODEL,
      system: "You are a storyboard editor for a kid-friendly humorous comic. Return strict JSON.",
      messages: [{ role: "user", content }],
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });

    const raw = resp.content?.[0]?.type === "text" ? resp.content[0].text : "{}";
    const json = safeJson<{ beats: unknown }>(raw ?? "{}");
    return validateBeats(json.beats);
  }

  async genPanels({
    beats,
    photos,
    panelCount,
  }: {
    beats: Beat[];
    photos: Photo[];
    panelCount: number;
  }): Promise<Panel[]> {
    const text = [
      `Produce ${panelCount} panels from the provided beats.`,
      "Each panel: index, photoId (must be one of the provided ids), narration (<= 25 words),",
      "bubbles (0–2, each <= 12 words, optional speaker), optional sfx[], alt.",
      'Return STRICT JSON only: {"panels": Panel[] }',
      "",
      `Beats (JSON): ${JSON.stringify(beats).slice(0, 8000)}`,
      `Photo ids (order): ${photos.map((p, i) => `[${i}]=${p.id}`).join(", ")}`,
    ].join("\n");

    const content = AI_CFG.VISION_PANELS
      ? makeAnthropicUserContent(text, photos.map(p => p.url))
      : [{ type: "text", text }];

    const resp = await this.client.messages.create({
      model: MODEL,
      system: "You are a comic scriptwriter. Convert beats to panels. Return strict JSON.",
      messages: [{ role: "user", content }],
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });

    const raw = resp.content?.[0]?.type === "text" ? resp.content[0].text : "{}";
    const json = safeJson<{ panels: unknown }>(raw ?? "{}");
    const panelsRaw = validatePanels(json.panels);
    const panels = enforcePhotoCoverage(panelsRaw, photos);
    
    const validIds = new Set(photos.map(p => p.id));
    return panels.map((p, i) => ({
      ...p,
      photoId: p.photoId && validIds.has(p.photoId) ? p.photoId : photos[i % photos.length].id,
    }));
  }

  async genNarrative({
    beats,
    audience = "kids-10-12",
    tone = "wholesome",
    style = "funny",
    wordCount = 200,
  }: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
  }): Promise<{ title: string; narrative: string }> {
    const system = "You write short, cinematic micro-stories for families.";
    const userText = [
      `Write a ~${wordCount} word story from these beats.`,
      "",
      "Output format (STRICT):",
      "First line: the title of the story.",
      "Then a blank line.",
      "Then the story narrative.",
      "",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      `Beats (JSON): ${JSON.stringify(beats).slice(0, 8000)}`,
    ].join("\n");
  
    const resp = await this.client.messages.create({
      model: MODEL,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });
  
    const raw =
      resp.content?.[0]?.type === "text" ? (resp.content[0].text ?? "").trim() : "";
    return parseTitleNarrative(raw);
  }
}
