// lib/ai/captions-openai.ts
import OpenAI from "openai";
import { z } from "zod";
import { safeJson } from "./structured";

export type PhotoIn = { id: string; url: string };
export type CaptionOut = { id: string; caption: string; tags: string[] };

const CaptionSchema = z.object({
  photos: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      caption: z.string().min(1).max(240),
      tags: z.array(z.string().min(1)).min(1).max(8),
    })
  ),
});

export async function captionPhotosOpenAI(photos: PhotoIn[]): Promise<CaptionOut[]> {
  if (!photos.length) return [];
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const system =
    "You are a factual photo describer. Be concise and avoid guesses. If unsure, say 'unidentified'. Return STRICT JSON.";

  const userParts: any[] = [
    {
      type: "text",
      text: [
        "For each attached image, return a one-line factual caption and 3–6 short tags.",
        "Focus: obvious landmarks/buildings, readable signage, clothing/props, animals, weather.",
        "No personal identity. No brand guesses unless clearly readable.",
        'STRICT JSON:\n{"photos":[{"index":0,"caption":"...","tags":["..."]}]}',
      ].join("\n"),
    },
  ];
  for (const p of photos) {
    userParts.push({ type: "image_url", image_url: { url: p.url } });
  }

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userParts },
    ],
    temperature: 0.2,
    max_tokens: Math.min(4000, Math.max(500, photos.length * 150)),
  });

  const raw = (resp.choices?.[0]?.message?.content ?? "{}").trim();
  // parse + validate
  const parsed = CaptionSchema.safeParse(safeJson(raw));
  if (!parsed.success) {
    console.warn("[captions] schema fail:", parsed.error.issues);
    return [];
  }

  // map back to original photo ids via index
  const out: CaptionOut[] = [];
  for (const item of parsed.data.photos) {
    const i = item.index;
    if (Number.isInteger(i) && photos[i]) {
      out.push({
        id: photos[i].id,
        caption: item.caption.trim(),
        tags: item.tags.slice(0, 6),
      });
    }
  }
  return out;
}
