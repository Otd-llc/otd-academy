// Zod 4 schemas for the learner-guide teaching layer: content blocks, the
// completionRef adapter, and the guide-card CRUD inputs.
//
// DRY: the ChecklistSubkind / ArtifactSubkind / BoardStatus literal sets are
// the Prisma enum objects themselves (runtime values), imported and fed to
// `z.enum(...)` exactly as the rest of `src/lib/schemas/` does (see
// `checklist.ts`, `board.ts`, `upload.ts`). This keeps the unions in lockstep
// with `prisma/schema.prisma` — no hand-maintained arrays to drift. The Stage
// literal set is reused from `project-dependency.ts` per the plan.
import { z } from "zod";
import { ArtifactSubkind, BoardStatus, ChecklistSubkind } from "@prisma/client";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";

const cellSchema = z.object({
  text: z.string(),
  decoration: z.enum(["ref", "mpn", "badge"]).optional(),
  tone: z.enum(["gold", "blue", "critical", "dim"]).optional(),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prose"), md: z.string().max(4000) }),
  z.object({ type: z.literal("callout"), severity: z.enum(["critical", "warn", "info"]), label: z.string().trim().min(1).max(120), body: z.string().max(2000) }),
  z.object({ type: z.literal("steps"), ordered: z.boolean().default(true), items: z.array(z.string().max(500)).min(1) }),
  z.object({ type: z.literal("table"), columns: z.array(z.string()).min(1), rows: z.array(z.array(cellSchema)) }),
  z.object({ type: z.literal("termRef"), term: z.string().max(80) }),
  z.object({
    type: z.literal("sourceRef"),
    label: z.string().max(160),
    href: z.string().max(500).refine(
      // Reject a leading `//` (protocol-relative open-redirect, e.g. //evil.com)
      // while still allowing http(s):// and root-relative `/path`.
      (v) => /^(https?:\/\/|\/(?!\/))/.test(v),
      "href must be http(s):// or a root-relative path",
    ),
  }),
  // partModel — embeds the three.js .glb viewer for a part identified by MPN.
  // The card route resolves the MPN → the part's VERIFIED MODEL_3D render URL +
  // camera bounds at render time; an MPN with no 3D asset degrades to a caption.
  // `mpn` has no min-length (mirrors termRef) so the editor's empty default is
  // schema-valid; an empty/unknown MPN simply renders nothing.
  z.object({
    type: z.literal("partModel"),
    mpn: z.string().trim().max(80),
    caption: z.string().max(160).optional(),
  }),
  // image — a diagram / illustration. `src` is an app-served asset (root-relative
  // path under /public) or an http(s) URL — same scheme guard as sourceRef, plus
  // empty (so the editor's blank default is valid and renders nothing). `alt` is
  // the required text alternative; `caption` is shown beneath the figure.
  z.object({
    type: z.literal("image"),
    src: z.string().max(500).refine(
      (v) => v === "" || /^(https?:\/\/|\/(?!\/))/.test(v),
      "src must be empty, http(s)://, or a root-relative path",
    ),
    alt: z.string().max(200),
    caption: z.string().max(200).optional(),
    // When set, the image renders inside a COLLAPSED <details> with this string as
    // the summary (a "Check your work ▸" reveal) instead of always-visible.
    reveal: z.string().max(80).optional(),
    // When true, the image renders ALWAYS-VISIBLE inside the same fixed white box
    // as `reveal` (object-contain, no full-width balloon) — a teaching diagram that
    // sits open beside the prose. Ignored when `reveal` is set.
    boxed: z.boolean().optional(),
  }),
  // video — an mp4 clip, same scheme guard + empty-as-placeholder rule as image.
  // An empty src renders a "to be added" placeholder slot (the alt/caption is the
  // description), so a card can stake out where real build footage will land and
  // the author fills the src in later — no block-type swap.
  z.object({
    type: z.literal("video"),
    src: z.string().max(500).refine(
      (v) => v === "" || /^(https?:\/\/|\/(?!\/))/.test(v),
      "src must be empty, http(s)://, or a root-relative path",
    ),
    alt: z.string().max(200),
    caption: z.string().max(200).optional(),
  }),
  // quiz — an interactive multiple-choice comprehension check. Client-scored
  // (immediate feedback), and ADDITIVE to the stage work-gate, not a replacement.
  // Each question's `answer` indexes a real option (guarded below); `explain` is
  // revealed once the learner checks their answers.
  z.object({
    type: z.literal("quiz"),
    prompt: z.string().max(300).optional(),
    questions: z
      .array(
        z
          .object({
            q: z.string().trim().min(1).max(500),
            options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
            answer: z.int().nonnegative(),
            explain: z.string().max(500).optional(),
          })
          .refine((qq) => qq.answer < qq.options.length, {
            message: "answer must index a valid option",
            path: ["answer"],
          }),
      )
      .min(1)
      .max(10),
  }),
  // deepDive — optional "go deeper" disclosure (progressive disclosure): the
  // plain explanation stays on the surface; the math/why lives in a COLLAPSED
  // <details>. `body` is prose (markdown source + inline [[term]] glossary, same
  // as a prose block). Keeps a beginner card readable while serving the curious.
  z.object({
    type: z.literal("deepDive"),
    summary: z.string().trim().min(1).max(120),
    body: z.string().max(4000),
  }),
  // action — a learner affordance rendered inline, right where the guide tells
  // the student to DO something (e.g. download the KiCad starter). Keeps every
  // required action one click away instead of a hunt for it elsewhere. `action`
  // is a small validated enum; the renderer resolves it to the right button +
  // handler (a client island).
  z.object({
    type: z.literal("action"),
    action: z.enum(["downloadKicadStarter"]),
    label: z.string().trim().min(1).max(120),
  }),
]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

// Block cap = a SANITY GUARDRAIL (against a runaway / buggy write), NOT a content
// policy. The render path (guide page) safeParses against this and drops the
// WHOLE card on failure, so keep it well above the richest authored card. 200
// gives generous headroom (the flagship SCHEMATIC card runs ~65 rich blocks); if
// a single stage ever genuinely needs more, the answer is a content-model change
// (sub-sections / multiple cards per stage), not an unbounded single card.
export const guideContentBlocksSchema = z.array(contentBlockSchema).max(200);

export const completionRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("revisionChecklist"), subkind: z.enum(ChecklistSubkind) }),
  z.object({ kind: z.literal("buildChecklist"), subkind: z.enum(ChecklistSubkind) }),
  z.object({ kind: z.literal("boardMeasurements"), steps: z.array(z.string().max(120)).min(1) }),
  z.object({ kind: z.literal("artifact"), subkinds: z.array(z.enum(ArtifactSubkind)).min(1) }),
  z.object({ kind: z.literal("commit"), field: z.enum(["schematicCommit", "layoutCommit"]) }),
  z.object({ kind: z.literal("boardStatus"), statuses: z.array(z.enum(BoardStatus)).min(1) }),
  z.object({ kind: z.literal("none") }),
]);
export type CompletionRef = z.infer<typeof completionRefSchema>;

export const guideCardInputSchema = z.object({
  stage: z.enum(STAGE_VALUES),
  ordinal: z.int().nonnegative(),
  eyebrow: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(80),
  lead: z.string().max(400).nullable().optional(),
  contentBlocks: guideContentBlocksSchema,
  isGate: z.boolean().default(false),
  completionRef: completionRefSchema.nullable().optional(),
});

export const materializeGuideSchema = z.object({ revisionId: z.cuid() });

// editGuideCard edits TEACHING CONTENT ONLY. The gate-wiring fields
// (`isGate` / `completionRef`) drive the authoritative-done mapping and are
// LOCKED — they are deliberately ABSENT from this schema so they can never be
// patched through `editGuideCard`. They are seeded once, at materialize time,
// via direct Prisma in `materializeGuide`. This is the defense-in-depth floor;
// `saveGuideCardSchema` (below) is the strict network boundary on top of it.
export const editGuideCardSchema = z.object({
  id: z.cuid(),
  eyebrow: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  lead: z.string().max(400).nullable().optional(),
  contentBlocks: guideContentBlocksSchema.optional(),
});

// The network-reachable boundary for the inline guide-card editor. `.strict()`
// so a hand-crafted POST that injects gate-wiring keys (`isGate` /
// `completionRef`) — or any other unknown key — is REJECTED with an
// `unrecognized_keys` ZodError rather than silently dropped. `saveGuideCard`
// (guides-form.ts) parses with this and forwards ONLY the parsed result, so the
// locked fields are never reachable through the editor's "use server" door.
export const saveGuideCardSchema = editGuideCardSchema.strict();
export const reorderGuideCardsSchema = z.object({
  guideId: z.cuid(),
  orderedIds: z.array(z.cuid()).min(1),
});
