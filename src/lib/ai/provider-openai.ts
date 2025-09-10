import OpenAI from "openai";
import type { StoryProvider, Photo } from "./providers";
import {
  safeJson,
  validateBeats,
  validatePanels,
  type Beat,
  type Panel,
} from "./structured";
import { AI_CFG } from "./config";

// ✅ Import the correct types from the SDK:
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

function makeUserContentWithImages(text: string, imageUrls: string[]): ChatCompletionContentPart[] {
  const content: ChatCompletionContentPart[] = [{ type: "text", text }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

const MODEL = AI_CFG.MODEL || "gpt-4o-mini";

export class OpenAIProvider implements StoryProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  providerName() { return "openai"; }
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
    const system = "You are a storyboard editor for a kid-friendly humorous comic. Return strict JSON.";
    const text = [
      "Create an outline of 5–7 beats for a short, kid-friendly humorous story.",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      "Each beat: index, type (setup|inciting|rising|climax|twist|resolution|button), summary (1–2 sentences), callouts[], imageRefs[] (indices by the provided order).",
      'Return STRICT JSON only: {"beats": Beat[] }',
    ].join("\n");

    const messages: ChatCompletionMessageParam[] = AI_CFG.VISION_BEATS
      ? [
          { role: "system", content: system },
          { role: "user", content: makeUserContentWithImages(text, photos.map(p => p.url)) },
        ]
      : [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  text +
                  "\n\nPhoto order:\n" +
                  photos.map((p, i) => `- [${i}] ${p.url}`).join("\n"),
              },
            ],
          },
        ];

    const resp = await this.client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const json = safeJson<{ beats: unknown }>(raw);
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
    const system = "You are a comic scriptwriter. Convert beats to panels. Return strict JSON.";
    const text = [
      `Produce ${panelCount} panels from the provided beats.`,
      "Each panel: index, photoId (must be one of the provided ids), narration (<= 25 words),",
      "bubbles (0–2, each <= 12 words, optional speaker), optional sfx[], alt.",
      'Return STRICT JSON only: {"panels": Panel[] }',
      "",
      `Beats (JSON): ${JSON.stringify(beats).slice(0, 8000)}`,
      `Photo ids (order): ${photos.map((p, i) => `[${i}]=${p.id}`).join(", ")}`,
    ].join("\n");

    const messages: ChatCompletionMessageParam[] = AI_CFG.VISION_PANELS
      ? [
          { role: "system", content: system },
          { role: "user", content: makeUserContentWithImages(text, photos.map(p => p.url)) },
        ]
      : [
          { role: "system", content: system },
          { role: "user", content: [{ type: "text", text }] },
        ];

    const resp = await this.client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    const json = safeJson<{ panels: unknown }>(raw);
    const panels = validatePanels(json.panels);

    // Ensure valid photoId; fallback by index if missing
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
  }): Promise<string> {
    const system = "You write short, cinematic micro-stories for families.";
    const user = [
      `Write a ~${wordCount} word story from these beats.`,
      "Keep paragraphs short and end on a light punchline.",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      `Beats (JSON): ${JSON.stringify(beats).slice(0, 8000)}`,
    ].join("\n");

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    const resp = await this.client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: AI_CFG.TEMPERATURE,
      max_tokens: AI_CFG.MAX_TOKENS,
    });

    return (resp.choices?.[0]?.message?.content ?? "").trim();
  }
}
