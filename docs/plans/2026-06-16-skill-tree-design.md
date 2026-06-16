# Skill Tree — Design (#6, last unbuilt Wave-2 item)

_2026-06-16. The public, role-aware visualization of the curriculum DAG (22 projects,
33 edges, already seeded). Implements §4 of `2026-06-09-public-narrative-skill-tree.md`
and resolves its three open IA questions (route, mobile, title storage)._

> **Status:** design validated in brainstorm (2026-06-16), ready to plan + build on a
> feature branch. Josh reviews locally before any merge.

---

## 1. What this is

One **role-aware `/courses` surface** that renders the curriculum as a skill tree. The
same page adapts to who's looking:

- **Public (anon):** browse the whole tree as a marketing map; PUBLIC nodes are
  actionable ("Start free"), the rest show a lock (+ price chip) and click through to
  the project's outline/preview. The hero marketing + SEO surface.
- **Student (signed-in):** the same tree with *their* progress overlaid — done /
  available / locked — an endowed-progress bar toward the BCI, and a single
  recommended **"Next →"** node.
- **Admin (Josh):** the same tree plus lightweight inline **visibility/tier toggles**
  per node. Full CRUD stays in the existing admin pages.

It is **both the marketing landing surface and the primary nav spine** (plan §4).

### Resolved IA questions (the three §4 open items)

| Question | Decision |
|---|---|
| Route / IA | One role-aware `/courses` (reworks today's flat grid). Keep `/learn` (transcript) and `/curriculum` (raw admin grid) as deeper drill-downs the tree links into. |
| Mobile layout | Vertical **critical-path spine** (not the 2D matrix); off-spine builds collapse under their spine parent. |
| Public-title storage | New nullable `Project.publicTitle` + `Project.tagline` columns; render `publicTitle ?? name`. |

### Render approach (Phase-2 choice)

**Server-rendered grid + SVG edge overlay**, extending the existing `CurriculumDag`
pattern. Data-driven node positions; real `<a>` links (crawlable); only the decorative
edge-drawing layer is client-side. Rejected: React Flow / pan-zoom (client-heavy,
weaker SEO, overkill for a fixed curated 22-node graph) and a hand-authored layout map
(unnecessary maintenance for a data-driven grid).

---

## 2. Data model

One additive, hand-authored Prisma migration (per the prod-migrate workflow —
`prisma migrate deploy`, `.env.local` `DATABASE_URL` is PROD):

```prisma
model Project {
  // ...
  publicTitle String?  // keyword-rich public title; render publicTitle ?? name
  tagline     String?  // one-line benefit line shown on the node card
}
```

Both nullable → the migration is safe with no backfill. `Project.name` stays the
internal QA shorthand ("L1.01 WROOM breakout"); `publicTitle` holds the public string
("ESP32-S3 USB-C Breakout Board").

A separate **reviewed seed script** (`scripts/seed-public-titles.ts`, direct-Prisma per
the headless-scripting constraint — server actions can't be scripted) writes the 22
titles + taglines from plan §5.

**Follow-on note:** once `publicTitle` exists, other public surfaces (`/courses` cards
today, `/learn`) should render `publicTitle ?? name` too. In-scope for `/courses`;
`/learn` is a small consistency follow-up.

---

## 3. The tree-data builder

`src/lib/skill-tree.ts` exposes one function so the page stays a thin renderer:

```ts
buildSkillTree(userId: string | null): Promise<{ nodes: SkillTreeNode[]; edges: SkillTreeEdge[] }>

SkillTreeNode {
  slug, publicTitle, tagline, track, level, accessTier,
  criticalPath, priceCents,
  published: boolean,                       // publishedRevisionId != null
  state: "done" | "available" | "locked-prereq" | "locked-paywall"
       | "preview" | "coming-soon",
  isNext: boolean,                          // exactly one node, the recommended step
  missingPrereqs: { slug; publicTitle }[],  // for the locked-prereq tooltip
  href: string,                             // role/state-appropriate target
}
SkillTreeEdge { fromSlug, toSlug, kind }    // FOUNDATION | DE_RISK | SHARED_BLOCK
```

**Composes existing helpers — does not reinvent:**
- `learnerBoardAvailability(userId)` → prereq satisfaction + `missingPrereqs`.
- `resolveLessonAccess({...})` → the tier/paywall dimension.
- Enrollment statuses (COMPLETED/MASTERED) → `done`.

**Anonymous (`userId === null`):** skip availability; state is tier-only
(PUBLIC → actionable, FREE/PREMIUM → locked, unpublished → coming-soon).

**State precedence (per node):** `coming-soon` (unpublished) → `done` → `locked-paywall`
(tier/entitlement) → `locked-prereq` (DAG) → `available` → `preview`.

**`isNext`:** first node in critical-path order that is `available` (student) or first
actionable PUBLIC node (anon). Exactly one.

**Critical-path order:** topological sort of the DAG restricted to `criticalPath === true`,
tie-broken by level then track. Deterministic — no hand-maintained sequence.

---

## 4. Desktop rendering — grid + SVG edges

- **Layout:** CSS grid, **columns = tracks** (COMMS · ACT · SENSE · POWER), **rows =
  levels** (L1→L2→L3), with **L1.01 as a spanning root row** at the top. Extends the
  `CurriculumDag` grid skeleton. Null track/level → "Unassigned" bucket below (existing
  behavior, preserved).
- **Edges:** absolutely-positioned `<svg>` overlay. Each node carries `id="node-${slug}"`;
  a client hook reads offset rects on mount + `ResizeObserver` and draws `<path>` curves.
  Decorative + JS-gated — JS off still yields the full navigable tree, just no lines.
- **Edge color by kind:** FOUNDATION → solid gold · DE_RISK → dashed blue ·
  SHARED_BLOCK → dotted green (battery fan-out).
- **Node state → visual:** done = check/full color · available = glowing border ·
  locked-prereq = dimmed + lock (tooltip lists missing prereqs) · locked-paywall = lock +
  price chip · preview = "Preview" affordance · coming-soon = greyed, non-link.
- **Capstones** (L3.01 EEG, L3.05 hub) get a distinct ★ glow at the convergence.

---

## 5. Role-aware behavior

Page resolves session + role once (existing `auth()` + admin check), then
`buildSkillTree` returns role-appropriate `state`/`href`.

- **Public:** tier-only states; persistent **destination banner** ("Build an EEG
  brain-computer interface that commands a swarm · X of 22 projects"); locked nodes →
  project outline (card-0 REQUIREMENTS, already public-eligible). PUBLIC node → guide.
- **Student:** progress overlay + **endowed-progress bar** (≥1 done → "~N% toward the
  BCI"; goal-gradient) + one **"Next →"** node. Nodes → `/learn/[slug]`.
- **Admin:** inline **visibility/tier toggle** + publish indicator per node, via a small
  server action reusing the established admin-guard pattern. No add/remove/dependency
  editing here — that stays in `/projects` + `/curriculum`.

---

## 6. Mobile — vertical critical-path spine

Below `lg`: same DTO, rendered as a **single vertical scroll** along the `criticalPath`
trunk (L1.01 → … → capstones). Full-width cards in path order, connected by a vertical
rule (no SVG geometry on the smallest screens).

- **Branches:** off-spine nodes attach to their spine parent as a collapsed
  **"+N related builds"** disclosure (tap to expand). Keeps the scroll short + linear
  (research: linear path > branching tree for outcomes) without hiding anything.
- **Anchor:** for signed-in learners the spine anchors/scrolls to the `isNext` node on
  load.

---

## 7. SEO

- Nodes are server-rendered `<a href>` with `publicTitle` + `tagline` as visible text —
  crawlable; SVG edge layer is decorative + JS-gated.
- Keep the existing `ItemList`/`Course` JSON-LD, now built from all visible (non-archived,
  published) projects (not just PUBLIC), `isAccessibleForFree` reflecting tier.
- Public titles become the indexable anchor text (plan §5).

---

## 8. Edge cases

- **Unpublished / no `publishedRevisionId`** → `coming-soon` (greyed, non-link). Only
  L1.01 is fully built today; the §4 "path ahead" framing expects this.
- **Null track/level** → "Unassigned" bucket (existing).
- **`publicTitle` null** → `?? name` fallback; never blank.
- **Edge endpoint missing** → edge skipped, never a dangling line.

---

## 9. Explicit non-goals (YAGNI)

- No React Flow / pan-zoom / canvas.
- No XP / points / streaks / leaderboards (research-rejected — streak anxiety,
  point-farming).
- No full project CRUD on the tree (stays in `/projects` + `/curriculum`).
- No pricing/checkout wiring — gated behind "finish L1" (roadmap). Locked nodes show a
  price chip but click through to the existing outline, **not** Stripe.
- No per-track bundle UI.

---

## 10. Build order (for the plan)

1. Migration: add `publicTitle` + `tagline` (hand-authored SQL → `prisma migrate deploy`;
   run `tsc` + full vitest after, per the schema-change-check rule).
2. `scripts/seed-public-titles.ts` — backfill 22 titles/taglines from plan §5.
3. `src/lib/skill-tree.ts` — `buildSkillTree` + unit tests (state precedence, `isNext`,
   topo order, anon vs student).
4. `/courses` page rework → server grid + node cards (publicTitle/tagline, state visuals),
   render `publicTitle ?? name` on the existing cards path during transition.
5. Client SVG edge overlay (`ResizeObserver`, kind-colored paths).
6. Mobile spine + branch disclosure.
7. Admin inline tier toggle (server action + guard).
8. JSON-LD update + SEO pass.
9. Verify in-browser as anon / brooke (student) / Josh (admin); confirm `build | pass`.

---

## Appendix — source facts

- DAG data + names: `scripts/populate-curriculum-dag.ts` (`name` = internal shorthand).
- Existing renderer: `src/components/CurriculumDag.tsx`, `src/app/curriculum/page.tsx`.
- Public funnel today: `src/app/courses/page.tsx` (flat grid, PUBLIC-only).
- Availability: `src/lib/learner-board-availability.ts`.
- Access tiers: `src/lib/public-access.ts` (`resolveLessonAccess`).
- Narrative + tiering + §5 title table: `docs/plans/2026-06-09-public-narrative-skill-tree.md`.
