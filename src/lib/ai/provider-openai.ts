// lib/ai/provider-openai.ts
import OpenAI from "openai";
import type { StoryProvider, Photo } from "./providers";
import {
  safeJson,
  validateBeats,
  validatePanels,
  type Beat,
  type Panel,
  COMIC_LIMITS, // ✅ use the caps from structured.ts
} from "./structured";
import { AI_CFG } from "./config";
import { enforcePhotoCoverage } from "./panels";
import { parseTitleNarrative } from "./text";

// ✅ Import the correct types from the SDK:
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

/* ---------------------------------- utils ---------------------------------- */

function makeUserContentWithImages(
  text: string,
  imageUrls: string[]
): ChatCompletionContentPart[] {
  const content: ChatCompletionContentPart[] = [{ type: "text", text }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }
  return content;
}

// Word clamp by word count, not characters — nicer for comics
function clampWords(s = "", maxWords = 10) {
  const parts = s.trim().split(/\s+/);
  if (parts.length <= maxWords) return s.trim();
  return parts.slice(0, maxWords).join(" ").replace(/[.,;:!?-]*$/, "…");
}

// Extra safety pass to enforce comic caps after zod validation
function enforceComicCaps(panels: Panel[]): Panel[] {
  return panels.map((p) => {
    const narration = p.narration
      ? clampWords(p.narration, Math.min(12, COMIC_LIMITS.narrationMax)) // ~words, not chars
      : p.narration;
    const bubbles = (p.bubbles ?? [])
      .slice(0, COMIC_LIMITS.bubblesPerPanel)
      .map((b) => ({
        ...b,
        text: clampWords(b.text, Math.min(10, COMIC_LIMITS.bubbleTextMax)), // ~words
      }));
    return { ...p, narration, bubbles };
  });
}

const MODEL = AI_CFG.MODEL || "gpt-4o-mini";

/* --------------------------------- provider -------------------------------- */

export class OpenAIProvider implements StoryProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  providerName() {
    return "openai";
  }
  modelName() {
    return MODEL;
  }

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
    const system =
      "You are a storyboard editor for a humorous comic. Keep beats short and visual. Return strict JSON.";

    const text = [
      "Create an outline of 5–7 comic beats grounded in the attached photos.",
      `Audience: ${audience}. Tone: ${tone}. Style: ${style}.`,
      `Each beat: index, type (setup|inciting|rising|climax|twist|resolution|button),`,
      `summary (≤ ${COMIC_LIMITS.beatSummaryMax} chars, 1 short sentence), callouts[], imageRefs[] (indices by provided order).`,
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
      "The following images are attached in order. Use them to ground visual details.",
      "",
      "Use these short factual captions to stay accurate (do not invent):",
      photos.map((p, i) => `- [${i}] ${p.caption ? `"${p.caption}"` : "(no caption)"}`).join("\n"),
    ].join("\n");

    const messages: ChatCompletionMessageParam[] = AI_CFG.VISION_BEATS
      ? [
          { role: "system", content: system },
          {
            role: "user",
            content: makeUserContentWithImages(
              text,
              photos.map((p) => p.url)
            ),
          },
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

    const messages: ChatCompletionMessageParam[] = AI_CFG.VISION_PANELS
      ? [
          { role: "system", content: system },
          {
            role: "user",
            content: makeUserContentWithImages(
              text,
              photos.map((p) => p.url)
            ),
          },
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

    // zod-validate + normalize (strings→objects, caps from structured.ts)
    const panelsValidated = validatePanels(json.panels);

    // ensure each photo used at least once before reuse
    const panelsCovered = enforcePhotoCoverage(panelsValidated, photos);

    // final safety: clamp by word counts (not just char caps) for comic feel
    const panels = enforceComicCaps(panelsCovered);

    // Ensure valid photoId; fallback by index if missing
    const validIds = new Set(photos.map((p) => p.id));
    return panels.map((p, i) => ({
      ...p,
      photoId:
        p.photoId && validIds.has(p.photoId)
          ? p.photoId
          : photos[i % photos.length].id,
    }));
  }

  async genNarrative({
    beats,
    audience = "kids-10-12",
    tone = "wholesome",
    style = "funny",
    wordCount = 90, // ✅ shorter blurb by default (2–3 lines)
  }: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
  }): Promise<{ title: string; narrative: string }> {
    const system = "You write tiny punchy blurbs for comics.";

    const user = [
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
