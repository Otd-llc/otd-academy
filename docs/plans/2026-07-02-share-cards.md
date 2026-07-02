# Share-card system: branded OG cards for every academy route

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Visual tasks REQUIRE the `otd-skills:otd-frontend-design` skill; copy tasks REQUIRE `otd-skills:otd-content-writing`.
> **Another window may be dev'ing in this repo (theme-toggle track touched `src/app/layout.tsx`). Coordinate every checkout/commit with Josh; never touch main; no merges without his word.**

**Goal:** Every public academy URL shares a branded, data-carrying 1200×630 card in Messenger/iMessage/Discord/Slack, enforced by a CI gate so bare routes become impossible.

**Architecture:** A shared `ImageResponse` card kit (`src/lib/og/`) with vendored brand fonts and inline tokens, consumed by co-located `opengraph-image.tsx` routes per surface. Node runtime + Prisma reads with never-throw fallbacks (the existing guide OG route is the architectural template — copy its resilience, replace its system-sans styling). A sandbox gallery locks the design before variants are built; an `og:check` test locks coverage after.

**Tech stack:** Next App Router co-located OG routes, `next/og` ImageResponse (Satori: flexbox-only CSS subset, NO `var()` tokens — hex is hardcoded in the kit, acceptable because cards are baked dark artifacts), vendored OFL fonts, vitest.

**Locked decisions (Josh, 2026-07-02):**
- Full system, not just a default image ("absolute best option").
- Card family designed via a sandbox round; Josh picks in browser before variants are built.
- Cards are **dark-only baked artifacts** — the pack sandbox convention's dark/light toggle explicitly does NOT apply here (state this on the sandbox page).

**Key existing code (read before starting):**
- `src/app/projects/[slug]/[revLabel]/guide/[stage]/opengraph-image.tsx` — the architectural template: `runtime = "nodejs"`, tight Prisma selects, EVERY failure path returns a valid branded PNG (an OG route must never 500 the crawler). Its styling (system sans, no hex motif) is what this plan replaces.
- `src/app/layout.tsx` metadata — `metadataBase` set with prod fallback ✓; root title "One Thousand Drones Academy"; root description **"Hardware design lifecycle tracker"** (pre-rename copy, to be rewritten). NOTE: this file was recently touched by the theme-toggle track — rebase carefully.
- `src/app/learn/[slug]/certificate/[token]/page.tsx` — the one route already setting a proper 1200×630 `og:image`; leave working, optionally restyle last.
- Fonts: loaded via Google CSS imports in `globals.css` — NO local font files exist. ImageResponse needs font buffers, hence Task 1 vendors them.
- Diagram rasters for library cards: `public/guide-diagrams/*.webp` + the export manifest (see `otd-skills:diagram-export`).

---

### Task 0: Branch

```powershell
git checkout main; git pull; git checkout -b feat/share-cards
```
Confirm with Josh that the theme-toggle window is idle first. Commit locally per task; push only when he says.

---

### Task 1: Card kit foundation (`src/lib/og/`)

**Files:**
- Create: `src/lib/og/fonts/BebasNeue-Regular.ttf`, `src/lib/og/fonts/SairaCondensed-ExtraBold.ttf`, `src/lib/og/fonts/SpaceMono-Bold.ttf` (+ `SpaceMono-Regular.ttf`)
- Create: `src/lib/og/fonts.ts`, `src/lib/og/tokens.ts`, `src/lib/og/card.tsx`
- Create: `src/lib/__tests__/og-card.test.ts`

**Step 1: vendor the fonts.** All three are OFL-licensed (committable). Download the static TTFs from Google Fonts (github.com/google/fonts) — Bebas Neue Regular, Saira Condensed 800, Space Mono 400+700. Keep files < ~150 KB each (TTF, not variable fonts — Satori wants static instances).

**Step 2: `fonts.ts`** — cached buffer loader:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "src/lib/og/fonts");
let cache: { name: string; data: Buffer; weight: 400 | 700 | 800 }[] | null = null;

export async function ogFonts() {
  if (cache) return cache;
  cache = [
    { name: "Bebas Neue", data: await readFile(path.join(dir, "BebasNeue-Regular.ttf")), weight: 400 as const },
    { name: "Saira Condensed", data: await readFile(path.join(dir, "SairaCondensed-ExtraBold.ttf")), weight: 800 as const },
    { name: "Space Mono", data: await readFile(path.join(dir, "SpaceMono-Regular.ttf")), weight: 400 as const },
    { name: "Space Mono Bold", data: await readFile(path.join(dir, "SpaceMono-Bold.ttf")), weight: 700 as const },
  ];
  return cache;
}
```

**Step 3: `tokens.ts`** — the OG-side copy of the palette (hardcoded by design; source `globals.css @theme`): `DEEP_SPACE #08090d`, `BG_2 #0f1018`, `NAVY_DARK #1f2438`, `PANEL_BORDER #3a3f50`, `COMMAND_GOLD #c8963e`, `GOLD_LIGHT #e8b865`, `SIGNAL_BLUE #4a8fff`, `TITLE #f1ece0`, `TEXT #e8e8e8`, `MUTED #aaaaaa`, plus `SIZE = { width: 1200, height: 630 }`.

**Step 4: `card.tsx`** — the shared primitives (final look = Task 2's winner; build the contract now, restyle after the pick):
- `CardShell({ children })` — deep-space field, padding, the hairline frame, wordmark row (`ONE THOUSAND DRONES` ivory + `ACADEMY` gold, Bebas), footer gold rule.
- `Eyebrow({ children })` — Space Mono, uppercase, wide-tracked, gold.
- `CardTitle({ children })` — Bebas, ivory, ~84-96px, line-height 1.02.
- `SairaReadout({ value, unit, label })` — the numeral moment: Saira 800, gold, `tabular-nums`.
- `HexBadge({ n })` — SVG outline hex with a Saira number (the honeycomb signature; SVG works in Satori with inline `fill`/`stroke` attributes — literal hex is correct here).
- `renderCard(node)` — wraps `new ImageResponse(node, { ...SIZE, fonts: await ogFonts() })`.

**Step 5: smoke test** (`og-card.test.ts`): render a minimal card through `renderCard`, assert `res.status === 200`, `content-type: image/png`, body length > 10 kB. Pure node, no DB.

**Step 6:** `pnpm exec vitest run src/lib/__tests__/og-card.test.ts` → PASS. tsc clean. Commit.

---

### Task 2: Sandbox gallery (GATE — Josh picks before any variant ships)

**Files:**
- Create: `src/app/sandbox/share-cards/page.tsx` (gallery)
- Create: `src/app/sandbox/share-cards/img/[variant]/route.ts` (renders each option via the kit)

**Steps:**
1. Read `otd-skills:otd-frontend-design` (sandbox convention). Dev-guard both routes: `if (process.env.NODE_ENV === "production") notFound()` — this sandbox later GRADUATES to the permanent gallery (Task 9), it is not deleted.
2. 5–6 base-card design options rendered as real PNGs (`<img src="/sandbox/share-cards/img/A">` etc.), shown at 600×315 with a click-through to full 1200×630. Option ID captioned ABOVE each. Axes to cover: hairline-frame vs open-field; hex-badge placement (corner registration mark vs left rail); wordmark treatment; with/without the radial `BG_2` wash; a Saira-readout-hero variant vs Bebas-title-hero variant; eyebrow style (`▸` vs `//`).
3. Each option rendered twice: once with a SHORT title ("ESP32-S3 USB-C Breakout Board") and once with a LONG one (wrap behavior is where OG cards die).
4. Banner on the page: "Cards are baked dark artifacts — the sandbox theme-toggle convention does not apply here."
5. Josh picks the family winner (+ any mix-and-match notes). **Do not proceed to Task 3 without the pick.**
6. Commit.

---

### Task 3: Default site card + root metadata copy (the biggest single win — ship first)

**Files:**
- Create: `src/app/opengraph-image.tsx` (root default; every route without its own inherits it)
- Modify: `src/app/layout.tsx` metadata block (coordinate — theme-toggle track touched this file)

**Steps:**
1. Root card to the winning template: wordmark hero + tagline + hex motif. No DB. `export const alt = "One Thousand Drones Academy"`, `size`, `contentType`.
2. Root metadata rewrite (use `otd-skills:otd-content-writing`; preserve nothing of "Hardware design lifecycle tracker"): real academy description (learn electronics by designing/building real boards: KiCad, soldering, bring-up), plus `openGraph: { siteName, type: "website", locale }` and `twitter: { card: "summary_large_image" }` defaults so every page inherits them.
3. Verify: dev server, `curl localhost:3000/opengraph-image` → PNG; view-source any bare route (e.g. `/glossary`) → `og:image` present and absolute.
4. tsc + smoke test green. Commit. **This task alone fixes every bare route; it can PR early if Josh wants the win shipped ahead of the variants.**

---

### Task 4: Course card

**Files:** Create: `src/app/courses/[slug]/opengraph-image.tsx`

Copy the guide OG route's resilience pattern verbatim (nodejs runtime, tight select, try/catch → branded fallback). Data: `publicTitle ?? name`, `tagline`, `level`+`track` (hex badge shows the level number), `accessTier` chip. Verify with a real slug + a garbage slug (must still 200 a branded PNG). Commit.

---

### Task 5: Restyle the two existing guide OG routes onto the kit

**Files:**
- Modify: `src/app/projects/[slug]/[revLabel]/guide/opengraph-image.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/guide/[stage]/opengraph-image.tsx`

Keep the data resolution + fallback logic EXACTLY as-is; swap the JSX onto the kit (brand fonts, winning frame). The stage card adds the comb position: `STAGE <Saira>{n}</Saira>/<Saira>8</Saira> · {label}` (order from `GUIDE_STAGES`). Verify both, incl. failure paths (bad slug). Commit.

---

### Task 6: Library card (the diagram-bearing one)

**Files:** Create: `src/app/library/[slug]/opengraph-image.tsx`

The differentiator: the mini-lesson's hero diagram ON the card. Resolve the page's first registered diagram (registry + manifest, see `otd-skills:diagram-export`), read the DARK `.webp` raster from `public/guide-diagrams/`, embed as a data URI in an `<img>` (Satori supports data-URI images; webp support is fine via resvg — if a specific webp fails, fall back to the no-diagram layout, never throw). Layout: title left ~55%, diagram right on a hairline-framed panel. Fallback when no diagram: standard title card. Verify on `motor-imagery-bci` + a diagramless page. Commit.

---

### Task 7: Tool + part cards

**Files:**
- Create: `src/app/tools/[slug]/opengraph-image.tsx` — the Saira instrument readout as the hero (per-tool exemplar value, hardcoded in a small map: LiPo runtime → "42 min", WS2812 supply → "2.42 A"), tool name as the Bebas line.
- Create: `src/app/parts/[id]/opengraph-image.tsx` — MPN (Space Mono, large), manufacturer, description line, category chip; if the part has a committed render asset, embed it right-side like the library diagram; else text-only. Never-throw fallback.

Verify both + garbage params. Commit.

---

### Task 8: `og:check` — the coverage gate

**Files:** Create: `src/lib/__tests__/og-coverage.test.ts`

A filesystem test (no server): enumerate the PUBLIC route families as a literal list —
`src/app` root, `courses/[slug]`, `projects/[slug]/[revLabel]/guide`, `…/guide/[stage]`,
`library/[slug]`, `tools/[slug]`, `parts/[id]`, `learn/[slug]/certificate/[token]` —
and assert each either has a co-located `opengraph-image.tsx` **exporting `alt`, `size`, `contentType`**, or (cert case) a `generateMetadata` whose source contains `openGraph` + `images`. Adding a new public route family without a card = red test. Runs in the normal vitest suite + CI. Commit.

---

### Task 9: Gallery graduation + cache/verify hygiene

**Steps:**
1. Repoint the sandbox gallery's variant routes at the REAL shipped cards (render the actual `opengraph-image` components with sample params) so `/sandbox/share-cards` becomes the permanent dev-only visual-regression surface. Keep the prod `notFound()` guard.
2. Confirm Next's co-located OG URLs carry a content hash query (`?<id>`) — they do by default; document in the PR that a card edit auto-busts scraper caches on next deploy, and that Facebook may still need a Sharing Debugger re-scrape for URLs shared BEFORE the deploy.
3. Full gates: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.
4. Manual pass: metatags.io (or FB Sharing Debugger) against prod-preview URLs for one route per family — Josh eyeballs the actual Messenger rendering.
5. PR with before/after screenshots per family. **No merge without Josh.**

---

## Execution ordering constraints

- Task 2 gates 3–7 (design pick). Task 3 can PR early on its own if Josh wants the quick win live.
- Task 5 must not regress the existing routes' fallback behavior — the never-throw property is the contract.
- `src/app/layout.tsx` is shared with the theme-toggle track — rebase/coordinate before editing (Task 3).
- Commits at task boundaries only; push + PR only on Josh's word.
