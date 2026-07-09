# Parallel authoring handoff — 4 library clusters, 4 windows

**Goal:** author all four next `/library` clusters at once, one per window, without the windows
stomping each other. Each window authors ONE cluster to a PR; the maintainer reviews + merges +
seeds PROD per cluster on an explicit go.

**The four clusters + their briefs (each window opens ONE):**
| Window | Cluster | key | Blueprint doc |
|---|---|---|---|
| A | PCB Design & Fabrication | `pcb-design` | `2026-07-09-pcb-design-library-cluster.md` |
| B | Communication & Interfaces | `comms-interfaces` | `2026-07-09-comms-library-cluster.md` |
| C | Power & Batteries | `power-batteries` | `2026-07-09-power-library-cluster.md` |
| D | Microcontrollers & ESP32 | `microcontrollers` | `2026-07-09-microcontrollers-library-cluster.md` |

Kick each window with: *"Author the `<cluster>` library cluster per
`docs/plans/2026-07-09-<cluster>-library-cluster.md` and the parallel handoff
`docs/plans/2026-07-09-library-clusters-parallel-handoff.md`. Isolated worktree, author the
seed, `--check` clean, tsc, open a PR. Do NOT seed PROD or merge without Josh's explicit go."*

---

## Isolation — one worktree per window (MANDATORY)
The shared main tree is already driven by another window at times (a `git checkout` there stomps
everyone). So each window works in **its own git worktree off `origin/main`**, never the shared
tree:

```
git fetch origin
git worktree add C:/zzz/pf-<cluster> -b feat/library-<cluster>-cluster origin/main
cd C:/zzz/pf-<cluster>
pnpm install                 # own node_modules (postinstall runs prisma generate)
cp <main>/.env.local .env.local          # PROD DATABASE_URL — needed only for the --check import + the eventual seed
cp <main>/.env.test.local .env.test.local # if running vitest
Start-Process pnpm.cmd dev --port <30xx> -WindowStyle Hidden   # own dev port: A=3011 B=3012 C=3013 D=3014
```
Clean up when merged: `git worktree remove C:/zzz/pf-<cluster>`.

**`.env.local` is PROD.** The seed script's `--check` mode does NOT hit the DB; only a bare
`npx tsx scripts/seed-<cluster>-cluster.ts` (no `--check`) writes PROD — that is the gated step.

## What each window OWNS (edit freely, no collision)
- **`scripts/seed-<cluster>-cluster.ts`** — NEW file, yours alone. Copy
  `scripts/seed-fundamentals-cluster.ts` as the template and change the `LESSONS`.
- **Your cluster's diagrams** later (`<cluster>-*` names) — separate files.

## SHARED files — append only, expect a trivial merge (coordinate)
Two files every cluster must touch. They are the ONLY collision points. Rule: **append your one
entry at the end**, keep the diff to that entry, and let the maintainer merge the PRs in
sequence (git auto-merges distinct trailing entries; a conflict is a one-line resolve).
1. **`src/lib/library/clusters.ts`** — add one `LIBRARY_CLUSTERS` entry
   `{ key, label, blurb }` (order in the array = order on the `/library` landing; append after
   `eeg-bci`, maintainer can reorder).
2. **`src/lib/pdf/field-guide-chrome.ts`** — add your cluster's `FIELD_GUIDE_CHROME[key]`
   (cover label, running-header section, intro/outro copy, part dividers). Model it on
   `FUNDAMENTALS_CHROME`. Part dividers land at `clusterOrdinal` 0 / 3 / 6 / 9 (adjust to your
   lesson count).

**Do NOT edit** other clusters' files, the shared render code (`library-pdf.tsx`,
`GuideBlocks`, the block-allowlist), or the diagram registry during authoring.

## The pattern (follow Fundamentals exactly)
- **Block types** (library allowlist): `prose`, `heading`, `callout`, `steps`, `image` (diagram
  slot), `quiz`, `sourceRef`, `deepDive`, `math`, `calculator`, `table`, `termRef`, `vendorCta`,
  `youtube`. Depth rides in **collapsed `deepDive`** asides so the beginner main line stays clean.
- **Voice:** answer-first, no em-dashes (`·` separator), no antithesis flourish, `code` chips for
  part values/units (`5.1 kΩ`, `100 nF`).
- **Math:** real formulas as a `math` block (KaTeX `tex` + ASCII `plain`).
- **Diagram slot:** one `image` block per lesson → `/guide-diagrams/<cluster>-<name>.svg`
  (renders caption-only until the diagram component is built later — same key, no re-seed).
- **Quiz:** 3 options, real same-register distractors, spread the answer key, no math in the stem.
- **Cross-links:** `sourceRef` to the Fundamentals prerequisite + a `SUPPORTING`/`DOWN_FUNNEL`
  course link where it fits (a separate bridge-seed step, like `seed-fundamentals-bridges.ts`).
- **DISCLOSURE (locked):** generic textbook education ONLY. No coined moat, no recipe, no
  paid-build values, no research-program framing. See memory `academy-library-disclosure-policy`.

## Validate before any PR
```
npx tsx scripts/seed-<cluster>-cluster.ts --check   # blocks + KaTeX + em-dash + PDF-glyph + answer spread, NO DB
node_modules\.bin\tsc.cmd --noEmit                  # (from your worktree)
```
The `--check` already scans PDF-glyph coverage (the `pdf-glyph-coverage` guard) + em-dashes.

## Gates (unchanged, STANDING)
1. **No auto-merge.** Author → `--check` + tsc clean → PR. Josh reviews + merges each.
2. **No PROD seed without Josh's explicit go.** The seed writes PROD (`.env.local` = PROD).
   Seed only AFTER the cluster's registry + chrome are merged (so the landing + PDF resolve).
   Order per cluster: merge the seed-script + registry/chrome PR → `npx tsx
   scripts/seed-<cluster>-cluster.ts` (PROD) → verify the landing groups + the field-guide PDF.
3. **Diagrams are a SEPARATE later phase** (sandbox-per-diagram, ~11 each) — do NOT block
   authoring on them; the `image` slots render caption-only until then.

## Sequencing / merge order
Registry order on the landing: Fundamentals · EEG & BCI · then the new four. Suggested order
(maintainer decides): PCB · Comms · Power · MCU. Merge the four PRs in that order to keep the
`clusters.ts` array + landing tidy; seeds can run in any order (distinct cluster keys/slugs, no
DB collision).

## Slug collision check (do this first in each window)
Grep existing slugs before naming lessons — some Fundamentals/EEG slugs are generic and could
clash (`grounds-and-power-rails`, `reading-a-datasheet`, etc.). Every slug is globally unique on
`MiniLesson.slug`. Prefix or rephrase to avoid a collision (e.g. `pcb-ground-planes` not
`grounds`).
