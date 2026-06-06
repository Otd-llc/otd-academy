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
import type { CurriculumLevel } from "@prisma/client";
import { GUIDE_STAGES, STAGE_CARD_SKELETONS } from "./stage-skeletons";
import { trackOverlayFor } from "./track-overlays";
import { gotchaBlocksFor, type GuideProjectFacts } from "./gotcha-blocks";
import { guideCardInputSchema, type ContentBlock, type CompletionRef } from "@/lib/schemas/guide";

export interface ComposeInput extends GuideProjectFacts {
  name: string;
  disciplineTaught: string | null;
  // Curriculum level — drives the REQUIREMENTS gate/footer: an L1 guided build
  // gates on its artifact (+ quiz), not the formal REQUIREMENTS_REVIEW checklist
  // (see the REQUIREMENTS exit gate in stages.ts).
  level: CurriculumLevel | null;
}

// The REQUIREMENTS footer affordance for an L1 build: the requirements artifact
// (NOT the design-review checklist). Mirrors how the gate evaluates it.
const L1_REQUIREMENTS_REF: CompletionRef = {
  kind: "artifact",
  subkinds: ["REQUIREMENTS_DOC"],
};

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
    // L1 REQUIREMENTS gates on the artifact, not the review checklist, so the
    // footer affordance must match the gate.
    const completionRef: CompletionRef =
      stage === "REQUIREMENTS" && project.level === "L1"
        ? L1_REQUIREMENTS_REF
        : sk.completionRef;
    const card = {
      stage,
      ordinal: i,
      eyebrow: sk.eyebrow,
      title: sk.title,
      lead: sk.lead,
      contentBlocks: blocks,
      isGate: sk.isGate,
      completionRef,
    };
    // Defense-in-depth: composed cards must satisfy the persisted schema.
    guideCardInputSchema.parse(card);
    return card as ComposedCard;
  });
  return { title: `${project.name} — build guide`, trackSnapshot: project.track, cards };
}
