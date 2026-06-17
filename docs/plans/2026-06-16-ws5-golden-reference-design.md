# WS5 — Golden reference + team-build handoff (design)

**Date:** 2026-06-16
**Status:** Design validated (ready for a bite-sized implementation plan)
**Parent:** `docs/plans/2026-06-16-board-design-process.md` (the board-design process run)

## Why

WS5 is the final workstream of the board-design process run: the **golden reference +
team-build handoff** that earns the "vetted" bar. The parent plan's §WS5 framed it as "the
validated revision's KiCad starter + reference gerbers + bring-up measurements become the
board's golden set" plus "the team-build is the existing build/board pipeline used by a team."

The crucial finding from surveying the codebase: **almost the entire team-build pipeline
already exists and is wired.** Errata (model + CRUD + `addressedByRevisionId` fix-rev linking
+ `ErrataPane` UI), the `BoardStatus` machine with `markBringupComplete` (→ `BROUGHT_UP`),
the media-capture pipeline that fills the exact slots `collectEmptyMedia` flags, reference
gerbers (`GERBER_ZIP` admin-curated on the published revision), the KiCad starter
(`BOM_EXPORT` on the published revision), bring-up `Measurement` rows, and — critically — the
**vetted bar itself** (`assessLessonReadiness` already derives `vetted = publishable + real
media everywhere + ≥1 BROUGHT_UP board`, surfaced on the guide hub `ReadinessPanel`). Nothing
"flips"; vetted is a live computed signal (shipped in Phase 0 #139).

So WS5's genuine net-new is **small**, and the real risk is over-building. WS5 makes the
**golden set a first-class, named bundle** of the three proven-board deliverables — surfaced
to operators (a "complete the kit" worklist) and to learners (a consolidated "Proven board
kit"). It adds **no schema**, mirrors the WS4 pure-assessor idiom, and reuses the existing
download/upload plumbing.

## Scoping decisions (locked with Josh, 2026-06-17)

| Decision | Choice |
| --- | --- |
| Primary value of WS5 | **The golden set as one canonical bundle** — a consumable view over the three existing deliverables, not new pipeline machinery. |
| What "golden" keys off | **Derived: `published && vetted`.** No new field, no promote action. A board is golden iff it has a published revision AND `assessLessonReadiness(...).vetted`. Matches the run's "keep it light, no new model" stance (parent decision 8). Resolves parent open-questions Q1 + Q3. |
| Audience / surface | **Both — operator panel + learner kit, both on the complete screen.** The complete screen already hosts the reference-gerber admin uploader + the gerber download, so it's the de-facto golden-set home. |
| Bring-up measurements leg | **Admin-uploaded CSV artifact** (`BRINGUP_MEASUREMENTS_CSV`) on the published revision — treated exactly like reference gerbers (freeze-exempt, reuse the `reference-assets.ts` pattern). All three deliverables become uniform file artifacts resolved by one helper. |
| Errata → next-rev loop | **Out of WS5.** Errata already work end-to-end (create on frozen rev, link `addressedByRevisionId`, `ErrataPane`). The "feed errata back" goal is already met. WS5 stays focused on the golden-set bundle. |
| Assessor structure | **Own pure assessor + all surfaces on the complete screen** (Approach A). Mirrors the WS4 `board-readiness.ts` + panel + Prisma-free load-mapper idiom. Clean split: vetted = lesson quality; golden set = the proven kit assembled. |
| Schema | **None.** All three artifact subkinds already exist; golden is derived. |

## Section A — the pure assessor (`src/lib/golden-reference.ts`)

Mirror `src/lib/board-readiness.ts` / `src/lib/lesson-readiness.ts` exactly: a pure, testable
function, no DB/React/network import.

```ts
export interface GoldenReferenceInput {
  /** project.publishedRevisionId != null */
  published: boolean;
  /** assessLessonReadiness(...).vetted — publishable + real media + ≥1 BROUGHT_UP board */
  vetted: boolean;
  /** BOM_EXPORT artifact present on the published revision */
  hasKicadStarter: boolean;
  /** GERBER_ZIP artifact present on the published revision */
  hasReferenceGerbers: boolean;
  /** BRINGUP_MEASUREMENTS_CSV artifact present on the published revision */
  hasMeasurementsCsv: boolean;
}

export type GoldenDeliverableKey =
  | "kicadStarter"
  | "referenceGerbers"
  | "measurementsCsv";

export interface GoldenDeliverable {
  key: GoldenDeliverableKey;
  label: string;
  present: boolean;
}

export interface GoldenReference {
  /** published && vetted — the derived golden status. NEVER gated on the files. */
  isGolden: boolean;
  /** The three proven-board deliverables, each present-or-not. */
  bundle: GoldenDeliverable[];
  /** All three deliverables attached — the downloadable kit is fully assembled. */
  complete: boolean;
}

export function assessGoldenReference(input: GoldenReferenceInput): GoldenReference;
```

**Two deliberately-separate notions:**
- **`isGolden = published && vetted`** — the lesson is proven (the team built a real board to
  the vetted bar). Never gated on the three files; a board is golden the moment it's
  published + vetted.
- **`complete`** — all three deliverables present. The downloadable *kit* is fully assembled.

A board can legitimately be `isGolden: true, complete: false` ("golden — but the measurements
CSV isn't attached yet"). That gap **is** the operator worklist; it does not un-gold the board.

`bundle` carries the three deliverables in a fixed order (starter, gerbers, measurements) with
human labels, so both surfaces render off the same data.

### Load mapping (`goldenReferenceFromRows`, Prisma-free)

A separate mapper (like `src/lib/board-readiness-load.ts`) keeps the pure lib import-clean. It
takes already-loaded values and builds the `GoldenReferenceInput`, then calls
`assessGoldenReference`. The complete page does the querying (it already loads the project +
one artifact); the mapper does the row→input shaping. `vetted` is computed by the page calling
`assessLessonReadiness` (the page loads the published rev's guide cards' `contentBlocks`, the
exam, and the project's `BROUGHT_UP` board count — the same scoped-load WS4 used on the guide
pages), and the resulting boolean is passed into the mapper.

## Section B — the three uniform deliverables (upload + resolve wiring)

The only net-new plumbing is the **measurements CSV** leg; the other two already work. Reuse +
generalize rather than copy a third time.

### Resolve (learner download) — `src/lib/actions/learner-resources.ts`

The file already has `getKicadStarterUrl` (BOM_EXPORT) + `getReferenceFilesUrl` (GERBER_ZIP),
both delegating to the private `getPublishedRevisionArtifactUrl(input, subkind)`:
- Widen that helper's `subkind` union to include `"BRINGUP_MEASUREMENTS_CSV"`.
- Add `getBringupMeasurementsUrl(input)` delegating with the new subkind.
- The "newest upload wins / null until attached / `requireUser`" semantics carry over for free
  (the resolver is already subkind-parameterized).

Then `src/components/guide/GuideActionButton.tsx`'s `ACTIONS` map gains a
`downloadBringupMeasurements` entry → `{ resolve: getBringupMeasurementsUrl, notReady: "The
bring-up measurements aren't available for this board yet." }`. One new resolver, one new
action key.

### Upload (admin curate) — `src/lib/actions/reference-assets.ts`

The file is hardcoded to `GERBER_ZIP` at `DRC_GERBER`. Generalize its two actions
(`createReferenceGerberUploadUrl` / `recordReferenceGerber`) to accept a `kind: "gerbers" |
"measurements"` discriminator that selects:
- `"gerbers"` → `{ subkind: "GERBER_ZIP", stage: "DRC_GERBER" }` (unchanged default behavior)
- `"measurements"` → `{ subkind: "BRINGUP_MEASUREMENTS_CSV", stage: "BRINGUP" }`

Everything else is subkind-agnostic and stays identical: the deliberate freeze exemption,
`requireAdmin`, `ensureR2Enabled`, the HEAD-verify-and-delete-orphan check, the
published-revision-target guard, and the `revalidatePath` calls. The file header's "scoped
tightly — GERBER_ZIP subkind only" note is updated to name both subkinds.

> **Backward compatibility:** keep the existing exported action names working for the gerber
> path (default the `kind` to `"gerbers"` if the existing call sites pass no discriminator),
> OR thread `kind` through explicitly from both call sites. Implementation plan picks the
> lower-churn option; either way the gerber upload behavior is unchanged.

### Stage choice

`BRINGUP_MEASUREMENTS_CSV` is BRINGUP's analog of the gerbers' `DRC_GERBER` — it's where
bring-up data belongs, and (like `GERBER_ZIP`) it's a revision-allowed subkind, so it parks
cleanly on the published (frozen) revision via the same freeze-exempt path.

## Section C — the two surfaces, both on the complete screen

`src/app/learn/[slug]/complete/page.tsx` already loads `publishedRevisionId` and does one
`GERBER_ZIP` lookup. Extend it to compute the full `GoldenReference`:
- the three artifact-existence checks on the published revision (BOM_EXPORT, GERBER_ZIP,
  BRINGUP_MEASUREMENTS_CSV),
- `vetted` via `assessLessonReadiness` (scoped load: published rev guide-card `contentBlocks`
  + exam + project `BROUGHT_UP` board count),
- then `goldenReferenceFromRows(...)`.

### Learner "Proven board kit" (everyone who reaches the screen)

The existing "Order the proven board" block (gerbers-only) becomes a **"Proven board kit"**
section: the three `GuideActionButton`s — KiCad starter (`downloadKicadStarter`), reference
gerbers (`downloadReferenceFiles`), bring-up measurements (`downloadBringupMeasurements`) —
each rendering its real download when present or a "coming soon" line when not. This is the
*bundle* view; the per-stage download buttons (starter on the SCHEMATIC card, gerbers at
ORDERING/DRC_GERBER) stay exactly as-is — nothing is moved.

### Operator panel (`src/components/BoardReadinessPanel.tsx` sibling) — admin only, same screen

A new `src/components/GoldenReferencePanel.tsx` taking `{ golden: GoldenReference }`:
- a headline chip — green "✓ Golden reference" when `isGolden`, else "Not golden yet —
  {published ? 'needs vetted (real media + a brought-up board)' : 'not published'}",
- the three-item kit worklist (✓ present / ↑ missing), reusing a generalized uploader
  rendered for each deliverable.

Mirror `BoardReadinessPanel`'s `Bar` + checks-list structure + OTD palette
(deep-space / command-gold / signal-blue).

### Generalized admin uploader

Generalize `src/components/learn/ReferenceGerberAdmin.tsx` into a small reusable uploader that
takes the `kind` ("gerbers" | "measurements"), the accept filter (`.zip` vs `.csv`), and the
labels — driving the generalized `reference-assets.ts` actions. The operator panel renders one
per deliverable that supports admin upload (gerbers + measurements). The KiCad starter is
generated by the existing export flow (not a manual upload here), so its worklist row is a
present/missing indicator only (no uploader in WS5).

> **KiCad starter note:** the `BOM_EXPORT` starter is produced by the existing KiCad-export
> generator, not a freeze-exempt manual upload. WS5 surfaces its presence/absence in the kit;
> attaching it stays the existing flow. (If it turns out no starter lands on the *published*
> revision by the existing flow, that's a separate gap — out of WS5 scope; the worklist simply
> shows it missing.)

## Explicitly NOT in WS5

- **No schema / migration** — golden is derived; all three subkinds exist.
- **No errata changes** — errata already work end-to-end (decision: out of WS5).
- **No explicit promote-to-golden action / `goldenAt` field** — golden is derived
  (`published && vetted`).
- **No new media-capture machinery** — the capture pipeline already fills the slots the vetted
  bar checks.
- **No move of the existing per-stage download buttons** — the kit is an additional *bundle*
  view, not a relocation.
- **No public dashboard / guide-hub golden pill** — YAGNI; a possible later follow-up (the
  admin pipeline overview already shows readiness pills and could gain a golden badge cheaply).
- **No KiCad-starter uploader** in WS5 — the starter is generator-produced; WS5 only surfaces
  its presence.

## Constraints honored

- **Prod DB.** `.env.local` `DATABASE_URL` is prod. No migration this round. Run vitest **one
  suite at a time** (never concurrently — corrupts the `esp32-sensor-breakout` fixture;
  `pnpm db:seed` restores). The assessor is pure (no DB in its unit tests); the upload/resolve
  integration test uses a **throwaway revision** and cleans up in `afterAll` (never asserts on
  a real curriculum row's mutable state — the guide-completion prod-coupled-test lesson).
- **`"use server"` files export only async functions** (`learner-resources.ts`,
  `reference-assets.ts`).
- **`pnpm` is not on the Bash-tool PATH** — run pnpm via PowerShell. The gitignored
  `scripts/_phase1.ts` scratch file trips local `pnpm build` (not CI) — sideline it for a true
  local-green build. Stop `next dev` + clear `.next` before the build gate (the build gotcha).
- **Branch off `main`** — WS1–WS4 are all merged + prod-deployed.
- **No merge without Josh's go-ahead.** Subagent-driven (fresh agent per task + code review
  between tasks). Open the PR off main, verify CI **`build | pass` explicitly**, hand back —
  Josh merges (standing go-ahead for this run, but confirm before merging).
- **OTD palette:** deep-space `#08090d` / command-gold `#c8963e` / signal-blue accent.

## Verification

- `pnpm prisma generate` (harmless; no schema change) → `pnpm tsc --noEmit` clean.
- `golden-reference.ts` unit tests (mirror `board-readiness.test.ts`): `isGolden` iff
  published+vetted; `complete` iff all three present; the four corners — not published,
  published-but-not-vetted, golden-but-incomplete, fully golden+complete; the `bundle` order +
  labels stable.
- Measurements upload/resolve integration (throwaway revision): record a
  `BRINGUP_MEASUREMENTS_CSV` on a published revision → `getBringupMeasurementsUrl` presigns it;
  unattached → null; the gerber path still records `GERBER_ZIP` unchanged.
- Full `pnpm vitest run` green (run once, not concurrently).
- `pnpm build` green (sideline `scripts/_phase1.ts`; stop dev + clear `.next` first).
- In-browser: as admin, the complete screen shows the `GoldenReferencePanel` with the right
  verdict + the worklist; upload a measurements CSV → it flips to present; as a finished
  learner, the "Proven board kit" shows the three downloads (real when attached, "coming soon"
  otherwise).
