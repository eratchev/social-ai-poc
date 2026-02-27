// lib/ai/provider-anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import type { StoryProvider, Photo, Quality } from "./providers";
import {
  safeJson,
  validateBeats,
  validatePanels,
  COMIC_LIMITS,
  type Beat,
  type Panel,
} from "./structured";
import { getCfg, getModelForQuality } from "./config";
import { enforcePhotoCoverage } from "./panels";
import { parseTitleNarrative } from "./text";

/* ---------------------------------- utils ---------------------------------- */
function makeAnthropicUserContent(
  text: string,
  imageUrls: string[]
): Anthropic.Messages.ContentBlockParam[] {
  const content: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text },
  ];
  for (const url of imageUrls) {
    content.push({ type: "image", source: { type: "url", url } });
  }
  return content;
}

function clampWords(s = "", maxWords = 10) {
  const parts = s.trim().split(/\s+/);
  if (parts.length <= maxWords) return s.trim();
  return parts.slice(0, maxWords).join(" ").replace(/[.,;:!?-]*$/, "…");
}

function enforceComicCaps(panels: Panel[]): Panel[] {
  return panels.map((p) => {
    const narration = p.narration
      ? clampWords(p.narration, Math.min(12, COMIC_LIMITS.narrationMax))
      : p.narration;
    const bubbles = (p.bubbles ?? [])
      .slice(0, COMIC_LIMITS.bubblesPerPanel)
      .map((b) => ({
        ...b,
        text: clampWords(b.text, Math.min(10, COMIC_LIMITS.bubbleTextMax)),
      }));
    return { ...p, narration, bubbles };
  });
}

export class AnthropicProvider implements StoryProvider {
  private client: Anthropic;
  private cfg: ReturnType<typeof getCfg>;
  private defaultModel: string;

  constructor() {
    this.cfg = getCfg("anthropic");
    this.defaultModel = this.cfg.MODEL || "claude-haiku-4-5";
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  providerName() { return "anthropic"; }
  modelName() { return this.defaultModel; }

  private model(quality?: Quality) {
    return getModelForQuality("anthropic", quality);
  }

  async genBeats({
    photos,
    audience = "kids-10-12",
    tone = "wholesome",
    style = "funny",
    quality,
  }: {
    photos: Photo[];
    audience?: string;
    tone?: string;
    style?: string;
    quality?: Quality;
  }): Promise<Beat[]> {
    const system =
      "You are a storyboard editor for a humorous comic. Keep beats short and visual. Return strict JSON.";

    const text = [
      "Create an outline of 5–7 comic beats grounded in the attached photos.",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      `Each beat: index, type (setup|inciting|rising|climax|twist|resolution|button),`,
      `summary (≤ ${COMIC_LIMITS.beatSummaryMax} chars, 1 short sentence), callouts[], imageRefs[] (indices by attachment order).`,
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
            "summary": "They try a trick; the snack timeline gets weird.",
            "callouts": ["spin","gasp"],
            "imageRefs": [1]
          }
        ]
      }`,
      "",
      "Use these short factual captions to stay accurate (do not invent):",
      photos.map((p, i) => `- [${i}] ${p.caption ? `"${p.caption}"` : "(no caption)"}`).join("\n"),
    ].join("\n");

    const content: Anthropic.Messages.ContentBlockParam[] = this.cfg.VISION_BEATS
      ? makeAnthropicUserContent(text, photos.map((p) => p.url))
      : [{ type: "text", text: text + "\n\n" + photos.map((p, i) => `- [${i}] ${p.url}`).join("\n") }];

    const resp = await this.client.messages.create({
      model: this.model(quality),
      system,
      messages: [{ role: "user", content }],
      temperature: this.cfg.TEMPERATURE,
      max_tokens: this.cfg.MAX_TOKENS,
    });

    const raw =
      resp.content?.[0]?.type === "text" ? resp.content[0].text ?? "{}" : "{}";
    const json = safeJson<{ beats: unknown }>(raw);
    return validateBeats(json.beats);
  }

  async genPanels({
    beats,
    photos,
    panelCount,
    quality,
  }: {
    beats: Beat[];
    photos: Photo[];
    panelCount: number;
    quality?: Quality;
  }): Promise<Panel[]> {
    const system =
      "You are a comic scriptwriter. Convert beats to panels. Return strict JSON.";

    const text = [
      `Produce ${panelCount} panels from the provided beats.`,
      "",
      "Comic rules:",
      `- Prefer *speech bubbles* over narration.`,
      `- Per panel: ONE narration (6–12 words max), and 0–${COMIC_LIMITS.bubblesPerPanel} bubbles (≤ 10 words each).`,
      `- Keep it punchy and visual; avoid stage directions.`,
      "",
      "JSON fields per panel:",
      "index, photoId (one of provided ids), narration, bubbles[{text,speaker?}], sfx[], alt.",
      "",
      "Photo usage rules:",
      "- Use EACH provided photoId at least once before reusing any photo.",
      "- Do NOT invent ids; only choose from the provided ids.",
      "",
      'Return STRICT JSON only: {"panels": Panel[] }',
      "",
      "Use these factual captions to anchor landmarks/signage/objects where visible:",
      photos.map((p, i) => `- [${i}] ${p.caption ? `"${p.caption}"` : "(no caption)"}`).join("\n"),
      "",
      "Example panel JSON:",
      `{
        "panels": [
          {
            "index": 0,
            "photoId": "ph_01",
            "narration": "Warm-up turns into a wild routine.",
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

    const content: Anthropic.Messages.ContentBlockParam[] = this.cfg.VISION_PANELS
      ? makeAnthropicUserContent(text, photos.map((p) => p.url))
      : [{ type: "text", text }];

    const resp = await this.client.messages.create({
      model: this.model(quality),
      system,
      messages: [{ role: "user", content }],
      temperature: this.cfg.TEMPERATURE,
      max_tokens: this.cfg.MAX_TOKENS,
    });

    const raw =
      resp.content?.[0]?.type === "text" ? resp.content[0].text ?? "{}" : "{}";
    const json = safeJson<{ panels: unknown }>(raw);

    const panelsValidated = validatePanels(json.panels);
    const panelsCovered = enforcePhotoCoverage(panelsValidated, photos);
    const capped = enforceComicCaps(panelsCovered);

    const validIds = new Set(photos.map((p) => p.id));
    return capped.map((p, i) => ({
      ...p,
      photoId: p.photoId && validIds.has(p.photoId)
        ? p.photoId
        : photos[i % photos.length].id,
    }));
  }

  async genNarrative({
    beats,
    audience = "kids-10-12",
    tone = "wholesome",
    style = "funny",
    wordCount = 90,
    quality,
  }: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
    quality?: Quality;
  }): Promise<{ title: string; narrative: string }> {
    const system = "You write tiny punchy blurbs for comics.";
    const userText = [
      `Write a ~${wordCount} word blurb in 2–3 short lines (not a scene-by-scene recap).`,
      "End on a light punchline.",
      "",
      "Output format (STRICT):",
      "First line: the title of the story.",
      "Then a blank line.",
      "Then the blurb.",
      "",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      `Beats (JSON): ${JSON.stringify(beats).slice(0, 8000)}`,
    ].join("\n");

    const resp = await this.client.messages.create({
      model: this.model(quality),
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userText } as const] }],
      temperature: this.cfg.TEMPERATURE,
      max_tokens: this.cfg.MAX_TOKENS,
    });

    const raw =
      resp.content?.[0]?.type === "text"
        ? (resp.content[0].text ?? "").trim()
        : "";
    return parseTitleNarrative(raw);
  }
}
