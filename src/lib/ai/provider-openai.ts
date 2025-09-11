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
import { enforcePhotoCoverage } from "./panels";
import { parseTitleNarrative } from "./text";

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
      "",
      "Example beats JSON:",
      `{
        "beats": [
          {
            "index": 0,
            "type": "setup",
            "summary": "Zoey and a sunglasses-wearing puppy warm up with a soccer ball.",
            "callouts": ["sunglasses", "soccer ball"],
            "imageRefs": [0]
          },
          {
            "index": 1,
            "type": "rising",
            "summary": "They attempt a fancy trick; chaos and snacks ensue.",
            "callouts": ["spin","gasp"],
            "imageRefs": [1]
          }
        ]
      }`,
      "",
      "The following images are attached in order. Use them to ground visual details.",
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
      "Rules:",
      "- Use EACH provided photoId at least once before reusing any photo.",
      "- Do NOT invent ids; only choose from the provided ids.",
      'Return STRICT JSON only: {"panels": Panel[] }',
      "",
      "Example panel JSON:",
      `{
        "panels": [
          {
            "index": 0,
            "photoId": "ph_01",
            "narration": "Warm-up turns into a perfectly unplanned routine.",
            "bubbles": [
              { "speaker": "Puppy", "text": "I do strategy AND snacks." }
            ],
            "sfx": ["WHOOSH"],
            "alt": "Panel 1 reflecting setup beat"
          }
        ]
      }`,
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
    const panelsRaw = validatePanels(json.panels);
    const panels = enforcePhotoCoverage(panelsRaw, photos);

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
  }): Promise<{ title: string; narrative: string }> {
    const system = "You write short, cinematic micro-stories for families.";
    const user = [
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
  
    const raw = (resp.choices?.[0]?.message?.content ?? "").trim();
    return parseTitleNarrative(raw);
  }
}
