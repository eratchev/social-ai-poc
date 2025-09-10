// lib/ai/structured.ts
import { z } from "zod";

/**
 * Beat & Panel canonical schemas
 */
export const BeatTypeEnum = z.enum([
  "setup",
  "inciting",
  "rising",
  "climax",
  "twist",
  "resolution",
  "button",
]);

export const BeatSchema = z.object({
  index: z.number().int().nonnegative(),
  type: BeatTypeEnum,
  summary: z.string().min(1).max(300),
  callouts: z.array(z.string().min(1)).optional(),
  imageRefs: z.array(z.number().int().nonnegative()).optional(),
});
export const BeatsSchema = z.array(BeatSchema).min(3).max(12);

export const PanelBubbleSchema = z.object({
  speaker: z.string().min(1).optional(),
  text: z.string().min(1).max(100),
  aside: z.boolean().optional(),
});

export const PanelSchema = z.object({
  index: z.number().int().nonnegative(),
  photoId: z.string().min(1).optional(),
  narration: z.string().min(1).max(280).optional(),
  bubbles: z.array(PanelBubbleSchema).max(3).optional(),
  sfx: z.array(z.string().min(1)).optional(),
  alt: z.string().min(1).max(160).optional(),
});
export const PanelsSchema = z.array(PanelSchema).min(1).max(24);

export type Beat = z.infer<typeof BeatSchema>;
export type Panel = z.infer<typeof PanelSchema>;

/**
 * Robust JSON cleanup + parsing for model outputs
 * - Strips code fences
 * - Slices from first {/[ to last }/]
 */
export function safeJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const first = Math.min(
    ...["{", "["].map((c) => {
      const i = trimmed.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    })
  );
  const last = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  const slice = first !== Number.MAX_SAFE_INTEGER && last > first ? trimmed.slice(first, last + 1) : trimmed;
  return JSON.parse(slice) as T;
}

/**
 * Strong validators used by providers after parsing
 */
export function validateBeats(json: unknown): Beat[] {
  return BeatsSchema.parse(json);
}
export function validatePanels(json: unknown): Panel[] {
  return PanelsSchema.parse(json);
}
