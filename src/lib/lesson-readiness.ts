// Lesson "definition of done" — scores a guide against two bars so "ready" is
// measurable, not a vibe. Pure + testable: the script (scripts/lesson-readiness.ts)
// and the guide hub load the DB rows and feed the parsed cards in.
//
// Two tiers (per docs/plans/2026-06-16-board-design-process.md):
//   • publishable — the free / SEO floor. Content is complete (cards, quizzes,
//     no TODO stubs, a real exam). Media may still be placeholder.
//   • vetted — the premium bar. publishable PLUS real media in every slot and at
//     least one board brought up (the team-built signal).
//
// Pairs with the per-stage authoring scaffold (stage-skeletons.ts): that seeds
// every new stage with a screenshot placeholder + a quiz stub (marked TODO), and
// this flags any left unfilled.

import type { ContentBlock } from "@/lib/schemas/guide";
import { collectEmptyMedia } from "@/lib/guide-media-queue";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { BOARD_CONFIG_OVERRIDES } from "@/lib/kicad/project";

export interface LessonCard {
  stage: string;
  blocks: ContentBlock[];
  /** Blocks in the stored array that failed to parse (parseGuideBlocks).
   *  The render path silently drops these for learners, so readiness must
   *  surface them — omitted/0 = clean. */
  malformedBlocks?: number;
}

/**
 * Map raw guideCard rows to readiness cards with the SAME per-block parser the
 * render path uses. The old all-or-nothing safeParse zeroed a whole card on one
 * malformed block, so readiness reported misleading failures ("no quiz",
 * "missing cards") instead of the real one — and could never gate on malformed
 * content at all.
 */
export function parsedReadinessCards(
  rows: { stage: string; contentBlocks: unknown }[],
): LessonCard[] {
  return rows.map((r) => {
    const { blocks, dropped } = parseGuideBlocks(r.contentBlocks);
    return { stage: r.stage, blocks, malformedBlocks: dropped.length };
  });
}

export interface LessonReadinessInput {
  /** The canonical stage order (GUIDE_STAGES). */
  stages: readonly string[];
  cards: LessonCard[];
  exam: { questions: number } | null;
  /** Count of this project's boards at BROUGHT_UP — the vetted (team-built) signal. */
  broughtUpBoards: number;
  published: boolean;
  /** When supplied, requires an explicit BOARD_CONFIG_OVERRIDES entry for the
   *  slug (the KiCad starter silently exports the 2-layer default otherwise —
   *  wrong for any board that needs inner planes). An empty `{}` entry is a
   *  deliberate 2-layer choice and passes. Omitted = check not emitted. */
  projectSlug?: string;
}

/** Which bar a check gates. "info" checks are reported but gate neither bar. */
export type ReadinessTier = "publishable" | "vetted" | "info";

export interface ReadinessCheck {
  label: string;
  ok: boolean;
  tier: ReadinessTier;
  detail?: string;
}

export interface LessonReadiness {
  checks: ReadinessCheck[];
  /** All publishable-tier checks pass — the free/SEO bar. */
  publishable: boolean;
  /** publishable AND all vetted-tier checks pass — the premium bar. */
  vetted: boolean;
}

// Minimum exam size to count as a real final exam (L1.01 has 18).
const MIN_EXAM_QUESTIONS = 10;

// Crude but effective: a leftover authoring stub anywhere in a card's blocks.
function hasTodo(blocks: ContentBlock[]): boolean {
  return JSON.stringify(blocks).includes("TODO");
}

function cardFor(cards: LessonCard[], stage: string): LessonCard | undefined {
  return cards.find((c) => c.stage === stage);
}

export function assessLessonReadiness(
  input: LessonReadinessInput,
): LessonReadiness {
  const { stages, cards, exam, broughtUpBoards, published, projectSlug } = input;
  const checks: ReadinessCheck[] = [];

  if (projectSlug !== undefined) {
    const explicit = projectSlug in BOARD_CONFIG_OVERRIDES;
    checks.push({
      label: "Explicit KiCad board config",
      tier: "publishable",
      ok: explicit,
      detail: explicit
        ? undefined
        : `add "${projectSlug}" to BOARD_CONFIG_OVERRIDES (an empty {} = deliberate 2-layer)`,
    });
  }

  // ── Publishable tier: content completeness (free / SEO floor) ──────────────
  const missingStages = stages.filter((s) => !cardFor(cards, s));
  checks.push({
    label: "All stage cards present",
    tier: "publishable",
    ok: missingStages.length === 0,
    detail: missingStages.length ? `missing: ${missingStages.join(", ")}` : undefined,
  });

  const noQuiz = stages.filter((s) => {
    const c = cardFor(cards, s);
    return !c || !c.blocks.some((b) => b.type === "quiz");
  });
  checks.push({
    label: "Every stage has a quiz checkpoint",
    tier: "publishable",
    ok: noQuiz.length === 0,
    detail: noQuiz.length ? `no quiz: ${noQuiz.join(", ")}` : undefined,
  });

  const todoStages = cards.filter((c) => hasTodo(c.blocks)).map((c) => c.stage);
  checks.push({
    label: "No TODO authoring stubs remain",
    tier: "publishable",
    ok: todoStages.length === 0,
    detail: todoStages.length ? `TODO in: ${todoStages.join(", ")}` : undefined,
  });

  // A malformed block renders as NOTHING for learners (per-block parse drops
  // it), so publishing with one ships an invisible hole in a live lesson.
  const malformedStages = cards
    .filter((c) => (c.malformedBlocks ?? 0) > 0)
    .map((c) => `${c.stage} (${c.malformedBlocks})`);
  checks.push({
    label: "No malformed blocks",
    tier: "publishable",
    ok: malformedStages.length === 0,
    detail: malformedStages.length
      ? `malformed in: ${malformedStages.join(", ")}`
      : undefined,
  });

  checks.push({
    label: `Final exam (≥ ${MIN_EXAM_QUESTIONS} questions)`,
    tier: "publishable",
    ok: !!exam && exam.questions >= MIN_EXAM_QUESTIONS,
    detail: exam ? `${exam.questions} questions` : "no exam",
  });

  // ── Vetted tier: real media + a team-built board (premium bar) ─────────────
  const noImage = stages.filter((s) => {
    const c = cardFor(cards, s);
    return !c || !c.blocks.some((b) => b.type === "image" && b.src !== "");
  });
  checks.push({
    label: "Every stage has a screenshot/diagram",
    tier: "vetted",
    ok: noImage.length === 0,
    detail: noImage.length ? `no image: ${noImage.join(", ")}` : undefined,
  });

  // "Real media in every slot" — no empty-src image/video placeholders anywhere.
  const emptyMedia = collectEmptyMedia(cards);
  const emptyStages = emptyMedia.map((q) => q.stage);
  checks.push({
    label: "No empty media placeholders remain",
    tier: "vetted",
    ok: emptyMedia.length === 0,
    detail: emptyStages.length ? `empty slots in: ${emptyStages.join(", ")}` : undefined,
  });

  checks.push({
    label: "At least one board brought up",
    tier: "vetted",
    ok: broughtUpBoards > 0,
    detail: `${broughtUpBoards} BROUGHT_UP`,
  });

  // ── Info: reported, gates nothing — it's the action you take once ready ────
  checks.push({
    label: "Published",
    tier: "info",
    ok: published,
    detail: published ? undefined : "not yet published",
  });

  const publishable = checks
    .filter((c) => c.tier === "publishable")
    .every((c) => c.ok);
  const vetted =
    publishable && checks.filter((c) => c.tier === "vetted").every((c) => c.ok);

  return { checks, publishable, vetted };
}
