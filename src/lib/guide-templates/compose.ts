// composeGuide(project): the 22-guide generator's core merge.
//
// For each of the 8 GUIDE_STAGES it composes one card by layering, in order:
//   1. the stage skeleton's base blocks,
//   2. a discipline-taught prose block (REQUIREMENTS only, when present),
//   3. the per-track overlay (neutral when track is null),
//   4. the per-(project, stage) gotcha callouts.
// Cards come out ordinal-ordered 0..7 (REQUIREMENTS → BRINGUP).
//
// Defense-in-depth: each composed card is validated against
// `guideCardInputSchema` (the same schema the persistence layer enforces) before
// it leaves this function, so a malformed skeleton/overlay/gotcha fails loudly
// here rather than at the DB boundary.
import { GUIDE_STAGES, STAGE_CARD_SKELETONS } from "./stage-skeletons";
import { trackOverlayFor } from "./track-overlays";
import { gotchaBlocksFor, type GuideProjectFacts } from "./gotcha-blocks";
import { guideCardInputSchema, type ContentBlock, type CompletionRef } from "@/lib/schemas/guide";

export interface ComposeInput extends GuideProjectFacts {
  name: string;
  disciplineTaught: string | null;
}

export interface ComposedCard {
  stage: string;
  ordinal: number;
  eyebrow: string;
  title: string;
  lead: string | null;
  contentBlocks: ContentBlock[];
  isGate: boolean;
  completionRef: CompletionRef;
}

export interface ComposedGuide {
  title: string;
  trackSnapshot: ComposeInput["track"];
  cards: ComposedCard[];
}

export function composeGuide(project: ComposeInput): ComposedGuide {
  const cards = GUIDE_STAGES.map((stage, i) => {
    const sk = STAGE_CARD_SKELETONS[stage];
    const blocks: ContentBlock[] = [
      ...sk.baseBlocks,
      ...(project.disciplineTaught && stage === "REQUIREMENTS"
        ? [{ type: "prose" as const, md: `**Discipline taught:** ${project.disciplineTaught}` }]
        : []),
      ...trackOverlayFor(project.track, stage),
      ...gotchaBlocksFor(project, stage),
    ];
    const card = {
      stage,
      ordinal: i,
      eyebrow: sk.eyebrow,
      title: sk.title,
      lead: sk.lead,
      contentBlocks: blocks,
      isGate: sk.isGate,
      completionRef: sk.completionRef,
    };
    // Defense-in-depth: composed cards must satisfy the persisted schema.
    guideCardInputSchema.parse(card);
    return card as ComposedCard;
  });
  return { title: `${project.name} — build guide`, trackSnapshot: project.track, cards };
}
