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

/**
 * A STABLE IDENTITY for a block, so a reference to it survives an edit.
 *
 * WHAT BREAKS WITHOUT IT. Everything outside this table addresses blocks
 * POSITIONALLY -- the video scripts in `docs/video/` cite "blocks [8]-[18] of the
 * SCHEMATIC card", `writeGuideBlockMedia` takes a `blockIndex`, capture slots are
 * numbered. Insert one callout at index 10 and every one of those references now
 * points at different content, with no hash change, no parse error, and no signal
 * of any kind. Across 127 planned videos that is a silent correctness failure
 * with no detector.
 *
 * WHY IT IS OPTIONAL, AND MUST STAY OPTIONAL UNTIL THE BACKFILL IS DONE. The
 * render path `safeParse`s a card and drops the WHOLE card on failure -- a
 * lesson page renders empty, not degraded. Every block in prod today lacks an
 * id, so making this required would blank every guide card in production the
 * moment it deployed. Order of operations is: ship optional, mint on write,
 * backfill (`scripts/backfill-block-ids.ts`), verify 100% coverage, and only
 * then consider tightening.
 *
 * MINTED BY `withBlockIds` in `src/lib/guide-block-ids.ts`, which every write
 * door runs. Do not mint inline -- the whole value is that one function decides.
 */
const blockId = z.uuid().optional();

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prose"), id: blockId, md: z.string().max(4000) }),
  // A section heading (semantic <h2>/<h3>) that breaks a long lesson into
  // scannable, snippet-eligible sections. `text` is plain (no markdown); `level`
  // defaults to 2, use 3 for a sub-heading. SEO: question-style h2s help
  // featured snippets / People-Also-Ask.
  z.object({
    type: z.literal("heading"), id: blockId,
    text: z.string().trim().min(1).max(120),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
  }),
  // `reason` names WHY a section is flagged, in words, and renders in the margin
  // beside the change-bar mark (F7c4). Severity alone only tells the learner how
  // bad it is; the reason tells them what to do about it. Optional, so every
  // existing callout stays valid.
  z.object({
    type: z.literal("callout"), id: blockId,
    severity: z.enum(["critical", "warn", "info"]),
    label: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    reason: z.string().trim().max(120).optional(),
  }),
  // doSteps — a "Do ·" action block whose steps each carry the EVIDENCE that the
  // step worked. Ticking a step reveals its proof (B9b), so the learner confirms
  // rather than guesses. Distinct from `steps` (a plain ordered list) on purpose:
  // `steps` stays exactly as authored everywhere it is already used.
  z.object({
    type: z.literal("doSteps"), id: blockId,
    title: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    steps: z
      .array(
        z.object({
          text: z.string().max(1000),
          /** What the learner should SEE when this step worked. */
          proof: z.string().max(300).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  // traceList — an "Eyeball it ·" verify block: things to check by eye, each with
  // the answer-key line that only opens when the learner says they are not sure
  // (D8c3). The items used to live buried in a body paragraph, where they could
  // not be counted, ticked, or matched against the stage gate that asks for the
  // same three.
  z.object({
    type: z.literal("traceList"), id: blockId,
    headline: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    items: z
      .array(
        z.object({
          text: z.string().max(1000),
          /** Shown only on "not sure": what right looks like. */
          help: z.string().max(300).optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
  z.object({ type: z.literal("steps"), id: blockId, ordered: z.boolean().default(true), items: z.array(z.string().max(500)).min(1) }),
  z.object({ type: z.literal("table"), id: blockId, columns: z.array(z.string()).min(1), rows: z.array(z.array(cellSchema)) }),
  // bomTable — the revision's bill of materials, rendered LIVE from BomLine data
  // (refDes, qty, MPN, manufacturer, description, datasheet) at render time. Like
  // partModel it stores NO data itself — drop it in the BOM_SOURCING card and it
  // stays in sync with the actual BOM. `caption` overrides the default summary.
  // `collapsed` renders the (heavy, jargon-dense) live BOM inside a closed
  // <details> disclosure — reference the learner opens when ready, not a wall
  // of part numbers greeting them on load.
  z.object({ type: z.literal("bomTable"), id: blockId, caption: z.string().max(160).optional(), collapsed: z.boolean().optional() }),
  z.object({ type: z.literal("termRef"), id: blockId, term: z.string().max(80) }),
  z.object({
    type: z.literal("sourceRef"), id: blockId,
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
    type: z.literal("partModel"), id: blockId,
    mpn: z.string().trim().max(80),
    caption: z.string().max(160).optional(),
  }),
  // image — a diagram / illustration. `src` is an app-served asset (root-relative
  // path under /public) or an http(s) URL — same scheme guard as sourceRef, plus
  // empty (so the editor's blank default is valid and renders nothing). `alt` is
  // the required text alternative; `caption` is shown beneath the figure.
  z.object({
    type: z.literal("image"), id: blockId,
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
    // When true, this is a HI-RES, zoomable capture (the "answer key" type): the
    // renderer shows a click-to-open lightbox with pan/zoom, and the capture path
    // shoots at full resolution as a lossless PNG (not the downscaled webp) so a
    // learner can zoom into fine detail like net labels. Takes render precedence
    // over reveal/boxed.
    zoom: z.boolean().optional(),
    // Author instruction for an EMPTY-src placeholder that an admin fills via the
    // in-app screen-capture tool — e.g. "KiCad ▸ Board Setup ▸ Constraints". Shown
    // in the admin capture modal; ignored once `src` is filled.
    captureHint: z.string().max(200).optional(),
    // Crop aspect the capture tool LOCKS to for this placeholder (the operator
    // can't change it — the lesson owns the framing). Defaults to 16:10 if absent.
    aspect: z.enum(["16:10", "16:9", "4:3", "1:1", "free"]).optional(),
  }),
  // video — an mp4 clip, same scheme guard + empty-as-placeholder rule as image.
  // An empty src renders a "to be added" placeholder slot (the alt/caption is the
  // description), so a card can stake out where real build footage will land and
  // the author fills the src in later — no block-type swap.
  z.object({
    type: z.literal("video"), id: blockId,
    src: z.string().max(500).refine(
      (v) => v === "" || /^(https?:\/\/|\/(?!\/))/.test(v),
      "src must be empty, http(s)://, or a root-relative path",
    ),
    alt: z.string().max(200),
    caption: z.string().max(200).optional(),
    // Author instruction for an EMPTY-src placeholder an admin fills via the
    // in-app screen-record tool (e.g. "Route the USB diff-pair"). Shown in the
    // capture modal; ignored once `src` is filled.
    captureHint: z.string().max(200).optional(),
    // Crop aspect the capture tool LOCKS to for this placeholder. Defaults to 16:9
    // for clips if absent.
    aspect: z.enum(["16:10", "16:9", "4:3", "1:1", "free"]).optional(),
    // Narration script for this clip. Non-empty ⇒ this video needs human
    // narration: the capture overlay shows it as a teleprompter (mic already
    // defaults on). Empty/absent ⇒ silent screencast (today's behavior). This is
    // the ONE long field on a content block; everything else is short metadata.
    script: z.string().max(8000).optional(),
  }),
  // youtube — a privacy-enhanced (youtube-nocookie), lazy-loaded embed for the
  // public Library / marketing surface (the in-build mp4 `video` block stays for
  // captured footage). Stores ONLY the bare video id (not a URL) — the renderer
  // builds the youtube-nocookie embed src — so there is no URL-parsing / SSRF
  // surface and the id can't smuggle query params. Empty videoId/title are valid
  // (mirrors the image/video placeholder rule) so the editor's default insert is
  // schema-valid and an unfilled embed renders nothing; the Library save boundary
  // enforces non-empty for a published page. `start` is an optional seconds offset.
  z.object({
    type: z.literal("youtube"), id: blockId,
    videoId: z
      .string()
      .trim()
      .max(20)
      .refine(
        (v) => v === "" || /^[A-Za-z0-9_-]+$/.test(v),
        "videoId must be empty or a bare YouTube id",
      ),
    title: z.string().trim().max(200),
    caption: z.string().max(200).optional(),
    start: z.int().nonnegative().optional(),
    // Optional ISO-8601 date (YYYY-MM-DD) the video was published on YouTube.
    // Not derivable from the id; supplied by the author. Feeds VideoObject
    // JSON-LD `uploadDate`, which Google requires for video rich-result
    // eligibility. Absent ⇒ the VideoObject node stays valid but hygiene-level.
    uploadDate: z.string().trim().max(40).optional(),
  }),
  // quiz — an interactive multiple-choice comprehension check. Client-scored
  // (immediate feedback), and ADDITIVE to the stage work-gate, not a replacement.
  // Each question's `answer` indexes a real option (guarded below); `explain` is
  // revealed once the learner checks their answers.
  z.object({
    type: z.literal("quiz"), id: blockId,
    // Marks THE stage-gate quiz among possibly several quiz blocks in a card:
    // passing this one records the QuizPass the stage exit-gate checks. Other quiz
    // blocks are practice mini-quizzes — they still award per-pick XP, but don't
    // open the gate. Absent ⇒ the FIRST quiz block is the gate (back-compat, so
    // existing single-quiz cards are unchanged). (WI-2)
    gate: z.boolean().optional(),
    prompt: z.string().max(300).optional(),
    questions: z
      .array(
        z
          .object({
            // Stable identity for the Logbook XP ledger (optional; absent →
            // key falls back to a hash of `q`, see question-key.ts).
            id: z.string().trim().min(1).max(60).optional(),
            // Opt-in cross-session REVIEW identity (step 4). Present ⇒ this question
            // enters the spaced-review deck, keyed by
            // `<projectSlug>:<stage>:<reviewId>` (revision-independent, so it
            // survives a revision bump). DECOUPLED from `id`/questionKey on purpose,
            // so marking a question reviewable never re-keys the XP ledger. Slug
            // charset only, since it is a `:`-delimited composite-key segment.
            reviewId: z
              .string()
              .trim()
              .min(1)
              .max(80)
              .regex(/^[a-z0-9-]+$/, "reviewId must be lowercase slug chars")
              .optional(),
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
    type: z.literal("deepDive"), id: blockId,
    summary: z.string().trim().min(1).max(120),
    body: z.string().max(4000),
  }),
  // action — a learner affordance rendered inline, right where the guide tells
  // the student to DO something (e.g. download the KiCad starter). Keeps every
  // required action one click away instead of a hunt for it elsewhere. `action`
  // is a small validated enum; the renderer resolves it to the right button +
  // handler (a client island).
  z.object({
    type: z.literal("action"), id: blockId,
    action: z.enum(["downloadKicadStarter", "downloadReferenceFiles"]),
    label: z.string().trim().min(1).max(120),
  }),
  // vendorCta — an external affiliate call-to-action (GTM monetization). `vendor`
  // is a small validated enum; the SERVER renderer resolves it to the configured
  // referral URL (`src/lib/affiliates.ts`, env-driven) and renders a styled
  // rel="sponsored nofollow" link with an FTC disclosure. The actual affiliate URL
  // is NEVER stored in content — only the vendor key — so the IDs stay in env.
  z.object({
    type: z.literal("vendorCta"), id: blockId,
    vendor: z.enum(["pcbway-order", "jlcpcb", "digikey-bom", "amazon-bench"]),
    label: z.string().trim().min(1).max(120),
    sublabel: z.string().max(200).optional(),
  }),
  // kit — the unified "bench" list: every tool with its Need tier, a "what to
  // look for" note, and one-or-more tagged Amazon picks. `need` is the
  // Required/Recommended/Helpful badge (what you must have). `picks` are buy
  // links: a single pick for commodities, or up to three Budget/Hobby/Pro tiers
  // for the big-ticket, quality-variable items. Each pick stores only an `asin`;
  // the SERVER renderer appends the associate tag from env (AMAZON_ASSOCIATE_TAG)
  // so the tag is NEVER in content. An item with no picks renders as plain text,
  // so the list stages cleanly and products fill in later.
  z.object({
    type: z.literal("kit"), id: blockId,
    intro: z.string().max(300).optional(),
    items: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          need: z.enum(["required", "recommended", "helpful"]).optional(),
          note: z.string().max(200).optional(),
          picks: z
            .array(
              z.object({
                // Free-text chip label — a tier ("Budget"/"Hobby"/"Pro") or any
                // variant ("0.6 mm"/"0.8 mm"). Absent → the chip reads "Shop".
                label: z.string().trim().max(24).optional(),
                asin: z.string().trim().min(1).max(20),
              }),
            )
            .max(3)
            .optional(),
        }),
      )
      .min(1)
      .max(40),
  }),
  // calculator — embeds a LIVE /tools EE calculator inline in a lesson: the exact
  // interactive island from EMBED_ISLANDS, keyed by the tool `slug`. On the web
  // the widget renders; in the PDF (react-pdf can't run an interactive calc) it
  // degrades to a static title + summary + link fallback. `slug` is validated
  // non-empty; its existence against the tools registry is checked at RENDER
  // (unknown slug → skipped on web, slug text in the PDF fallback), mirroring the
  // image/partModel resilience rule. `caption` overrides the default tool title.
  z.object({
    type: z.literal("calculator"), id: blockId,
    slug: z.string().trim().min(1).max(60),
    caption: z.string().max(200).optional(),
  }),
  // math — a KaTeX-rendered formula. `tex` is the LaTeX source, rendered
  // server-side (katex.renderToString, no client JS). `display` true (default) =
  // a centered block equation; false = inline-sized. `plain` is a readable ASCII
  // fallback for the PDF (react-pdf can't run KaTeX) and degrades to `tex` if
  // absent, so supply it for anything with fractions/subscripts the raw LaTeX
  // wouldn't read cleanly as. Author-controlled (admin) content, so the rendered
  // HTML is trusted.
  z.object({
    type: z.literal("math"), id: blockId,
    tex: z.string().trim().min(1).max(500),
    display: z.boolean().optional(),
    plain: z.string().max(500).optional(),
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
