// lib/ai/provider-mock.ts
import type { StoryProvider, Photo, TitleNarrative } from "./providers";
import type { Beat, Panel } from "./structured";

function makeMockTitle(photos: Photo[], beats: Beat[]): string {
  const nouns = ["Camera", "Chaos", "Snack", "Seagull", "Vending Machine", "Puppy", "Side Quest"];
  const verbs = ["Case", "Chronicles", "Mystery", "Saga", "Conspiracy", "Incident", "Caper"];
  const idx = (photos.length * 7 + beats.length * 11) % nouns.length;
  const jdx = (photos.length * 13 + beats.length * 5) % verbs.length;
  // e.g., "Snack Saga" / "Puppy Caper"
  return `The ${nouns[idx]} ${verbs[jdx]}`;
}

export class MockProvider implements StoryProvider {
  providerName() { return "mock"; }
  modelName() { return "mock:v0"; }

  async genBeats({ photos }: { photos: Photo[] }): Promise<Beat[]> {
    const count = Math.min(Math.max(5, photos.length), 7);
    const kinds: Beat["type"][] = ["setup","inciting","rising","climax","resolution","button"];
    return Array.from({ length: count }).map((_, i) => ({
      index: i,
      type: kinds[Math.min(i, kinds.length - 1)],
      summary:
        i === 0
          ? "Our heroes discover the camera has a knack for catching chaos."
          : i === count - 1
            ? "They agree the sunglasses deserve assistant-director credit."
            : "Escalating antics involve snacks, timing, and suspicious coincidences.",
      callouts: i % 2 ? ["sunglasses", "gasp"] : ["snack", "spin"],
      imageRefs: [i % Math.max(1, photos.length)],
    }));
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
    return Array.from({ length: panelCount }).map((_, i) => {
      const even = i % 2 === 0;
      const b = beats[i % beats.length];
      const p = photos[i % photos.length];
      return {
        index: i,
        photoId: p.id,
        narration: even
          ? "Warm-up turns into a perfectly unplanned routine."
          : "A ricochet shot convinces everyone fate loves a good snack.",
        bubbles: even
          ? [{ speaker: "Puppy", text: "I do strategy AND snacks." }]
          : [{ text: "Left… other left!" }, { speaker: "Zoey", text: "Totally planned." }].slice(0, 2),
        sfx: even ? ["WHOOSH"] : undefined,
        alt: `Panel ${i + 1} reflecting beat ${b.type}`,
      };
    });
  }

  async genNarrative({
    beats,
    style = "quirky, kid-friendly",
    // audience, tone, wordCount are ignored in mock but kept for signature parity
  }: {
    beats: Beat[];
    audience?: string;
    tone?: string;
    style?: string;
    wordCount?: number;
  }): Promise<TitleNarrative> {
    const arc = beats.map((b) => b.type).join(" → ");
    const narrative = [
      `In a ${style} romp, a crew and one very confident puppy discover their camera loves drama (${arc}).`,
      `Warm-ups become stunts, stunts become legends, and every snack seems to trigger a plot twist.`,
      `By the time the sunglasses demand a producer credit, everyone agrees chaos has impeccable timing.`,
    ].join(" ");

    // Build a deterministic-but-fun title from inputs
    const title = makeMockTitle(
      // fabricate a tiny photo list if caller didn't pass it here; we can infer length from beats.imageRefs
      // but since this method doesn't receive photos, derive a pseudo-length from imageRefs spread
      Array.from({ length: Math.max(1, new Set(beats.flatMap(b => b.imageRefs ?? [])).size) }).map((_, i) => ({ id: String(i), url: "" })),
      beats
    );

    return { title, narrative };
  }
}
