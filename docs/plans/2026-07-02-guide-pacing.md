# Guide pacing: island rail, setup band, resume position

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Visual tasks additionally REQUIRE the `otd-frontend-design` skill (read it before writing any UI).
> Content-edit tasks touch the PROD DB (`.env.local`) — dry-run first, get Josh's go on the printed diff, then `--write`.
> **Another window is dev'ing in this repo: do NOT merge, do NOT touch main, coordinate every commit checkpoint with Josh.**

**Goal:** Make long guide cards (SCHEMATIC = 128 blocks) navigable and resumable: a within-card island jump-nav with progress ticks, a collapsed "set up once" band, hybrid (localStorage + enrollment) resume position, and removal of doubled check-yourself blocks.

**Architecture:** Everything derives from the existing numbered-section convention (callout labels matching `NN · Title`, already dispatched to `SectionHeaderBlock`). A pure scanner produces island metadata; the renderer injects anchors; a client rail consumes them (IntersectionObserver scroll-spy); the same anchors key the resume store. No schema change to contentBlocks; one nullable Json column on Enrollment for cross-device resume. Visual direction is locked by a 5–6 option sandbox BEFORE the final rail is built.

**Tech stack:** Next 16 App Router (server components + client islands), Prisma/Neon, vitest, globals.css design tokens (source of truth per `otd-frontend-design`).

**Locked decisions (Josh, 2026-07-02):**
- Resume store: **hybrid now** (localStorage for everyone, Enrollment sync for signed-in).
- Setup band: **derived collapse** in the renderer, no container block type.
- Rail rollout: **auto everywhere** the numbered convention matches (threshold ≥ 3 islands so 2-section cards skip it).
- Sandbox: **5–6 focused options**, Josh picks in browser.
- v2 progress ticks: approved (tick = island scrolled through).

**Key existing code (read before starting):**
- `src/components/guide/GuideBlocks.tsx` — SERVER component; block dispatch at ~line 1192 (`case "callout"`), `SectionHeaderBlock` regex `/^(\d+)\s*·\s*(.*)$/` at ~863, top-level `GuideBlocks()` map at ~1417.
- `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` — mounts `<GuideBlocks …>` at ~651.
- `src/components/guide/PhaseComb.tsx`, `GuideHoneycomb.tsx`, `QuizBlock.tsx` — the house hex motif the rail must read as a sibling of.
- `prisma/schema.prisma:1013` — `model Enrollment` (resume column lands here).
- `src/lib/schemas/guide.ts` — contentBlocks zod schema (unchanged by this plan).
- Content-edit script pattern: `scripts/_l101-fix-caption.ts` (dry-run/`--write`, parse → transform → re-parse).

---

### Task 0: Branch

```powershell
git checkout main; git pull; git checkout -b feat/guide-pacing
```
No pushes until Josh says. Commit locally per task; he coordinates merges (other window active).

---

### Task 1: Island scanner (pure lib)

**Files:**
- Create: `src/lib/guide-islands.ts`
- Test: `src/lib/__tests__/guide-islands.test.ts`

**Step 1: failing test**

```ts
import { describe, it, expect } from "vitest";
import { scanIslands, RAIL_MIN_ISLANDS } from "@/lib/guide-islands";
import type { ContentBlock } from "@/lib/schemas/guide";

const co = (label: string): ContentBlock => ({ type: "callout", severity: "info", label, body: "x" });
const prose = (): ContentBlock => ({ type: "prose", md: "p" });

describe("scanIslands", () => {
  it("finds numbered-section callouts with anchor ids", () => {
    const blocks = [prose(), co("01 · The regulator"), prose(), co("02 · Decoupling & the module")];
    expect(scanIslands(blocks)).toEqual([
      { num: "01", title: "The regulator", blockIndex: 1, anchorId: "island-01" },
      { num: "02", title: "Decoupling & the module", blockIndex: 3, anchorId: "island-02" },
    ]);
  });
  it("ignores non-section callouts and other block types", () => {
    const blocks = [co("Check yourself"), co("Mode · do · Build it"), prose()];
    expect(scanIslands(blocks)).toEqual([]);
  });
  it("RAIL_MIN_ISLANDS gates 2-section cards", () => {
    expect(RAIL_MIN_ISLANDS).toBe(3);
  });
});
```

**Step 2:** `pnpm exec vitest run src/lib/__tests__/guide-islands.test.ts` → FAIL (module missing). Pure test, no DB, no `.env.test.local` lease needed.

**Step 3: implement**

```ts
// Island metadata derived from the numbered-section callout convention
// ("NN · Title" labels, the same regex SectionHeaderBlock dispatches on).
// The rail, the setup band, and resume-position all key off this scan.
import type { ContentBlock } from "@/lib/schemas/guide";

export const SECTION_LABEL_RE = /^(\d+)\s*·\s*(.*)$/;
export const RAIL_MIN_ISLANDS = 3;

export interface Island {
  num: string;
  title: string;
  blockIndex: number;
  anchorId: string;
}

export function scanIslands(blocks: ContentBlock[]): Island[] {
  const out: Island[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "callout") return;
    const m = (b.label ?? "").match(SECTION_LABEL_RE);
    if (!m) return;
    out.push({ num: m[1], title: m[2], blockIndex: i, anchorId: `island-${m[1]}` });
  });
  return out;
}
```

**Step 4:** rerun → PASS. **Step 5:** `git add … ; git commit -m "feat(guide): island scanner for numbered-section cards"`

---

### Task 2: Anchor injection + rail mount point

**Files:**
- Modify: `src/components/guide/GuideBlocks.tsx` (top-level `GuideBlocks()` only)

**Steps:**
1. In `GuideBlocks()`, compute `const islands = scanIslands(blocks)` once; build `anchorByIndex = new Map(islands.map(i => [i.blockIndex, i.anchorId]))`.
2. In the `.map`, wrap the emitted `<GuideBlock …>` in `<div id={anchorByIndex.get(i)} className="scroll-mt-24">` when the map has the index (plain div otherwise unchanged — keep the `space-y-5` rhythm).
3. When `islands.length >= RAIL_MIN_ISLANDS`, render `<IslandRail islands={islands} storageKey={railKey} />` as a sibling BEFORE the block list (component arrives in Task 4; until then keep this line commented or feature-guard it so the branch always builds).
4. `railKey` = `` `${projectId ?? "anon"}:${cardId ?? "card"}` `` — piggybacks on props GuideBlocks already receives; no page.tsx change.
5. `pnpm exec tsc --noEmit` clean. Load `localhost:3000/projects/l1-01-wroom-breakout/v1/guide/schematic` (dev server via `Start-Process pnpm.cmd dev -WindowStyle Hidden`; use `localhost`, NOT `127.0.0.1`) and confirm `#island-01`…`#island-08` exist in the DOM and `/#island-05` deep-links correctly.
6. Commit.

---

### Task 3: Visual sandbox (GATE — Josh picks before Task 4)

**Files:**
- Create: `src/app/sandbox/island-rail/page.tsx` (temp route, deleted before PR)

**Steps:**
1. **Read the `otd-frontend-design` skill first** (mandatory). globals.css tokens are the source of truth; hex/comb motif; gold hairlines; no filled dark cards for content; no pill radius.
2. Build ONE page rendering 5–6 rail variants side by side against a fake 8-island block column (mock data, real tokens). Variants to cover the real decision axes:
   - A: hex-node vertical rail, right edge (mini sibling of PhaseComb)
   - B: minimal dot + gold hairline spine
   - C: mono numbered ticks (`01`…`08`), gold ring on active
   - D: A with v2 ticks shown (visited = filled hex, current = ringed)
   - E: mobile chip strip (sticky under header, horizontal scroll) — render in a phone-width frame
   - F: E variant with mode-colour accents (orient/do/check tint per island)
3. **LIGHT + DARK toggle (amended 2026-07-02).** The page carries a theme switch that flips a scoped `[data-theme="light"]` wrapper around the whole variant grid, using the token values from the `otd-light-mode` skill's `references/light-tokens.md`. Every variant must be rendered token-only so it flips cleanly — this doubles as the var-override architecture proof (a hardcoded colour will visibly fail to flip, exposing the bug in the sandbox). Josh picks winners seeing BOTH themes. Read `otd-light-mode` for the token block.
4. Each variant labelled, with active/visited/unvisited states visible. Dev-only guard: `if (process.env.NODE_ENV === "production") notFound()`.
5. Josh reviews at `localhost:3000/sandbox/island-rail`, picks desktop + mobile winners in BOTH themes. **Do not proceed to Task 4 without the pick.**
6. Commit the sandbox (it rides the branch; removed in Task 9).

---

### Task 4: IslandRail component (to the winning variant)

**Files:**
- Create: `src/components/guide/IslandRail.tsx` (`"use client"`)
- Modify: `src/components/guide/GuideBlocks.tsx` (un-guard the mount from Task 2)
- Modify: `src/app/globals.css` (rail classes, only if the winner needs non-Tailwind treatment — follow the `.mode-band` precedent)

**Contract (variant-independent):**
```ts
export function IslandRail({ islands, storageKey }: {
  islands: Island[];           // from scanIslands, serializable
  storageKey: string;          // resume/visited persistence key
}) { … }
```
- IntersectionObserver over `islands.map(i => document.getElementById(i.anchorId))`; active = last anchor above the viewport midline.
- **v2 ticks:** an island is `visited` once the NEXT island's anchor (or the document end sentinel) has intersected — i.e. the learner scrolled through it. Persist the visited set + last active anchor to `localStorage[storageKey]` (this record is the same one Task 6 reads — shape: `{ anchorId, visited: string[], ts }`).
- Click → `scrollIntoView({ behavior: "smooth" })` + push `#anchor` (so deep-links copy).
- Desktop: fixed rail per winning variant, hidden below `xl`. Mobile: chip strip per winner, hidden at `xl+`.
- Reduced motion: respect `prefers-reduced-motion` (no smooth scroll).
- SSR-safe: renders static (no active state) until mounted; observers attach in `useEffect`.

**Verify:** dev-server eyeball on SCHEMATIC (8 islands), LAYOUT (9), BRINGUP (3 — smallest), DRC_GERBER (2 → NO rail). tsc clean. Commit.

---

### Task 5: Setup-band derived collapse

**Files:**
- Modify: `src/lib/guide-islands.ts` (+ tests)
- Create: `src/components/guide/SetupBand.tsx` (`"use client"`, a styled `<details>`)
- Modify: `src/components/guide/GuideBlocks.tsx`

**Convention:** a callout whose label matches `/^setup\s*·/i` opens a collapsible region that swallows every following block until the next `Mode · …` band or `NN · …` section header. Explicit in content, zero schema change, flat list preserved (PDF export and readiness counters render blocks linearly and ignore this grouping).

**Step 1: failing test** (extend `guide-islands.test.ts`)

```ts
import { deriveSetupRanges } from "@/lib/guide-islands";

it("derives a setup range from a Setup · callout to the next mode band", () => {
  const blocks = [
    co("Mode · orient · Meet the board"), prose(),
    co("Setup · Get KiCad + the starter open"), prose(), prose(),
    co("Mode · do · Build it, island by island"), co("01 · The regulator"),
  ];
  expect(deriveSetupRanges(blocks)).toEqual([{ start: 2, end: 5, title: "Get KiCad + the starter open" }]);
});
```

**Step 2:** run → FAIL. **Step 3:** implement `deriveSetupRanges(blocks): {start,end,title}[]` (end exclusive; terminate at `/^mode\b/i` or `SECTION_LABEL_RE` callout, or list end). **Step 4:** PASS.

**Step 5: renderer.** In `GuideBlocks()`, partition the map by setup ranges: blocks inside a range render inside `<SetupBand title count defaultOpen>…</SetupBand>` (children are the same `<GuideBlock>` elements — server children of a client `<details>` wrapper is fine). `defaultOpen` = no `localStorage[storageKey]` record yet (first visit) — read client-side inside SetupBand with an SSR-open fallback so crawlers and PDF-adjacent rendering always see content expanded. Summary row: mono kicker `SET UP ONCE`, title, block count, gold hairline — style per otd-frontend-design; get Josh's eyeball in the sandbox route if in doubt.

**Step 6:** tsc + vitest run for the two lib test files. Dev eyeball: SCHEMATIC unaffected (no `Setup ·` label exists in prod content yet — that edit is Task 8). Commit.

---

### Task 6: Resume position — client layer

**Files:**
- Create: `src/lib/resume-position.ts` (pure merge logic) + `src/lib/__tests__/resume-position.test.ts`
- Create: `src/components/guide/ResumePill.tsx` (`"use client"`)
- Modify: `src/components/guide/IslandRail.tsx` (emit position saves), `GuideBlocks.tsx` (mount pill when islands exist)

**Design:**
- Record: `{ anchorId: string, visited: string[], ts: number }` at `localStorage["otd:resume:<projectId>:<cardId>"]` — written by IslandRail (Task 4 already writes it; this task extracts the shared read/write into `resume-position.ts`).
- **No auto-scroll.** On mount, if a record exists, no URL hash, and the record's anchor isn't the first island: show ResumePill — fixed bottom-center, "Resume · 05 · The USB data pair", one click scrolls; dismiss stores nothing and hides for the session.
- Pure merge for the hybrid layer: `mergeResume(local, server)` → newer `ts` wins; visited = union. TDD this function (3 cases: local-only, server-newer, union).

**Verify:** vitest green; dev eyeball (scroll deep into SCHEMATIC, reload, pill appears, click resumes). Commit.

---

### Task 7: Resume position — enrollment sync (PROD MIGRATION — checkpoint with Josh)

**Files:**
- Modify: `prisma/schema.prisma` (Enrollment: `+ resumeState Json?`)
- Create: `prisma/migrations/<ts>_enrollment_resume_state/migration.sql` (hand-authored: `ALTER TABLE "Enrollment" ADD COLUMN "resumeState" JSONB;`)
- Create: `src/lib/actions/resume.ts` (`"use server"`) + `src/lib/__tests__/resume-actions.test.ts`
- Modify: `src/components/guide/IslandRail.tsx` or a small `ResumeSync.tsx` client component

**Rules that bind here (memory-backed):**
- Hand-author SQL; apply with `pnpm exec prisma migrate deploy` (NEVER `migrate dev`); restart `next dev` after `prisma generate`.
- **STOP: get Josh's explicit go before `migrate deploy` — it hits prod Neon, and another window is dev'ing.** Refresh the test-branch pool from prod after the migration.
- After the schema change: FULL `tsc` + FULL `pnpm test` (schema-change-tsc-check).
- `"use server"` file exports ONLY async functions (no type re-exports — runtime crash).

**Shape:** `resumeState` = `{ [stage: string]: { anchorId, visited, ts } }`. Actions: `saveResume(projectId, stage, record)` (auth required, upsert into the caller's enrollment; silently no-op when not enrolled) and read piggybacked on the existing page query (add `resumeState` to the enrollment select in the guide page, pass to GuideBlocks → merge with local via `mergeResume`).
- Client sends saves debounced: on island CHANGE (not raw scroll), max one write / 30 s.
- DB test: throwaway enrollment rows (never the seed fixture's real curriculum rows).

**Verify:** full suite green (~80 s, needs `.env.test.local` present). Signed-in dev eyeball: scroll on device A semantics — save fires, row's `resumeState` populated. Commit.

---

### Task 8: Content edits (PROD DB — dry-run gates)

**Files:**
- Create: `scripts/_l101-setup-band.ts` (gitignored by `/scripts/_*`)
- Create: `scripts/_l101-trim-doubles.ts` (gitignored)

**8a — setup band relabel (AFTER the renderer code is deployed to prod, else the label renders as a plain callout):** relabel SCHEMATIC block [05] `Mode · do · in KiCad · Get set up` → `Setup · Get KiCad + the starter open`. Range then auto-terminates at [31] `Mode · do · … Build it, island by island` — collapsing the ~26-block preamble (blocks 06–30).

**8b — trim doubled check-yourselves (SCHEMATIC):** proposed deletions, confirm on dry-run print:
- Island 04 (USB power & protection): DELETE [72] ("R3/R4's message to a charger" — covered by quiz Q4 + the why-5.1k deepDive); KEEP [73].
- Island 06 (indicator LEDs): DELETE [92] ("why can't you wire an LED straight" — covered by quiz Q3); KEEP [93] (the GPIO0-strap trap, taught nowhere else at this depth).

Both scripts: `guideContentBlocksSchema.parse` before and after, dry-run prints the exact blocks, `--write` only after Josh approves the print. **Render-verify after write** (fetch the prod page, grep for a changed string — the page renders `[]` on any parse failure, so verify the PAGE, not the DB write).

---

### Task 9: Cleanup, verify, PR (NO merge)

1. Delete `src/app/sandbox/island-rail/` from the branch.
2. Full gates: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.
3. Dev eyeball across all 8 L1.01 stage pages + one non-L1.01 published card if any (rail must not regress cards without the convention).
4. Re-run `pnpm exec tsx scripts/lesson-readiness.ts l1-01-wroom-breakout` — confirm no readiness regression (block edits keep quizzes/diagrams intact).
5. Push branch, `gh pr create` (body: what/verify/DB-side-effects). **Do not merge — Josh verifies locally first (standing rule), and another window is mid-flight.**

---

## Execution ordering constraints

- Task 3 gates Task 4 (visual pick). Task 4 gates 5–7 (they extend the rail's store).
- Task 8a requires the Task 5 renderer LIVE IN PROD first — i.e. after the PR merges and deploys. Keep 8a/8b as a post-merge follow-up checklist item in the PR body.
- Task 7's migration is the only schema touch; it needs an explicit Josh checkpoint + test-pool refresh.
- Any commit/push only at task boundaries; never touch main.
