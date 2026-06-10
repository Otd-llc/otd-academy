# OTD Academy — Stage-Gate Redesign (Design)

_2026-06-10. Engineering design for a single, honest, requirements-driven stage gate that
shows every pass condition + live progress, launches a brand-colored per-stage upload modal
preloaded for the required artifact, validates that the artifact actually **passes muster**,
and turns green only when all conditions truly hold — the same pattern for all 8 stages.
Grounded in a code audit (file:line below). Companion to
`2026-06-09-reference-cad-and-schematic-verification-design.md` (the gate/reference model)._

## 1. Why

The stage gate today is split, partly dishonest, and — at SCHEMATIC — outright broken for
learners. Five concrete problems, all confirmed in code:

1. **Two gates that disagree.** The **author** gate (`STAGES.SCHEMATIC.exitGate`,
   [stages.ts:207-215](../../src/lib/stages.ts)) requires only an `ERC_REPORT`. The **learner**
   gate (`learnerExitGate`, [learner-gates.ts:38-49](../../src/lib/learner-gates.ts)) requires
   an `ERC_REPORT` **and** a passed quiz. An admin sees the author gate and advances without a
   quiz — which is exactly the "it let me advance without the quiz" report. Working as designed,
   but the two views tell different stories.
2. **The "✓ Complete" badge is quiz-blind.** `resolveCardCompletion`
   ([guide-completion.ts:295-337](../../src/lib/guide-completion.ts)) computes `complete` from
   the author `exitGate` only — so the badge can say "complete" while the learner gate still
   blocks.
3. **SCHEMATIC upload UI never renders (live bug).** The guide page's local `PROOF_LABEL` map
   ([guide/[stage]/page.tsx:81-84](../../src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx))
   knows `SCHEMATIC_FILE`/`LAYOUT_FILE` but **not** `ERC_REPORT`, which is what
   `learnerProofSubkind("SCHEMATIC")` returns. The upload block is gated on a truthy label
   (`page.tsx:571`), so at SCHEMATIC a learner is asked for an ERC report with **no way to
   upload one.** Stuck.
4. **No content validation — "passes muster" doesn't exist.** The gate is satisfied by the mere
   *existence* of an artifact with the right subkind ([learner-gates.ts:43-46](../../src/lib/learner-gates.ts));
   `recordEnrollmentProof` ([enrollment.ts:298-347](../../src/lib/actions/enrollment.ts))
   validates only size + R2 key prefix. A learner can upload an **empty or unrelated file** and
   the gate goes green. "Clean ERC, zero errors" lives only in instructional prose.
5. **Quiz scoring is client-trusted.** `recordQuizPass`
   ([quiz.ts:11-15](../../src/lib/actions/quiz.ts)) accepts the browser's claimed score; a
   learner can POST `{score: total}` without answering.

**Already correct (no change):** there is **no learner artifacts pane** — upload is inline on
the guide card ([ProofUploadForm](../../src/components/learn/ProofUploadForm.tsx)), and every
artifact-management surface is admin-only (`LEARNER` → `/learn` via
[admin-routes.ts](../../src/lib/admin-routes.ts) + [proxy.ts:45](../../src/proxy.ts)). The
"students shouldn't touch the artifacts pane" requirement is the implemented reality.

## 2. Target — one gate, driven by a per-stage spec

### 2.1 Single source of truth: the gate spec
A new pure module `src/lib/gate-spec.ts` (or extend `stage-skeletons`) maps each stage to its
full requirement set, replacing the scattered `PROOF_LABEL` / `LEARNER_PROOF` /
`learnerProofSubkind` maps that currently drift (problem #3 is a drift bug):

```
GATE_SPEC[stage] = {
  quiz: boolean,                       // is a passed quiz required?
  artifact?: {
    subkind: ArtifactSubkind,          // e.g. "ERC_REPORT"
    label: string,                     // "ERC report"
    accept: string,                    // ".rpt,.txt" — the modal's file filter
    help: string,                      // how to produce it (from learner-proof-help)
    validate?: "erc" | "drc" | null,   // content validator id, or null = presence-only
  }
}
```
Every label/accept/help the UI shows comes from here → the SCHEMATIC `ERC_REPORT` bug (#3)
disappears because there is one map, not three. Initial table (subkinds per the
2026-06-09 reference-CAD doc §2):

| Stage | Quiz | Artifact subkind | accept | validator |
|---|---|---|---|---|
| REQUIREMENTS | ✓ | REQUIREMENTS_DOC | .pdf,.md | none |
| BOM_SOURCING | ✓ | BOM_EXPORT | .csv | none (or row-count) |
| SCHEMATIC | ✓ | ERC_REPORT | .rpt,.txt | **erc** (0 errors) |
| LAYOUT | ✓ | LAYOUT_FILE | .kicad_pcb | none (review checklist) |
| DRC_GERBER | ✓ | DRC_REPORT | .rpt,.txt | **drc** (0 errors) |
| ORDERING | ✓ | PCB_ORDER | .pdf | none |
| ASSEMBLY | ✓ | ASSEMBLY_PROCEDURE | .pdf | none |
| BRINGUP | ✓ | BRINGUP_LOG | .pdf,.md | none |

(Exact subkinds reconcile against `learnerProofSubkind` + `ArtifactSubkind`
[schema.prisma:236-255](../../prisma/schema.prisma); some are placeholders to confirm.)

### 2.2 The unified gate widget (requirements + progress)
Replace the split (admin "STAGE GATE" footer vs. learner "YOUR TRACK" panel) with **one**
`StageGate` that renders the same requirement list to everyone, each row showing live status:

```
Stage gate — SCHEMATIC
  ✓ Quiz passed            (7/7)            ← green check
  ✗ Clean ERC report       [ Upload ERC ]   ← red, opens the modal
  ─────────────────────────────────────
  [ Advance to LAYOUT ]   (enabled only when every row is ✓)
```
- Driven entirely by `GATE_SPEC[stage]` × the learner's `{quizPasses, validatedArtifacts}`.
- The **"Complete" badge** (problem #2) now reads this same composite, so author and learner
  see one truth. Admin keeps a separate, clearly-labeled "advance anyway (admin)" override —
  but the displayed requirements are always the learner's.

### 2.3 The upload modal (brand-colored, preloaded)
A reusable modal built on **`@radix-ui/react-dialog`** — **[DECIDED]** added for this work,
consistent with the Radix popover/tooltip already shipped, and gives focus-trap, ARIA wiring,
and Escape/click-outside dismissal for free. Launched from the gate row, **preloaded from
`GATE_SPEC`**:
- Title "Upload your ERC report", body = the `help` text, a file input with
  `accept=".rpt,.txt"` (today the input has **no `accept`**), brand styling
  (`command-gold` primary, `status-green` success, `alert-red` error, surfaces from
  `.glass-*` in [globals.css](../../src/app/globals.css)).
- Click → pick file → **OK** → existing presign→PUT→record flow → **validate** → on pass the
  gate row flips to ✓ green; on fail the modal stays open and shows the parsed error
  ("ERC found 3 errors — fix and re-export").

### 2.4 Content validation — what makes the green honest (problem #4)
Per-artifact server-side validators, run at record time inside `recordEnrollmentProof` (it
already fetches object metadata; extend to fetch + parse the body for validated subkinds):
- **`erc`**: parse the KiCad ERC report; pass iff **error count == 0** (warnings policy: see
  open questions). KiCad's ERC `.rpt` is a text report ending in a violation list + summary —
  *exact format to confirm against a real export* (Josh's clean L1.01 ERC is the fixture).
- **`drc`**: same shape for the board DRC report at stage 5.
- Store the result on the `Artifact` so the gate reads a boolean, not a re-parse:
  **migration** adds `valid Boolean?` + `validationDetail Json?` (or an errorCount). Per the
  schema-change rule: `prisma migrate deploy` to prod, then full `tsc` + full vitest.
- Gate predicate becomes `artifacts.some(a => a.subkind === spec.subkind && a.valid !== false)`.
- Presence-only stages (no validator) behave exactly as today.

### 2.5 Quiz hardening (problem #5)
Move scoring server-side: `recordQuizPass` receives the submitted answer indices, re-scores
against the card's quiz block (`answer` keys live in the guide content the server already
owns), and writes `QuizPass` only on a genuine pass. Threshold stays **all-correct** (current
`score < total` refusal). Eliminates the `{score: total}` bypass.

## 3. What does NOT change
- No learner artifacts pane is created; upload stays **inline** (now via the modal). Admin
  artifact panes stay admin-only. (§1 "already correct".)
- The clean-ERC-gates-SCHEMATIC decision (PR #58) stands; we're making it *enforced + visible*,
  not redefining it.

## 4. Sub-circuit check-images — the targeting question

You asked whether there's a good way to *target* sub-circuits, or whether manual export is
easier. Honest assessment of the three options:

1. **Hierarchical sheets (the genuinely automatable answer).** Restructure the reference
   schematic so each sub-circuit is its own sheet (Regulator / USB-front-end / Decoupling /
   Boot-Reset / Indicators / Headers) under the root. `kicad-cli sch export svg` then emits
   **one clean SVG per sheet** — no cropping, no edge-bleed, fully scriptable across all 22
   projects. Cost: a one-time schematic restructure, and it likely implies the **student
   starter** becomes hierarchical too (arguably better pedagogy — modular design — but a real
   change to the export and the lesson).
2. **Programmatic bbox-crop of the single SVG.** Parse the `.kicad_sch` placements, group by
   refdes (we already define the groups in the card's §01–§07), compute a per-group bounding
   box, emit cropped SVGs via `viewBox`. One export, automated. Con: shared rails/power symbols
   **bleed at the crop edge**, and the plot→SVG coordinate transform (drawing-sheet origin) is
   fiddly. Result is "good enough," not crisp.
3. **Manual per-sub-circuit export.** Crispest framing, zero tooling — but manual labor per
   section per project, and not reproducible on revision.

**Recommendation:** you're right for the *pilot* — do **L1.01 manually** (6 small images, one
per §0X), prove the pedagogy lands, keep it out of the gate-redesign critical path. If it
works, adopt **hierarchical sheets** as the durable, automatable system (and decide then
whether the student starter goes hierarchical). Don't build the bbox-cropper — it's the worst
of both (tooling cost *and* rough output).

## 5. Workstreams & sequencing
1. **Gate spec + SCHEMATIC upload fix + honest badge** (small, unblocks learners now): the
   `GATE_SPEC` module, route the page labels through it (kills the `ERC_REPORT` drift bug),
   make `resolveCardCompletion`/the badge read the composite learner gate.
2. **Unified gate widget + upload modal** (medium): one `StageGate`, the `GateUploadModal`,
   per-stage `accept`/help preloading.
3. **Content validation** (medium, schema migration): ERC + DRC parsers, `Artifact.valid`,
   validate-at-record, gate reads the boolean.
4. **Quiz hardening** (small): server-side scoring.
5. **Sub-circuit images** (separate): L1.01 manual pilot.

## 6. Open questions
- **ERC warnings:** block on errors only, or warnings too? (Lean: errors block, warnings shown
  but allowed — matches "clean ERC" intent without punishing benign warnings.)
- **DRC report** subkind/flow at stage 5 — mirror ERC exactly?
- **Admin override:** keep an explicit "advance anyway" for authors testing, or drop it?
- **Re-upload:** replace the prior artifact, or version them? (Lean: replace per subkind.)
- **Non-validated stages:** is presence-only acceptable long-term for REQUIREMENTS/BOM/etc., or
  do we want lightweight checks (BOM row count, requirements non-empty)?
- **Hierarchical-sheet starter:** if sub-circuit images go that route, does the student's
  downloaded starter also become hierarchical? (Pedagogy vs. complexity for lesson 1.)

## Appendix — grounding (audited file:line)
- Gates: [stages.ts](../../src/lib/stages.ts) (author), [learner-gates.ts](../../src/lib/learner-gates.ts) (learner), advance guard [enrollment.ts:167-169](../../src/lib/actions/enrollment.ts).
- Completion/badge: [guide-completion.ts](../../src/lib/guide-completion.ts), [guide-widget.ts](../../src/lib/guide-widget.ts), [StageGate.tsx](../../src/components/guide/StageGate.tsx).
- Upload: [ProofUploadForm.tsx](../../src/components/learn/ProofUploadForm.tsx), actions in [enrollment.ts](../../src/lib/actions/enrollment.ts); SCHEMATIC label bug [guide/[stage]/page.tsx:81-84,571](../../src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx).
- Quiz: [QuizBlock.tsx](../../src/components/guide/QuizBlock.tsx), [quiz.ts](../../src/lib/actions/quiz.ts), `QuizPass` [schema.prisma:794-805](../../prisma/schema.prisma).
- Authz: [admin-routes.ts](../../src/lib/admin-routes.ts), [proxy.ts](../../src/proxy.ts).
- Data model: `Artifact`/`ArtifactSubkind` [schema.prisma:236-291](../../prisma/schema.prisma), `Enrollment` [schema.prisma:817-839](../../prisma/schema.prisma).
- Brand tokens + modal pattern: [globals.css:19-46](../../src/app/globals.css), [PartGlanceModal.tsx](../../src/components/parts/PartGlanceModal.tsx).
