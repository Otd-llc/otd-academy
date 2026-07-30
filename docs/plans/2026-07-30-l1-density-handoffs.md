# Bringing L1.02 to L1.05 up to the L1.01 bar — handoff packets

**Goal:** every Level 1 lesson reaches L1.01's density (406 blocks, the full island
rhythm, real capture slots, a 9-question stage quiz, an 18-question exam) and ships
with a KiCad starter pack, so the premium tier has something worth selling.

**Why this doc exists:** the work is roughly 1,150 blocks of authoring across 32
stage cards plus 4 starter packs. That does not fit one session, and it should not
be one PR. Each packet below is independently authorable, independently reviewable
and independently mergeable.

---

## The architecture decision (read this first)

Lesson prose lives in the **database**, not in git. Until now, authoring produced a
DB write plus a gitignored throwaway script (`/scripts/_*`), which means:

- nothing was reviewable in a PR (you could not read the prose in a diff),
- nothing was mergeable,
- two parallel sessions would overwrite each other's cards with no trace,
- and re-applying a card to a fresh database meant re-writing the script.

**From now on a card is a tracked script.** One file per card:

```
scripts/authoring/<slug>/<STAGE>.ts
```

`scripts/authoring/` is not matched by the `/scripts/_*` ignore rule, so these are
tracked automatically. Each file imports `scripts/authoring/lib.ts`, declares its
blocks, and calls `publishCard`. Running it is idempotent: it replaces that one
card's `contentBlocks` with the authored array.

```powershell
pnpm exec tsx scripts/authoring/l1-02-espnow-link/LAYOUT.ts             # dry run
pnpm exec tsx scripts/authoring/l1-02-espnow-link/LAYOUT.ts --write     # LOCAL
pnpm db:prod scripts/authoring/l1-02-espnow-link/LAYOUT.ts --yes -- --write   # PROD
```

**What this buys:** the PR diff IS the prose, so review happens where review should
happen. Two packets never touch the same file. A merged packet can be replayed
against prod, a fresh clone, or a test branch. And the card's history is in git.

---

## The acceptance test (automated, in `lib.ts`)

A packet cannot write until it passes. No packet is "done" without a green run.

1. **Voice gate** — zero em-dashes in any string that reaches a renderer, walked
   recursively (step text, proofs, traceList help, captions, captureHints, quiz
   options). This is an absolute, not a preference.
2. **Schema gate** — `guideContentBlocksSchema.parse`. The guide page renders `[]`
   on any parse failure, so an unparsed write blanks the card while looking correct
   in the database.
3. **Quiz gate** — every question has a stable `id` and an `explain`; the answer key
   may not cluster (options render in stored order with no shuffle, so a clustered
   key is guessable). This gate exists because the L1.01 exam once shipped with
   every `correctIndex` at 0.
4. **Density score** — reported against the per-stage L1.01 bar in `BAR`. Reported,
   not enforced: density is an owner sign-off, and a second pass after the board is
   physically built is expected.

Two checks the harness cannot do, which stay human:

- **Does it render?** The guide page is ADMIN-gated for unpublished PREMIUM
  projects, so an anonymous check always sees the waitlist. Verify signed in.
- **Are the facts right?** See below.

---

## Fact discipline (the thing most likely to go wrong)

Authoring runs **ahead of the board**, exactly as L1.01 did. Facts come from, in
order of authority:

1. **`docs/boards/<slug>/design.md`** — topology, calc trail, IC selection, power
   and thermal numbers, the GPIO map. All five L1/L2 boards are **DRY /
   design-stage part-ready**, so these numbers are validated.
2. **`docs/boards/<slug>/bom.csv`** — refdes, manufacturer, exact MPN. Never
   paraphrase a part number.
3. **`docs/boards/<slug>/validation-log.md`** — pass 11 (layout-readiness) carries
   the captured layout constraints; the risk register names what is load-bearing.
4. **L1.01's own cards are GOSPEL for anything the boards share** (stackup, net
   classes, the PCBWay `.kicad_dru`, via preset, the USB pair, pour and stitch, the
   DRC flow). Owner directive, 2026-07-30. If L1.01 states a number, state the same
   number. Diverging silently is the failure mode.
5. **Web lookup** for anything else, verified before citing, never from memory.

`scripts/authoring/gospel-check.ts` diffs a card's shared-subsystem facts against
L1.01's equivalent card and flags anything present in one and absent in the other.
Run it on every packet. It has already caught one real hole: the L1.02 LAYOUT draft
told the learner to "confirm the via preset matches the fab floor" without giving
the numbers L1.01 states (0.6 mm annulus / 0.3 mm drill).

The owner corrects the remaining drift by walking each lesson step by step while
building the board. That pass is what turns an authored lesson into a vetted one,
and it produces the answer key and reference files.

---

## Packets

Gaps are current prod block counts against the 406 bar.

### Lesson content — 32 packets

| Packet | Card | Now | Bar | Notes |
| --- | --- | ---: | ---: | --- |
| `L102-REQ` | l1-02 REQUIREMENTS | 31 | 33 | essentially at bar; light pass |
| `L102-BOM` | l1-02 BOM_SOURCING | 20 | 36 | |
| `L102-SCH` | l1-02 SCHEMATIC | 80 | 120 | topology locked in design.md §2 |
| `L102-LAY` | l1-02 LAYOUT | **66** | 96 | **first packet shipped**; needs pass 2 |
| `L102-DRC` | l1-02 DRC_GERBER | 11 | 25 | |
| `L102-ORD` | l1-02 ORDERING | 11 | 24 | largely board-agnostic |
| `L102-ASM` | l1-02 ASSEMBLY | 12 | 40 | |
| `L102-BRU` | l1-02 BRINGUP | 19 | 32 | ESP-NOW pairing is the new material |
| `L103-*` | l1-03-ws2812-node, 8 cards | 93 | 406 | |
| `L104-*` | l1-04-single-servo, 8 cards | 66 | 406 | |
| `L105-*` | l1-05-internal-adc, 8 cards | 67 | 406 | |

### Starter packs — 4 packets

One per board. Depends on parts in the library and the BOM imported, both of which
exist (L1.02 17 lines, L1.03 25, L1.04 22, L1.05 19). The pipeline is the BOM to
KiCad starter export (#13) plus the corrections learned on L1.01: 3D paths under
`libs/3dmodels`, refdes font 1/1/0.15, the small-via preset, VBUS on the Power net
class, no keepout on the decoupling cap, mask bridges allowed on the USB connector.
See the `kicad-starter-quality-sweep` notes.

### Exams — 4 packets

18 questions each, answer key spread counted before seeding, stems at the L1
beginner bar. Pattern: `scripts/seed-l101-exam.ts`.

---

## Merge protocol

- **One packet, one branch, one PR.** Branch `author/<packet-id>`, e.g.
  `author/l102-sch`.
- Packets are **order-independent** and cannot conflict: each touches exactly one
  new file. Rebase onto main before merging; main moves fast.
- **Required checks:** `guard` and `Vercel`. `build` is not required but should be
  read anyway. Note the ruleset enforces up-to-date-with-main even though the
  classic protection API reports otherwise, so expect a rebase.
- **Merging ships nothing by itself.** The script lands on main; the content goes
  live when someone runs it against prod. That separation is deliberate: it keeps
  a bad card out of the live lesson until it has been read on a rendered page.

## Order of work

1. Finish **L1.02** (7 remaining cards). It is nearest the bar, it is the next
   lesson a learner meets after the free flagship, and it is the one that turns a
   built billing stack into a first sale.
2. **L1.02 starter pack + exam**, then publish and price it. Nothing is buyable
   until a course revision publishes.
3. **L1.03**, then **L1.04**, then **L1.05**, each content then starter then exam.

Prices are `unset` on every premium L1 lesson, so authoring alone does not make one
sellable. That is a one-script change once the content is signed off.
