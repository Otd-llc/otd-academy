# `otd-promo` — session handoff

**Read `2026-08-09-otd-promo-repo-design.md` first. It is the spec.**
`2026-08-09-otd-promo-validation-log.md` records how it was proven and what was
knowingly left as residual risk. This file is the operational half: what to do,
in what order, and what will bite.

**Stopping on a tier boundary is a success, not an abort.** The owner chose to
take all of T0–T7, and it is a lot. Every tier ends at a working state with its
own acceptance. Land the tier you finish; do not leave a half-tier.

---

## 0. Before you touch anything

**These are time-sensitive. The reference for T1's acceptance test expires if
the other repo moves.**

| Fact                                             | Value                                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `bioscale-viz` reference commit (tree was clean) | `c0957ded742b23402616b59c082f720e7bb5ff96`                  |
| Playwright                                       | `1.60.0` — **pin exactly in the new repo**                  |
| Chromium (Playwright-bundled)                    | `148.0.7778.96`                                             |
| Node                                             | `v24.5.0`                                                   |
| ffmpeg                                           | `8.0.1`                                                     |
| Reference mp4s to match                          | `C:/zzz/_hex-promo/hex-{vertical,wide,band}-orbit-text.mp4` |

If `bioscale-viz` has moved past `c0957de`, **check that commit out into a
worktree** rather than testing against a moved tree. A byte-identical test with a
drifting reference proves nothing.

**Prerequisite that is not yet merged:** academy PR #459 carries the burn-in and
the current state of `tools/hex-promo-cuts.mjs`. Port from the merged main, or
from that branch if it is still open — but know which, and record it.

---

## 1. Order of work

| Tier   | Do                                                                                                                                                                 | Done when                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **T0** | Create `Otd-llc/otd-promo` **private**. Scaffold per design §2. Vendor `assets/` (85 samples + provenance, 2 woff2 + OFL text, brand svg). `boundary:check` in CI. | `pnpm boundary:check` passes on an empty `core/`                           |
| **T1** | Split `hex-promo-cuts.mjs` per §3.1 into `core/` + `subjects/hex/`. Move the audio tools and the master.                                                           | **Byte-identical** re-render of vertical, wide, band (§10.1)               |
| **T2** | `core/manifest.mjs`, separate R2 bucket, first `releases/*.json`                                                                                                   | A release manifest validates and its keys resolve in the bucket            |
| **T3** | `subjects/_stage` (Vite + three.js) and `subjects/board` — board **and part** turntables                                                                           | A turntable cut passes seam + framing, with **zero changes under `core/`** |
| **T4** | `subjects/gerber` — the eight-sheet stack explode                                                                                                                  | Same, and it is the shot worth showing                                     |
| **T5** | The academy harness. **The largest risk in the plan.**                                                                                                             | Every gate in §10.2 fires correctly on a deliberately broken input         |
| **T6** | Scenes A1, A2, A3                                                                                                                                                  | Each an exact loop; A3's join measured or the fallback taken               |
| **T7** | 25-bar tour bed, 50 s concat                                                                                                                                       | Tour plays; every lap measures the same loudness                           |

**T3 and T4 come before T5 deliberately.** This is the one place the plan
overrides the owner's stated scene order, and it is visible here so it is a
decision rather than a quiet substitution. The UI scenes are the most expensive
and the least differentiated; the board and gerber scenes are cheap, reuse the
harness almost verbatim, and prove the `core/` boundary before the hardest
subject depends on it. Nothing is dropped — only reordered.

---

## 2. What will bite

Ordered by how much time it will cost if missed.

### 2.1 Timers and the wall clock (T5)

The virtual clock replaces `performance.now`. It does **not** touch
`setTimeout`, `setInterval`, or `Date.now`. The hex scene never needed them; a
React app is full of them.

Build the timer queue in `core/clock.mjs` **before** writing a single scene, and
pin `Date.now` to `captureEpoch` at the same time. Retrofitting this after a
scene "mostly works" means re-timing every cue in it.

`captureEpoch` is defined relative to the persona's seeded timeline, not to
today — otherwise the footage's own relative timestamps age.

### 2.2 Smooth scroll (T5, T6)

`src/components/logbook/RankLadderModal.tsx` uses
`scrollTo({ behavior: "smooth" })` plus a rAF snap, on a container with
`scrollSnapType: "y proximity"`.

Smooth scroll runs on the browser's scrolling machinery, on its own timeline. It
is not rAF, not a CSS animation, and **not in `getAnimations()`**. A captured
scroll must be **authored** — set `scrollTop` yourself each frame — and the
capture stylesheet must force `scroll-behavior: auto` and disable
`scroll-snap-type` globally so nothing reintroduces it.

Upside: an authored scroll can be eased on the 120 BPM grid, so a scroll lands on
a beat.

### 2.3 The local database is production (T5, T6)

`db:pull-prod` restores production into local. The database the academy capture
points a camera at **contains real accounts and real email addresses**.

Two controls, and build the second one first because it does not depend on
anyone remembering the first: the capture-scoped seed, and the **disclosure gate**
that scans captured DOM text for `@` and for names outside a one-name allowlist
and fails the render on a hit.

Also keep **L2.01** out of frame. It exists only on local and is deliberately
held back pending a safety review; a library scene that scrolls the index would
publish it.

### 2.4 Blocking third parties makes embeds visible (T6)

Blocking third-party origins is right, and it makes a YouTube embed **fail
visibly** — an error box, in frame. Lesson pages carry `youtube` content blocks
and `/hex` has a `<video>` hero. Replace embeds with their poster still before
the clock starts, and assert per scene.

### 2.5 The boundary check will false-positive if you write it carelessly (T0)

Match **words**, not substrings. `cap` is inside `capture`. A check that fires on
every file gets switched off, which is worse than not having it.

### 2.6 Chromium is part of the recipe (T1)

Playwright bundles its own. A different Playwright version renders different
anti-aliasing, and §10.1's acceptance test fails for a reason that has nothing to
do with the port. Pin `1.60.0`.

### 2.7 Traps inherited from the existing work

These are already paid for. Do not re-derive them.

- **Any DOM overlay you inject is hidden by `boot()`**, whose chrome rule kills
  every non-canvas child of `<body>` by design. Exempt your id _and assert the
  layer is actually on screen_ — it fails silently and looks exactly like an
  opacity bug.
- **Scrub animations, never play them** — `pause()` then set `currentTime`.
- **Fade cues out inside their window**, not after it, or the last frame carries
  type and the seam steps.
- **Size overlay type off the short axis**, not the width; by width is wrong on
  16:9 by 1.78×.
- **Force GLB materials opaque** — KiCad's mask export declares `alphaMode:
BLEND` at α 0.30 and the board renders see-through.
- **GLB units are metres.** Framing maths that assumes millimetres puts the
  camera inside the board.
- **Bounds from the world-space AABB half-diagonal**, not the local one.
- **`--use-angle=gl --enable-gpu --ignore-gpu-blocklist`** — SwiftShader software
  rasterisation measured 25× slower.
- **Measure over the whole revolution, not one azimuth.** Framing that clears at
  one camera angle clipped at others, and it shipped that way once.

### 2.8 Z is an exaggeration, and say so in the code (T4)

Real: 35 µm copper on a 1.6 mm core — conductors are ~2% of the stack, so a
true-scale explode is a slab with dust on it. Declare the visual thickness and
spacing as named constants with the real value in a comment beside them, so
nobody later "corrects" it and wonders why the shot died.

---

## 3. Acceptance, per tier

Do not advance on "it looks right".

| Tier | Gate                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| T0   | boundary check passes; assets present; fonts fail loudly when removed                  |
| T1   | byte-identical (or zero per-frame difference, and say which)                           |
| T2   | manifest validates; every `r2Key` resolves; keys carry a content hash                  |
| T3   | seam < quietest ordinary step; framing clear over the full turn; **`core/` untouched** |
| T4   | same, plus eight sheets present and accounted for in the explode                       |
| T5   | every §10.2 gate demonstrated firing on a deliberately broken input                    |
| T6   | each scene loops; disclosure gate green; A3 join measured or fallback taken            |
| T7   | tour is exact laps; every lap the same measured loudness                               |

**T5's gate is the unusual one and it is the important one.** A gate that has
never failed has never been shown to work. Break each input on purpose —
un-virtualise a timer, leave a smooth scroll in, plant a fake email in the DOM —
and confirm the render fails.

---

## 4. Standing rules that apply to this work

- **No subagent research, no Workflow, no deep research.** Direct `WebSearch` /
  `WebFetch` are fine. This plan was validated first-party for that reason.
- **Branch off `main`; never merge without the maintainer's explicit go-ahead.**
- **Check `gh pr view <n> --json state` before assuming a push adds to an open
  PR** — a squash merge strands every later commit on the branch, silently.
- **Wait on CI pinned to the PR's current head SHA.** `gh run list --limit 1`
  will hand back the previous commit's completed run and read green.
- **Every link handed to the owner goes in its own fenced code block.** One link,
  one fence, including PR numbers and repo references.
- **Web-verify third-party facts before asserting them.** Two claims in the first
  draft of this design were assertions from memory; one (R2 prefix scoping) was
  probably wrong and changed the design.

---

## 5. State at handoff

- Nothing has been created. `Otd-llc/otd-promo` does not exist yet.
- `C:/zzz/_hex-promo` is 236 MB of working directory on one machine with no
  backup. **The ~20 MB under `samples/`, `fonts/` and `brand/` is the only part
  that cannot be regenerated** — vendor it into the new repo at T0, and treat
  that as the first real deliverable.
- Academy PR #459 is open and green, carrying the type burn-in. It is the
  source of the port.
- The `_hex-promo` scratch directories (`_sandbox-*`, `_kinetic`, `_probe`,
  `_seam`, …) are throwaway. Do not migrate them.
