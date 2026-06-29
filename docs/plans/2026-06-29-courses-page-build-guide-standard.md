# Plan — bring `/courses` up to the build-guide visual standard

**Status:** scoped, not started · **Branch:** `feat/courses-build-guide-standard` (off `main` @ the
`#207` merge) · **Owner decision pending** (see Open question).
**Execute with the executing-plans skill, task by task.** This is a UI/design upgrade — no schema,
no gates. Verify each task on **localhost (not 127.0.0.1 — client islands don't hydrate cross-origin)**.

## Goal

Make `/courses` (the public skill tree) look + feel like the build-guide hub: the polished
**number-hero honeycomb** (`GuideHoneycomb`) for the path body, plus a **compact serpentine nav
rail** (`GuideStepper` style) at the top. Today the two surfaces use different design languages;
unify them on the build-guide standard.

## Current state (the gap)

`/courses` — `src/app/courses/page.tsx` (RSC, `force-dynamic`, anon-readable, no `requireUser`):
- `PageHeader` (eyebrow "SKILL TREE", "Build it for real") → keep.
- A per-path banner (`glass-card`): path kind, label, blurb, `done/total`, an endowed progress bar,
  a no-JS "jump to your next step" anchor (`#node-<slug>`), and an All-Access-Pass pointer → keep.
- **`SkillTreePath`** (`src/components/skill-tree/SkillTreePath.tsx`) — the body. A **vertical list**:
  each node is a row of `[HexMedallion on a copper-trace rail | SkillNodeCard slab]`, with a
  "★ Your destination" divider before the goal. **This is the thing to replace.**
- A "Go further" gallery of `PathCard`s (other paths) → keep.
- `JsonLd` (ItemList), SEO metadata → keep.

`SkillNodeCard` (`src/components/skill-tree/SkillNodeCard.tsx`) — what each course node carries:
track chip (SENSE/ACT/POWER/COMMS → green/gold/red/blue), level chip, capstone ★
(`CAPSTONE_SLUGS`), title (`font-display`), tagline (serif italic), and a per-**`NodeState`**
affordance. **8 states** (`src/lib/skill-tree-core`): `done`, `available` (+ `isNext`),
`locked-prereq` (Radix `Tooltip` listing `missingPrereqs`), `locked-account`, `locked-paywall`
(price via `resolveBuyPriceCents`, today → "Premium"), `preview`, `coming-soon` (waitlist).
`hrefForNode` resolves the click target (null → non-interactive `<div>`). Admin sees
`AdminTierToggle`. `SkillNode` data: `slug, title, tagline, track, level, state, accessTier,
priceCents, stripePriceId, missingPrereqs, publishedLabel, isNext`.

## The build-guide standard (what to match)

- **`GuideHoneycomb`** (`src/components/guide/GuideHoneycomb.tsx`, `"use client"`) — tessellating
  pointy-top **number-hero** honeycomb GRID: `PER_ROW=3` (→ 2-across on phones, serpentine,
  offset rows), `MAX_NODE=360`, `RATIO=1.1547`, fills width via a measured `ResizeObserver`. Each
  hex: a big **outline numeral** (inline `fontSize = w*0.43`) owning the top third, bold title
  (`clamp(14px,11cqw,32px)`), 2-line lead (`clamp(11px,4.8cqw,15px)`, **hidden ≤200px** cells via
  `@container`), a status **chip** (Done / In progress / Next / Blocked) pinned to the lower point.
  States: `done` (honey-gradient fill, dark text), `current` (gold stroke + `gh-pulse` glow),
  `pending`/`blocked`. CSS: `.gh-*` in `globals.css` (~L132-186), `stroke-width: 3`,
  `container-type: inline-size`.
- **`GuideStepper`** (`src/components/guide/GuideStepper.tsx`, `"use client"`) — the compact
  serpentine rail. Flat-top hex cells, dynamic size (`TARGET_NODE=82`, `MAX_NODE=104`,
  `MIN_ROW=2`), **wraps serpentine before shrinking**, each cell = step number + short divider
  rule + 3-letter code (`STAGE_ABBR`). One SVG polyline connector (solid through the current step,
  dotted after) with an **opaque backdrop polygon per cell** so the line never shows through;
  current cell pulses via `gs-pulse` (glow only, never opacity). **Already rendered on all
  build-guide stage pages** via the single `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx`.

## Open question (resolve in Task 1 — owner decision)

"…and small serpentine nav on all stages" — two readings:
1. The serpentine rail is **already on all build-guide stage pages** (one `[stage]` file renders it)
   → this clause is just "verify parity" (Task 5), and the real work is the `/courses` honeycomb.
2. `/courses` should **also** carry a small serpentine path-nav rail (the selected path's course
   sequence as a compact serpentine) above the honeycomb — i.e., make `/courses` mirror the
   build-guide experience (rail on top + honeycomb body).

**Recommended:** do both — the `/courses` honeycomb (core) AND a path-nav serpentine rail on
`/courses` (reading 2 is the richer, more-consistent result). Confirm with the owner before building
the rail; the honeycomb is unambiguous and can start immediately.

## Tasks

### T1 — Confirm scope (owner)
Confirm the Open question (honeycomb only, or honeycomb + a `/courses` serpentine path rail). Default
to both. No code.

### T2 — `SkillHoneycomb` (the path body, number-hero honeycomb)
Generalize `GuideHoneycomb` into a shared honeycomb the skill tree can use, OR add a sibling
`src/components/skill-tree/SkillHoneycomb.tsx` (`"use client"`) reusing the `.gh-*` CSS. Map each
ordered `SkillNode` → a hex:
- **numeral** = the node's 1-based position in the path order (the honeycomb already implies sequence).
- **title** = `node.title`; **lead** = `node.tagline` (clamped, hidden on small cells).
- **chip / fill** = derived from the 8 `NodeState`s: `done` → honey-fill + "Done"; `available` →
  current-style gold glow + "Start →" (and the gold "Next" emphasis when `isNext`); `coming-soon`
  → dim + "Soon"; `locked-prereq` → dim + "Locked" (keep the Radix prereq `Tooltip`);
  `locked-account` → "Sign in"; `locked-paywall` → "Premium"/price; `preview` → "Preview".
- **accent** = the track color (SENSE/ACT/POWER/COMMS); **capstone** (`CAPSTONE_SLUGS`) → the ★ glow.
- **link** = `hrefForNode(node, viewer)`; null → non-interactive. Keep the `aria-label`, the
  `id="node-<slug>"` anchor (the no-JS "jump to next" target), and admin `AdminTierToggle`.
- Mark the path GOAL hex (`goalSlug`) distinctly (the build's capstone destination).
Verify: every state renders legibly, the honeycomb fills width + wraps to 2-up on phones, the
prereq tooltip still works, `#node-<slug>` anchors resolve.

### T3 — `/courses` serpentine path-nav rail (if Task 1 says yes)
Add a `GuideStepper`-style compact rail at the top of `/courses` showing the **selected path's**
course sequence (number + short code/abbr per course), current = the path-local `nextNode`, done =
completed. Reuse the stepper's measure-and-wrap + connector + `gs-pulse`. It's a nav overview; the
honeycomb below is the detail. (A course has no 3-letter code like the stages — derive an abbr from
the slug/track or use the position number only.)

### T4 — Wire into `courses/page.tsx`
Replace `<SkillTreePath …>` with `[optional rail] + <SkillHoneycomb …>`. Keep: `PageHeader`, the
per-path banner, the "Go further" `PathCard` gallery, `JsonLd`, SEO metadata, `force-dynamic`, the
no-JS anchor, and signed-in progress. Keep `SkillTreePath`/`HexMedallion` only if still referenced;
otherwise delete them (and `SkillNodeCard` if fully absorbed — but the `[slug]` preview page may use
it; check first).

### T5 — Stage-page parity check
Confirm the serpentine rail renders on **every** build-guide stage (it's one `[stage]` file, so it
should). Spot-check a few stages. No change expected.

### T6 — Responsive + a11y + verify
Desktop + mobile (the honeycomb wraps 3→2; the rail wraps serpentine). Keyboard focus on hex links,
reduced-motion (the pulses already guard it), the prereq tooltip. Screenshot `/courses` desktop +
mobile into `docs/screenshots/` and refresh the README gallery shot if it changed.

## Constraints / gotchas

- `/courses` is **RSC + anon-readable** (`force-dynamic`, no `requireUser`). The honeycomb/rail are
  **client islands** (`"use client"`) — fine as children, but don't pull client-only code into the
  page module.
- **8 `NodeState`s** must all map cleanly (don't drop the prereq tooltip, the paywall price, or the
  waitlist affordance). The build-guide only has 4 states — extend the mapping, don't assume parity.
- Keep **SEO** (ItemList JSON-LD), the **`#node-<slug>`** anchors, signed-in **progress**, and the
  **`AdminTierToggle`**.
- **Test on `localhost:3001`**, never `127.0.0.1` (client islands don't hydrate cross-origin → the
  honeycomb/rail would look static and you'd chase a phantom).
- Don't break `src/app/courses/[slug]/page.tsx` (per-course preview/waitlist) — check if it shares
  `SkillNodeCard` before deleting anything.
- Reuse the `.gh-*` / `gs-pulse` CSS rather than forking it (keeps the two surfaces in sync — see the
  C1 design-system note in `docs/tech-debt-register.md`).

## References
`src/components/guide/GuideHoneycomb.tsx` · `src/components/guide/GuideStepper.tsx` ·
`src/app/globals.css` (`.gh-*`, `gs-pulse`) · `src/app/courses/page.tsx` ·
`src/components/skill-tree/{SkillTreePath,SkillNodeCard,HexMedallion}.tsx` ·
`src/lib/{skill-tree,skill-paths,skill-tree-core,skill-tree-href}.ts`
