// lib/story-llm.ts
export type Beat = { photoId: string; caption: string };
export type Panel = { index: number; photoId: string; narration: string; bubbles: string[] };

export async function generateFunnyStory(args: {
  photos: { id: string; url: string }[];
  style?: string;
}) {
  const { photos, style = 'quirky, kid-friendly' } = args;

  // Simple deterministic mock for POC
  const beats: Beat[] = photos.map((p, i) => ({
    photoId: p.id,
    caption: `Beat #${i + 1}: This photo accidentally proves ${i % 2 ? 'time travel' : 'snack diplomacy'}.`,
  }));

  const panels: Panel[] = photos.map((p, i) => ({
    index: i,
    photoId: p.id,
    narration: `Panel ${i + 1}: Our heroes confront a ${i % 2 ? 'mischievous seagull' : 'mysterious vending machine'}.`,
    bubbles: [`"Did that just happen?"`, `"I blame the sandwiches."`].slice(0, 1 + (i % 2)),
  }));

  const narrative =
    `In a ${style} romp, a group of friends tries to explain ` +
    `how their camera captured a saga of snacks, seagulls, and suspicious coincidences. ` +
    `Each new photo raises the stakes—and the number of pastry crumbs.`;

  return {
    title: 'The Case of the Chaotic Camera',
    narrative,
    beatsJson: beats,
    panelMap: panels,
    model: 'mock:v0',
    prompt: 'internal-prompt-mock',
  };
}
