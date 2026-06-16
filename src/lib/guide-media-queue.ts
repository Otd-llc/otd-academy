// Empty-media collector for the admin "capture queue" on the guide hub.
//
// The per-stage authoring scaffold (stage-skeletons.ts) seeds a screenshot
// placeholder on every stage, and authors add more image/video placeholders as
// they write. An empty-`src` image/video block is a slot waiting to be shot.
// This gathers them per stage so the hub can show "N slots to capture" + jump
// links, instead of an admin hunting card-by-card. Pure + testable.

import type { ContentBlock } from "@/lib/schemas/guide";

export interface EmptyMediaSlot {
  type: "image" | "video";
  alt: string;
  captureHint?: string;
}

export interface StageMediaQueue {
  stage: string;
  slots: EmptyMediaSlot[];
}

export function collectEmptyMedia(
  cards: { stage: string; blocks: ContentBlock[] }[],
): StageMediaQueue[] {
  const out: StageMediaQueue[] = [];
  for (const card of cards) {
    const slots: EmptyMediaSlot[] = [];
    for (const b of card.blocks) {
      if ((b.type === "image" || b.type === "video") && b.src === "") {
        slots.push({ type: b.type, alt: b.alt, captureHint: b.captureHint });
      }
    }
    if (slots.length > 0) out.push({ stage: card.stage, slots });
  }
  return out;
}

export function emptyMediaCount(queue: StageMediaQueue[]): number {
  return queue.reduce((n, q) => n + q.slots.length, 0);
}
