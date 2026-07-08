# Fundamentals content phase — scope, diagram list, seed mechanics, budget

**Date:** 2026-07-07
**Depends on:** the plumbing/surfaces already built on `feat/fundamentals-library-cluster`
(commits `1222ec3`, `dfd387a`, `911c808`) + the parent plan
`2026-07-07-fundamentals-library-clusters.md`.
**Hard gate:** the migration `20260708170000_minilesson_cluster` MUST be deployed to
PROD **before** any lesson seeds — the seed sets `cluster="fundamentals"` +
`clusterOrdinal`, columns that do not exist in PROD until `pnpm db:migrate` runs.

This is a scoping doc, NOT the prose. It fixes WHAT each lesson asserts, what it
must cite, its first-hand hook, its diagram(s), and how it reaches PROD, so the
authoring runs can be budgeted and checkpointed instead of one uncapped marathon.

## 0. The per-lesson quality bar (from otd-content-writing)

Every lesson clears the same gate. A lesson is not "done" until:

- **Voice absolutes:** zero em-dashes in EVERY string (prose, quiz, captions, seed);
  no AI lead-ins / puffery; **no antithesis "not X, it's Y" flourish** (the tic that
  most leaked into our Library — search each draft for a `not`/`isn't`/`'s not`
  paired with `it's`/`that's`/`but`); no participial padding; sentence-case headers;
  varied rhythm.
- **Answer-first** open (direct claim, then mechanism, then why it matters).
- **[STRONG] cite per claim, not per page:** every specific empirical/comparative
  claim gets its own inline author-year + a linked References entry, **web-verified
  at authoring time** (never from memory). Unsourceable → soften or cut.
- **[STRONG] ≥1 first-hand element** (an OTD board measurement / capture / gotcha).
  Where the topic is pure definition (lesson 1 units; parts of 11 reading-a-schematic)
  a capture/photo of real part markings or a real schematic snippet counts; note why
  if a measurement genuinely does not fit rather than faking one.
- **[STRONG] credentialed byline** — set a real reviewer byline (Trust E-E-A-T), not
  a placeholder string.
- **Intra-cluster arc:** each lesson cross-links its prerequisite fundamentals
  lesson(s) (a `sourceRef` internal link or a resolvable `termRef`), the way the EEG
  cluster was link-graph validated, so the arc is crawlable front to back and no
  lesson references a later one as a prerequisite.
- **Hero diagram first:** the per-lesson OG social card reads the FIRST image
  block's committed DARK `<name>.png` (parent §9), so place the lesson's primary
  diagram as an early block and confirm its `.png` sibling is committed, or the card
  degrades to text-only.
- **Audience bar on 9 / 11 / 12:** reactance, schematic-reading, and datasheet-reading
  may go a little deeper in PROSE, but keep the QUIZ stems plain recall (no math,
  no worst-case edge-cases) so the assessment stays at the L1 beginner bar.
- **Assessment (quiz):** 3-option check, distractors are real same-register
  misconceptions (no jokes), **answer key spread** across positions (count before
  seed), **L1 true-beginner bar** (plain core ideas, no math/edge-cases in stems),
  scenario stems where a diagnostic was taught.
- **Disclosure:** academy = generic textbook only. These are all generic EE, so no
  moat risk, but keep it generic (no OTD-AFE-001A values, no coined vocabulary).

Run the skill's self-check as a TodoWrite list against each finished lesson.

## 1. The 12 lessons

`cluster="fundamentals"`, `clusterOrdinal` = row number − 1. Each: answer-first
prose, cited `sourceRef`s, ≥1 first-hand hook, the diagram(s) below (registry-key
`src`), a `quiz`, `termRef`s, and the `calculator` embed where marked.

| # | slug | thesis (answer-first) | cite targets (web-verify) | first-hand hook | calc |
|---|------|----------------------|---------------------------|-----------------|------|
| 1 | `units-and-prefixes` | The SI units of electronics (V, A, Ω, F, W) and the metric prefix ladder (p n µ m · k M) you read off every part. | BIPM SI brochure / NIST SP 811 (unit defs + prefixes) | Reading a real OTD BOM value: 5.1 kΩ, 4.7 µF, 100 nF | — |
| 2 | `voltage-current-resistance` | Voltage is the push, current is the flow, resistance is the opposition. What each physically is and how they relate. | textbook (Ohm relation intro); NIST for unit defs | Probing the 3.3 V rail on the L1.01 board | — |
| 3 | `ohms-law` | V = I × R, its rearrangements, and P = V × I. | textbook (Ohm's law) | sizing a GPIO/I2C pull-up on L1.01 (DISTINCT from the /tools LED example; verify on board) | `ohms-law` |
| 4 | `power-and-heat` | Power is V × I (= I²R = V²/R) and it leaves as heat, which sets the part rating. | textbook; resistor datasheet derating curve | the AP2112K LDO's own heat on L1.01: (Vin − 3.3 V) × load current (DISTINCT from /tools bn-02) | `resistor-power` |
| 5 | `resistors` | What a resistor does, the E-series standard values, tolerance, and reading SMD codes. | IEC 60063 (E-series); a real resistor datasheet | OTD 0402/0603 BOM parts | — |
| 6 | `voltage-dividers` | Vout = Vin × R2 / (R1 + R2), why it sags under load, and scaling a voltage into an ADC. | textbook (divider); ESP32 ADC input range (datasheet) | a battery-sense divider scaling a LiPo into the 3.3 V ADC (l2-01) (DISTINCT from /tools L1.05) | `voltage-divider` |
| 7 | `capacitors` | A capacitor stores charge and steadies a rail; the decoupling cap beside every chip. | ceramic vs electrolytic (a real MLCC datasheet) | L1.01 100 nF decoupling caps at the power pins | — |
| 8 | `diodes-and-leds` | A diode passes current one way; an LED drops a forward voltage and needs a current-limiting resistor. | LED datasheet (Vf); diode textbook | reverse-polarity protection diode on the power input (DISTINCT from /tools LED) | `led-series-resistor` |
| 9 | `reactive-and-filtering` | Caps and inductors react to changing signals; an RC filter's cutoff fc = 1 / 2πRC. | textbook (reactance, RC); ADC anti-alias context | RC debounce/settle on a reset or button line (DISTINCT from /tools anti-alias) | `rc-filter-cutoff` |
| 10 | `grounds-and-power-rails` | Ground is the shared reference; power rails feed the board; why a plane beats a thin trace. | textbook (grounding); IPC (plane/return context) | L1.01 ground pour / rail (LAYOUT stage) | — |
| 11 | `reading-a-schematic` | Symbols, nets, and refdes: how to read a schematic from symbol to net. | KiCad symbol conventions; textbook | L1.01 schematic snippet | — |
| 12 | `reading-a-datasheet` | Absolute-max vs typical, the pinout, and the package: how to read a datasheet before you buy. | AP2112K LDO datasheet (the real L1.01 part) | AP2112K on the L1.01 BOM | — |

Course bridges (§7 SUPPORTING seeds): 7 → L1.01 SCHEMATIC; 8 → L1.01; 10 → L1.01
LAYOUT; 11 → L1.01 SCHEMATIC; 12 → L1.01 BOM_SOURCING. (Stage names verified against
`STAGE_VALUES`: REQUIREMENTS, SCHEMATIC, BOM_SOURCING, LAYOUT, … BRINGUP.)

## 1a. /tools ↔ /library differentiation (cannibalization guard) — MAJOR

Five lessons embed a calculator that ALSO has its own `/tools` page targeting
overlapping keywords: 3 `ohms-law` ↔ `/tools/ohms-law`, 4 `power-and-heat` ↔
`/tools/resistor-power`, 6 `voltage-dividers` ↔ `/tools/voltage-divider`, 8
`diodes-and-leds` ↔ `/tools/led-series-resistor`, 9 `reactive-and-filtering` ↔
`/tools/rc-filter-cutoff`. Both surfaces are free and self-canonical, so left
unmanaged they compete for the same query and read as near-duplicates.
Differentiate by INTENT (per otd-content-writing's cannibalization rule):

- **Library lesson = understanding.** Answer-first "what is / how / why" for the
  concept; the embedded calc is a try-it, not the point. Title/H1 read as the
  concept ("Voltage dividers"), never "calculator".
- **/tools page = doing.** The transactional "calculate / calculator" query; the
  island is the point. (These pages already exist.)
- **Cross-link both ways:** the lesson links its `/tools` twin ("compute it"), and
  the tools page links back to the concept lesson.
- **NO reused worked example.** Every `/tools` Body already ships a first-hand
  example (ohms-law → L1.01 LED; resistor-power → bn-02 load; voltage-divider →
  L1.05 ADC; led-series-resistor → L1.01 LED; rc-filter → ADC anti-alias). The
  library lesson MUST use a DIFFERENT measured example or framing, or the pages are
  near-duplicates. **Lesson 3 especially: the L1.01-LED resistor hook is already
  shipped verbatim in `OhmsLawBody` (911c808) — pick a different hook** (e.g. a
  measured rail current, or sizing a different resistor on the board).

## 2. Diagrams (§9) — one committed artifact set per figure

~12 diagrams (roughly one per lesson; 2-3 lessons may want a second). Each is a
`DIAGRAM_COMPONENTS` entry keyed `/guide-diagrams/<name>.svg`, authored via the
**diagram-export skill** (responsive component + brand tokens), with the image
block `src` set to that key. Per figure, commit ALL FOUR artifacts:

- `<name>.webp` (web + image sitemap)
- `<name>.png` (DARK — OG card + PDF fallback)
- `<name>-light.png` (needs the **separate `pnpm diagrams:export --light` pass**)
- the regenerated `src/components/guide/diagram-export-manifest.json` (sitemap gate)

Run **BOTH** `pnpm diagrams:export` AND `pnpm diagrams:export --light`; CI
`diagrams:check` fails on a stale manifest or missing raster.

Candidate figures: prefix ladder (1), V/I/R relationship (2), Ohm's-law wheel (3),
power-in-a-resistor / heat (4), resistor anatomy + E-series (5), divider schematic
+ output curve (6), decoupling-cap placement (7), diode/LED symbol + IV curve (8),
RC filter + response (9), rails + ground reference (10), annotated schematic (11),
datasheet anatomy (12). Finalize the exact list when authoring each lesson.

## 3. Seed mechanics (otd-guide-content owns the how)

Mini-lesson content lives in the **PROD DB**, not git — the seed is a gitignored
direct-Prisma script (per [[library-mini-lessons]] / [[foundry-headless-scripting]]).
Sequence:

1. **Deploy the migration first** (`pnpm db:migrate`) so `cluster`/`clusterOrdinal`
   exist. Without it the seed's `cluster:"fundamentals"` write fails.
2. Author each lesson's `contentBlocks` (validated against `guideContentBlocksSchema`,
   ≤200 blocks, filtered by the Library allowlist — `calculator` is now allowed).
3. **Grep the seed file for `—` before running** (seeds ARE a content surface).
4. Dry-run / upsert per the otd-guide-content mechanics; set `published`,
   `accessTier="PUBLIC"`, `cluster="fundamentals"`, `clusterOrdinal`, `byline`,
   `seoTitle`/`seoDescription`, `lastVerifiedAt`.
5. **Render-verify the PAGE, not the DB write** — the guide page renders `[]` on any
   contentBlocks parse failure ([[guide-content-render-verify]]). Check each
   `/library/<slug>` renders, its `/library/<slug>/pdf`, its OG card, and the
   image-sitemap entry.
6. Make the EEG-seed-style scripts reproducible for the new rows too (§3.1a spirit):
   the canonical fundamentals seed writes `cluster`/`clusterOrdinal` on every upsert.

## 4. Cross-link + glossary seeds (§7)

- **ProjectMiniLesson SUPPORTING rows** linking the bridge lessons (7,8,10,11,12) to
  L1.01 (published + PUBLIC → the guide-page reading list built in `911c808` renders
  them crawlably).
- **Seed the missing Fundamentals `GLOSSARY` entries** so `termRef` popovers resolve
  instead of degrading to plain text (ohm's law, voltage divider, resistor,
  capacitor, decoupling, diode, forward voltage, ground, rail, reactance, cutoff,
  datasheet, …). Definition-only (decision #4: no `librarySlug` plumbing).

## 5. Token budget + sub-batching (do NOT run uncapped)

The last uncapped subagent workflow burned ~577k tokens ([[fundamentals-library-plan]]).
This phase is bigger (12 cited, diagrammed, quizzed lessons). Rough estimate:
~15-30k output tokens per lesson (prose + diagram component + quiz + citations +
seed entry + verify), so ~200-360k for all 12, plus diagram-export + seed + verify
runs. **Budget it and checkpoint.**

Proposed sub-batches (author + diagram + seed-script + self-check, then checkpoint):
- **Batch A** — lessons 1-4 (units, V/I/R, ohms-law, power). The core; 3 and 4 reuse
  the calculator EMBEDS already built, but each needs a first-hand hook DISTINCT from
  its /tools twin (§1a).
- **Batch B** — lessons 5-8 (resistors, dividers, capacitors, diodes/LEDs). The
  passives; carries the L1.01 bridges for 7-8.
- **Batch C** — lessons 9-12 (reactive/filtering, grounds/rails, reading-a-schematic,
  reading-a-datasheet). The "reading a design" arc + remaining bridges.

Seed each batch only after the migration is deployed. Chrome polish (§4.2) + the
combined-book divider fix land naturally once all 12 exist.

## 6. Build order (this phase)

1. **[GATE] Deploy the migration** (`pnpm db:migrate`, PROD write, owner go + other
   window clear).
2. Batch A: author + diagrams + seed + verify → checkpoint.
3. Batch B → checkpoint.
4. Batch C → checkpoint.
5. §7 seeds (ProjectMiniLesson SUPPORTING + GLOSSARY).
6. §4.2 chrome polish (otd-content-writing pass on the fundamentals + combined
   intro/outro drafts, now that lesson language is fixed).
7. §10.5 full verify on a Vercel PREVIEW: landing grouping, both PDFs (correct
   cluster chrome, light diagram rasters), calc web + PDF fallback, OG cards, image
   sitemap, full tsc + full vitest. Then push + PR (owner merge).
