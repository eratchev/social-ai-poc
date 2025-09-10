export const AI_CFG = {
  VISION_BEATS: String(process.env.AI_VISION_BEATS ?? "true").toLowerCase() === "true",
  VISION_PANELS: String(process.env.AI_VISION_PANELS ?? "false").toLowerCase() === "true",
  TEMPERATURE: Number(process.env.AI_TEMPERATURE ?? 0.7),
  MAX_TOKENS: Number(process.env.AI_MAX_TOKENS ?? 1200),
  MODEL: process.env.AI_DEFAULT_MODEL || "",
};
