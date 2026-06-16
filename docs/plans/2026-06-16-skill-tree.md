# Skill Tree Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a role-aware `/courses` skill tree that visualizes the curriculum DAG (22 projects, 33 edges) for public, student, and admin viewers.

**Architecture:** A pure state engine (`computeSkillTree`) turns raw DB rows into a presentational DTO (node states + edges + the single "next" node); a thin DB shell (`buildSkillTree`) feeds it. `/courses` is reworked from a flat grid into a server-rendered track×level grid with a decorative client-side SVG edge overlay; mobile collapses to a vertical critical-path spine. New nullable `publicTitle`/`tagline` columns hold the public copy. `/learn` and `/curriculum` are untouched drill-downs.

**Tech Stack:** Next.js 16 (RSC), Prisma 7 + Neon Postgres, Vitest, Tailwind v4, TypeScript.

**Design doc:** `docs/plans/2026-06-16-skill-tree-design.md` (read it for the why).

---

## Conventions for the executing engineer

- **Test runner:** `pnpm exec vitest run <path>` (single file) / `pnpm exec vitest run` (all).
- **Typecheck:** `pnpm exec tsc --noEmit`.
- **⚠️ `.env.local` `DATABASE_URL` is PROD.** Integration tests and seed scripts mutate the live DB. Follow the existing pattern: unique slugs (`Date.now()` suffix), create-and-clean-up in `beforeAll`/`afterAll`. Never delete rows you didn't create. The shared `esp32-sensor-breakout` seed fixture must survive.
- **Prisma migrations:** hand-author SQL, run `pnpm exec prisma migrate deploy` (resolves env via `prisma.config.ts` → `.env.local` → `DIRECT_URL`). After any schema change: `pnpm exec prisma generate`, restart `next dev`, then run **full** `tsc` + **full** vitest (enum/fixture mirrors break in non-obvious places — see schema-change-tsc-check).
- **Commit cadence:** one commit per task. End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **Imports:** `@/lib/...` path alias. Prisma client is `import { db } from "@/lib/db"`.
- **Do not merge.** Josh reviews locally first (no-merge-verify-local-first).

---

## Task 1: Add `publicTitle` + `tagline` columns

**Files:**
- Modify: `prisma/schema.prisma` (the `Project` model, after `description`)
- Create: `prisma/migrations/<timestamp>_project_public_title_tagline/migration.sql`

**Step 1: Edit the schema**

In `model Project`, add below `description String?`:
```prisma
  publicTitle String?  // keyword-rich public title; render publicTitle ?? name
  tagline     String?  // one-line benefit line shown on the skill-tree node card
```

**Step 2: Hand-author the migration**

Create the migration dir (timestamp format `YYYYMMDDHHMMSS`, match existing dirs in `prisma/migrations/`). `migration.sql`:
```sql
-- AlterTable: public-facing copy for the skill tree (both nullable, no backfill)
ALTER TABLE "Project" ADD COLUMN "publicTitle" TEXT;
ALTER TABLE "Project" ADD COLUMN "tagline" TEXT;
```

**Step 3: Apply + regenerate**

Run: `pnpm exec prisma migrate deploy`
Expected: "1 migration applied" (or "following migration(s) have been applied").
Run: `pnpm exec prisma generate`
Expected: client regenerated, no errors.

**Step 4: Verify the schema compiles**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no type errors — the new optional fields don't break existing reads).

**Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Project.publicTitle + tagline for skill tree"
```

---

## Task 2: Seed the 22 public titles + taglines

**Files:**
- Create: `scripts/seed-public-titles.ts`

Direct-Prisma script (server actions can't be scripted — foundry-headless-scripting). Mirror the structure of `scripts/populate-curriculum-dag.ts` (PrismaClient instance, `main()`, `.finally(() => prisma.$disconnect())`).

**Step 1: Write the script**

Source data = the §5 table in `docs/plans/2026-06-09-public-narrative-skill-tree.md`. Build a `Record<slug, {publicTitle, tagline}>` for all 22 slugs, then:
```ts
for (const [slug, copy] of Object.entries(PUBLIC_COPY)) {
  const res = await prisma.project.updateMany({
    where: { slug },
    data: { publicTitle: copy.publicTitle, tagline: copy.tagline },
  });
  if (res.count === 0) console.warn(`No project for slug ${slug}`);
}
```
Use `updateMany` (idempotent, no throw if a slug is absent). Include all 22 slugs from the §5 table (l1-01…l3-05, l3-de-ads1292r, bn-01…bn-06).

**Step 2: Run it**

Run: `pnpm exec tsx scripts/seed-public-titles.ts` (or the `tsx`/`ts-node` invocation other scripts use — check how `populate-curriculum-dag.ts` is run).
Expected: no "No project for slug" warnings; clean exit.

**Step 3: Spot-check**

Quick read (vitest scratch or a one-off): confirm `l1-01-wroom-breakout` now has `publicTitle = "ESP32-S3 USB-C Breakout Board"`.

**Step 4: Commit**
```bash
git add scripts/seed-public-titles.ts
git commit -m "feat: seed public titles + taglines for the 22 curriculum projects"
```

---

## Task 3: Pure skill-tree state engine (TDD)

This is the testable core. **No DB, no React** — pure functions over plain inputs so node-state precedence, `isNext`, and topo order are unit-tested.

**Files:**
- Create: `src/lib/skill-tree-core.ts`
- Test: `src/lib/__tests__/skill-tree-core.test.ts`

**The contract:**
```ts
export type NodeState =
  | "done" | "available" | "locked-prereq"
  | "locked-paywall" | "preview" | "coming-soon";

export interface RawProject {
  slug: string;
  name: string;
  publicTitle: string | null;
  tagline: string | null;
  track: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
  level: "L1" | "L2" | "L3" | null;
  accessTier: "PUBLIC" | "FREE" | "PREMIUM";
  criticalPath: boolean;
  priceCents: number | null;
  published: boolean;
}
export interface RawEdge {
  fromSlug: string; // dependsOn (prerequisite)
  toSlug: string;   // dependent
  kind: "FOUNDATION" | "DE_RISK" | "SHARED_BLOCK";
}
export interface Viewer {
  signedIn: boolean;
  isAdmin: boolean;
  completedSlugs: Set<string>;   // COMPLETED|MASTERED enrollments
  entitledSlugs: Set<string>;    // PREMIUM unlocks
}
export interface SkillNode extends RawProject {
  title: string;                 // publicTitle ?? name
  state: NodeState;
  isNext: boolean;
  missingPrereqs: { slug: string; title: string }[];
}
export interface SkillTree { nodes: SkillNode[]; edges: RawEdge[]; }

export function computeSkillTree(
  projects: RawProject[], edges: RawEdge[], viewer: Viewer,
): SkillTree;
```

**State precedence (highest first):** `coming-soon` (!published) → `done` (completedSlugs) → `locked-paywall` (PREMIUM && !entitled && !admin) → `locked-prereq` (unsatisfied prereqs && !admin) → `available`/`preview`. For an anon viewer on an actionable published node: PUBLIC → `preview`; FREE/PREMIUM with no session already fell into paywall/account states. Admin: everything published is `available`. Reuse the truth tables in `src/lib/public-access.ts` (`resolveLessonAccess`) — mirror its tier logic, don't diverge.

**`missingPrereqs`:** prerequisites (incoming `from` edges) whose `fromSlug ∉ completedSlugs`.

**`isNext`:** exactly one node. Walk critical-path order (topo sort of `criticalPath` nodes; tie-break level `L1<L2<L3` then track `COMMS<ACT<SENSE<POWER`); pick the first node whose state is `available`. If none available (e.g. fresh anon), pick the first actionable PUBLIC node; if still none, no node is `isNext`.

**Step 1: Write failing tests** covering, at minimum:
- unpublished project → `coming-soon` even if PUBLIC
- completed project → `done` regardless of tier
- PREMIUM, not entitled, not admin → `locked-paywall` (+ price carried through)
- dependent with an incomplete prereq → `locked-prereq` with the prereq in `missingPrereqs`
- admin sees a PREMIUM unpublished-but… (published PREMIUM) node as `available`
- anon on PUBLIC published root → `preview`
- `title` falls back to `name` when `publicTitle` is null
- exactly one node has `isNext`, and it's the earliest available in critical-path order
- a known fixture graph yields a stable topo order (deterministic tie-breaks)

Build small inline fixtures (don't touch the DB). Example shape:
```ts
test("dependent with incomplete prereq is locked-prereq", () => {
  const projects = [mk("a", {published:true}), mk("b", {published:true})];
  const edges = [{fromSlug:"a", toSlug:"b", kind:"FOUNDATION" as const}];
  const viewer = { signedIn:true, isAdmin:false,
    completedSlugs:new Set<string>(), entitledSlugs:new Set<string>() };
  const { nodes } = computeSkillTree(projects, edges, viewer);
  const b = nodes.find(n => n.slug === "b")!;
  expect(b.state).toBe("locked-prereq");
  expect(b.missingPrereqs.map(p => p.slug)).toEqual(["a"]);
});
```
(Write a `mk(slug, overrides)` helper for terse fixtures.)

**Step 2: Run, watch them fail**

Run: `pnpm exec vitest run src/lib/__tests__/skill-tree-core.test.ts`
Expected: FAIL ("computeSkillTree is not a function").

**Step 3: Implement `computeSkillTree`** to satisfy the contract above. Keep it pure and total.

**Step 4: Run, watch them pass**

Run: `pnpm exec vitest run src/lib/__tests__/skill-tree-core.test.ts`
Expected: PASS.

**Step 5: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → PASS.
```bash
git add src/lib/skill-tree-core.ts src/lib/__tests__/skill-tree-core.test.ts
git commit -m "feat(skill-tree): pure state engine for node states + next-node"
```

---

## Task 4: DB shell `buildSkillTree` (integration test)

**Files:**
- Create: `src/lib/skill-tree.ts`
- Test: `src/lib/__tests__/skill-tree.test.ts`

`buildSkillTree(userId: string | null)` loads projects (non-archived), edges, and the viewer's enrollments/entitlements, maps to the `Raw*` shapes, resolves `published = publishedRevisionId != null` and `isAdmin` (via the user's `role`), then delegates to `computeSkillTree`. One pass, no N+1.

```ts
export async function buildSkillTree(userId: string | null): Promise<SkillTree> {
  const [projects, edges] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: null },
      select: { slug:true, name:true, publicTitle:true, tagline:true, track:true,
        level:true, accessTier:true, criticalPath:true, priceCents:true,
        publishedRevisionId:true },
    }),
    db.projectDependency.findMany({
      select: { kind:true,
        dependsOnProject:{ select:{ slug:true } },
        dependentProject:{ select:{ slug:true } } },
    }),
  ]);
  // viewer: if userId, load role + completed enrollments + entitlements
  // ...map and call computeSkillTree
}
```

**Step 1: Write the integration test** (mirror `learner-board-availability.test.ts`: `vi.mock("@/auth")`, create published projects + an edge + a COMPLETED enrollment with unique slugs, assert states, clean up). Assert: anon (`null`) yields tier-only states; a student with a completed prereq sees the dependent `available`; an unpublished project is `coming-soon`.

**Step 2: Run, fail** → `pnpm exec vitest run src/lib/__tests__/skill-tree.test.ts` (FAIL: not a function).

**Step 3: Implement** the shell.

**Step 4: Run, pass.**

**Step 5: Commit**
```bash
git add src/lib/skill-tree.ts src/lib/__tests__/skill-tree.test.ts
git commit -m "feat(skill-tree): DB shell composing enrollment + entitlement state"
```

---

## Task 5: Node card + href resolution

**Files:**
- Create: `src/components/skill-tree/SkillNodeCard.tsx`
- Create: `src/lib/skill-tree-href.ts` (pure)
- Test: `src/lib/__tests__/skill-tree-href.test.ts`

**`hrefForNode(node, viewer)` (pure, TDD):**
- `done`/`available` + signed-in → `/learn/${slug}`
- `preview`/`locked-paywall`/`locked-prereq` → the project outline (card-0). Reuse the path `/courses` cards build today: `/projects/${slug}/${publishedLabel}/guide`. **Note:** the published revision label is needed — extend `buildSkillTree`'s select to include `publishedRevision: { select: { label: true } }` and carry `outlineHref` (or the label) on the node. (Fold this into Task 4 if not yet done.)
- `coming-soon` → no link (card renders non-interactive).

Write tests for each branch, then implement. `pnpm exec vitest run src/lib/__tests__/skill-tree-href.test.ts` red→green.

**`SkillNodeCard`** (server component, presentational): renders `title`, `tagline`, track/level chips, and a state affordance:
- `done` → check + full color
- `available` → glowing border + (if `isNext`) a "Next →" badge
- `locked-prereq` → dimmed + lock; Radix tooltip listing `missingPrereqs` titles (the tooltip dep `@radix-ui/react-tooltip` is already installed; follow existing tooltip usage)
- `locked-paywall` → lock + price chip (`formatMoney(priceCents)` — reuse `src/lib/format-money`)
- `preview` → "Preview" affordance
- `coming-soon` → greyed, `<div>` not `<a>`
Capstones (`l3-01-eeg-front-end`, `l3-05-wireless-hub`) get a ★ glow modifier. Match the existing `CurriculumDag`/`courses` Tailwind token vocabulary (`glass-card`, `command-gold`, `signal-blue`, `status-green`, `alert-red`, `panel-border`, font-display/font-mono).

**Commit** after the card renders in isolation (typecheck green):
```bash
git commit -am "feat(skill-tree): node card + href resolution"
```

---

## Task 6: Desktop grid layout

**Files:**
- Create: `src/components/skill-tree/SkillTreeGrid.tsx`

Server component. Takes `SkillTree` + `viewer`. Lays nodes into a CSS grid (cols = `COMMS·ACT·SENSE·POWER`, rows = `L1·L2·L3`) with **L1.01 as a spanning root row** on top. Reuse the bucketing approach from `CurriculumDag.tsx` (track:level cells, `Unassigned` bucket for null track/level). Each node wraps in a positioned container with `id={`node-${slug}`}` so Task 7's overlay can find it. Render `SkillNodeCard` per node.

This is layout/visual — verified in-browser, not unit-tested. Typecheck must pass.

**Commit:** `feat(skill-tree): desktop track×level grid`

---

## Task 7: SVG edge overlay (client, decorative)

**Files:**
- Create: `src/components/skill-tree/SkillTreeEdges.tsx` (`"use client"`)

Client component absolutely positioned over the grid. On mount + `ResizeObserver` on the grid container, read each node's `getBoundingClientRect()` (by `node-${slug}` id) relative to the container, and draw an `<svg>` with one `<path>` per edge between the prereq's bottom-center and the dependent's top-center (simple cubic Bézier). Color/stroke by `kind`: FOUNDATION solid gold, DE_RISK dashed blue (`stroke-dasharray`), SHARED_BLOCK dotted green. `pointer-events: none` so it never blocks the cards. Guard for missing endpoints (skip that edge). Purely decorative — the grid is fully navigable without it.

Wire it into `SkillTreeGrid` (overlay sibling). Verify in-browser that edges track on resize.

**Commit:** `feat(skill-tree): decorative SVG edge overlay`

---

## Task 8: Mobile critical-path spine

**Files:**
- Create: `src/components/skill-tree/SkillTreeSpine.tsx`

Server component shown `<lg` (grid is `hidden lg:block`, spine is `lg:hidden` — mirror `CurriculumDag`'s responsive split). Renders the `criticalPath` nodes in topo order as a single vertical column of `SkillNodeCard`s joined by a vertical rule. Off-spine nodes attach to their nearest spine parent as a collapsed **"+N related builds"** `<details>` disclosure (native, no JS dep). The `isNext` node gets an `id` so the page can anchor to it (Task 9).

Verify in-browser at a narrow viewport. Typecheck.

**Commit:** `feat(skill-tree): mobile critical-path spine`

---

## Task 9: Rework `/courses` into the role-aware page

**Files:**
- Modify: `src/app/courses/page.tsx`

Resolve session once (`auth()`), derive `userId`/`isAdmin`, call `buildSkillTree(userId)`. Render:
- **Destination banner** (always): "Build an EEG brain-computer interface that commands a swarm of IoT devices" + an `X of 22 projects` count (done count for students; for anon, frame as "the path ahead").
- **Endowed-progress bar** (signed-in, ≥1 done): "~N% toward the BCI".
- `SkillTreeGrid` (desktop) + `SkillTreeSpine` (mobile).
- Keep `export const dynamic = "force-dynamic"` and the existing `metadata`. Update the `<PageHeader>` copy to the tree framing.

Preserve a graceful empty state. Anchor to `#node-<nextSlug>` for signed-in learners (server-set hash or a tiny client effect).

Verify in-browser as: anon, brooke (student), Josh (admin) — see Task 11.

**Commit:** `feat(skill-tree): role-aware /courses skill tree page`

---

## Task 10: Admin inline tier toggle + JSON-LD + SEO

**Files:**
- Create: `src/lib/actions/project-visibility.ts` (server action)
- Create: `src/components/skill-tree/AdminTierToggle.tsx` (`"use client"`)
- Modify: `src/app/courses/page.tsx` (JSON-LD), `src/lib/seo/jsonld.ts` if needed
- Test: `src/lib/__tests__/project-visibility-actions.test.ts`

**Server action** `setProjectAccessTier({ slug, tier })`: `requireAdmin()` (from `auth-helpers`), validate `tier ∈ {PUBLIC,FREE,PREMIUM}` (zod), `db.project.update`, `revalidatePath("/courses")`. Integration test: admin succeeds, non-admin throws "Forbidden" (mirror `require-admin.test.ts` + an existing action test).

**Toggle component:** rendered by `SkillNodeCard` only when `viewer.isAdmin`; a small select/cycle calling the action. Optimistic or revalidate-on-success — keep it minimal.

**JSON-LD:** keep the `courseListJsonLd` (`ItemList`) but build it from all published, non-archived projects (not just PUBLIC), using `publicTitle ?? name`. Items point at each project's outline URL. Confirm the `<JsonLd>` emit still validates (shape unchanged).

Run: `pnpm exec vitest run src/lib/__tests__/project-visibility-actions.test.ts` red→green.

**Commit:** `feat(skill-tree): admin inline tier toggle + courses JSON-LD`

---

## Task 11: Full verification + branch finish

**Step 1: Full test + typecheck**

Run: `pnpm exec tsc --noEmit` → PASS.
Run: `pnpm exec vitest run` → all PASS (watch for enum/fixture-mirror breakage per schema-change-tsc-check).

**Step 2: Build**

Run: `pnpm exec next build` (or `pnpm build`) → confirm `build | pass` (ci-build-not-required-gate: green watch ≠ pass; read the build result).

**Step 3: In-browser verification** (verify skill / webapp-testing). Restart `next dev` (schema changed earlier). Borrow the `authjs.session-token` cookie + Playwright/curl.exe (verifying-auth-gated-pages) for the three roles on `/courses`:
- **Anon:** tree renders, L1.01 actionable, others locked w/ price, edges draw, mobile spine at narrow width, JSON-LD present.
- **Student (brooke):** progress overlay, exactly one "Next →", endowed-progress bar, links go to `/learn/[slug]`.
- **Admin (Josh):** tier toggle present + flips a project, `revalidatePath` reflects it.

Screenshot each. Fix any gaps (loop back to the relevant task).

**Step 4: Push + open PR (do NOT merge)**
```bash
git push -u origin feat/skill-tree
gh pr create --title "feat: role-aware /courses skill tree (#6)" --body "<summary + screenshots>"
```
Body ends with the Claude Code attribution line. Josh reviews locally before any merge.

---

## Out of scope (do not build — see design §9)

React Flow/pan-zoom · XP/points/streaks/leaderboards · project CRUD or dependency editing on the tree · Stripe/checkout wiring (locked nodes link to the outline, not Checkout) · per-track bundle UI · changing `/learn` or `/curriculum`.
