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
]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const guideContentBlocksSchema = z.array(contentBlockSchema).max(60);

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
