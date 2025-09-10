// lib/story-llm.ts
import { getStoryProvider } from "./ai/providers";
import type { Beat, Panel } from "./ai/structured";

export async function generateFunnyStory(args: {
  photos: { id: string; url: string }[];
  style?: string;
}) {
  const { photos, style } = args;

  const provider = getStoryProvider();

  // Step A: Beats
  const beats: Beat[] = await provider.genBeats({ photos });

  // Step B: Panels
  const panels: Panel[] = await provider.genPanels({
    beats,
    photos,
    panelCount: photos.length
  });

  // Step C: Narrative
  const narrative = await provider.genNarrative({
    beats,
    style,
    wordCount: 200
  });

  return {
    title: "The Case of the Chaotic Camera",
    narrative,
    beatsJson: beats,
    panelMap: panels,
    model: provider.modelName(),
    prompt: provider.providerName()
  };
}
