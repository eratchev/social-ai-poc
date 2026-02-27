// lib/ai/structured.ts
import { z } from "zod";

/**
 * Comic-oriented caps (exported so other modules can reuse)
 */
export const COMIC_LIMITS = {
  beatSummaryMax: 120,
  narrationMax: 80,
  bubbleTextMax: 80,
  bubblesPerPanel: 2,
  maxBeats: 12,
  maxPanels: 24,
} as const;

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
  summary: z.string().min(1).max(COMIC_LIMITS.beatSummaryMax),
  callouts: z.array(z.string().min(1)).optional(),
  imageRefs: z.array(z.number().int().nonnegative()).optional(),
});
export const BeatsSchema = z.array(BeatSchema).min(3).max(COMIC_LIMITS.maxBeats);

export type Beat = z.infer<typeof BeatSchema>;

/**
 * Panel schemas
 */
export const PanelBubbleSchema = z.object({
  speaker: z.string().min(1).optional(),
  text: z.string().min(1).max(COMIC_LIMITS.bubbleTextMax),
  aside: z.boolean().optional(),
});

// Accept bubble either as object or as plain string -> normalize to { text }
const PanelBubbleInput = z.union([
  PanelBubbleSchema,
  z
    .string()
    .min(1)
    .max(COMIC_LIMITS.bubbleTextMax)
    .transform((t) => ({ text: t })),
]);

const PanelBase = z.object({
  index: z.number().int().nonnegative(),
  photoId: z.string().min(1).optional(),
  narration: z.string().min(1).max(COMIC_LIMITS.narrationMax).optional(),
  sfx: z.array(z.string().min(1)).optional(),
  alt: z.string().min(1).max(160).optional(),
});

// Input schema: bubbles may be strings or objects
const PanelInputSchema = PanelBase.extend({
  bubbles: z.array(PanelBubbleInput).max(COMIC_LIMITS.bubblesPerPanel).optional(),
});

// Final normalized Panel schema (objects only)
export const PanelSchema = PanelBase.extend({
  bubbles: z.array(PanelBubbleSchema).max(COMIC_LIMITS.bubblesPerPanel).optional(),
});

export type Panel = z.infer<typeof PanelSchema>;

// Input parser that normalizes to the final shape
export const PanelsSchemaInput = z
  .array(PanelInputSchema)
  .min(1)
  .max(COMIC_LIMITS.maxPanels)
  .transform((panels) =>
    panels.map((p) => ({
      ...p,
      bubbles: p.bubbles?.map((b) => ("text" in b ? b : { text: String(b) })),
    }))
  );

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
  const slice =
    first !== Number.MAX_SAFE_INTEGER && last > first
      ? trimmed.slice(first, last + 1)
      : trimmed;
  try {
    return JSON.parse(slice) as T;
  } catch {
    const preview = raw.slice(0, 100);
    throw new Error(`safeJson: invalid JSON after stripping fences: ${preview}`);
  }
}

/**
 * Strong validators used by providers after parsing
 */
export function validateBeats(json: unknown): Beat[] {
  const beats = BeatsSchema.parse(json);
  // Safety: trim to max beats
  return beats.slice(0, COMIC_LIMITS.maxBeats);
}

export function validatePanels(json: unknown): Panel[] {
  const normalized = PanelsSchemaInput.parse(json);
  const panels = z.array(PanelSchema).parse(normalized);

  // Safety: enforce bubbles cap & trim to max panels
  return panels
    .map((p) => ({
      ...p,
      bubbles: p.bubbles ? p.bubbles.slice(0, COMIC_LIMITS.bubblesPerPanel) : undefined,
    }))
    .slice(0, COMIC_LIMITS.maxPanels);
}
