# `otd-promo` — a promotional render pipeline in its own repo

**Status:** design, validated to dry (see
`2026-08-09-otd-promo-validation-log.md`). Implementation handoff is
`2026-08-09-otd-promo-handoff.md`.

**Owner decisions taken 2026-08-09, before this was written:**

| Decision            | Chosen                                                                                          | Rejected                                |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| Where results live  | **R2 + manifest in git**                                                                        | commit to git; Git LFS; regenerate-only |
| Visibility          | **Private**                                                                                     | public                                  |
| First session scope | **Everything**: core, hex port, board turntable, gerber explode, and the four academy UI scenes | core+hex only; core+hex+gerber          |

## 1. Why a separate repo (read first)

Two measurements decided this, not taste.

**The pipeline has no consumer where it lives.** `tools/hex-*.{mjs,py}` plus
`docs/social-asset-map.md` is **5,339 lines** in `project-foundry`, and `src/`
imports **none** of it. Nothing in the academy app depends on a single line.

**Its real dependency is a different repo.** `hex-promo-cuts.mjs` drives the
`bioscale-viz` dev server, imports that app's `/src/hex/scene.ts`, and knows its
DOM ids, explode groups and ghost predicates. Every trap in the file is about an
app that is not in this repository. It lives here by accident of who was doing
the work.

**And the outputs have nowhere to live.** `C:/zzz/_hex-promo` is **236 MB** on
one machine with no backup: kits 94 MB, sandbox cuts 42 MB, samples 20 MB, and
~15 scratch directories. Of that, the part that is _not_ reproducible is about
**20 MB** — 85 CC0 samples with provenance, two webfonts, the brand marks.
Everything else is output the pipeline exists to regenerate.

### 1.1 What this is NOT

- **Not a monorepo.** It does not absorb `bioscale-viz` or `project-foundry`. It
  drives them.
- **Not the home of page assets.** `public/hex/configurator*.mp4` and the four
  README WebPs stay committed in the repos that serve them (§7.3).
- **Not a general video tool.** It is a deterministic capture harness for OTD
  subject matter, with a brand type layer and a scored bed.

## 2. Repository

`Otd-llc/otd-promo`, **private**.

Private because it holds unreleased cuts and the platform playbook, and because
it removes the redistribution question on the sample library entirely. The cost
is that `provenance.json` is not publicly auditable; §9.2 says what to do if that
posture ever changes.

```
otd-promo/
  CLAUDE.md                    # agent rules; mirrors the load-bearing traps
  README.md
  package.json                 # playwright, three, vite. ffmpeg + python from PATH
  .gitignore                   # out/, __pycache__/, .freesound-key

  core/                        # subject-agnostic. If it knows what a hex tile is, it is in the wrong folder.
    boot.mjs                   # browser launch, GPU flags, viewport, chrome hiding
    clock.mjs                  # the virtual clock
    drive.mjs                  # the per-frame loop: step -> advance -> paint -> overlay -> shutter
    presets.mjs                # aspect table, dolly/lift, textSafe, textDl
    seam.mjs                   # loop verification
    encode.mjs                 # mp4, animated webp, poster
    master.mjs                 # laps by concat + bed mux (was hex-social-master.mjs)
    manifest.mjs               # R2 put + release manifest
    overlay/
      type.mjs                 # the kinetic cue engine (scrub, never play)
      cursor.mjs               # synthetic pointer for UI scenes
      fonts.mjs                # woff2 -> data URI, cached
      tokens.mjs               # brand colours, grid, hollow period

  audio/
    samples.py                 # CC0 fetch + licence RE-CHECK
    bed.py                     # arrangement
    master.py                  # reverb, glue, true peak, EBU R128
    kits.py                    # kit definitions (data, not renders)

  subjects/
    hex/                       # drives bioscale-viz
    gerber/                    # NEW  — layer stack explode
    board/                     # NEW  — GLB turntable
    academy/                   # NEW  — UI scenes, drives project-foundry
    _stage/                    # a minimal vite app for subjects that have no app of their own

  assets/                      # the ~20 MB that cannot be regenerated
    samples/  + provenance.json
    fonts/    Bebas Neue, Space Mono (woff2)
    brand/    otd-icon-gold.svg
    gerber/   l1-01.json       # vendored, pinned (§6.2)
    models/   l1-01.glb        # vendored, pinned (§6.3)

  releases/                    # committed manifests. The index of what was ever shipped.
  docs/
    social-asset-map.md        # moved from project-foundry
    manifest-schema.md
  out/                         # gitignored. Renders, sandboxes, scratch.
```

### 2.1 The `core/` boundary test

`core/` is generic or it is hex code in a new folder. The test is mechanical and
belongs in CI:

> **No file under `core/` may contain the words `hex`, `tile`, `cluster`,
> `tray`, `lid`, `ghost`, or `explode`.**

A word-boundary regex, run by `pnpm boundary:check`. It is crude and it is
exactly right: the failure mode being guarded is a subject leaking upward, and
that leak always shows up as vocabulary.

**Word boundaries are not a detail.** The first draft of this rule matched the
bare substring `cap`, which occurs in `capture` — the single most common word in
the harness. It would have fired on every file on day one, and a check that
always fires gets switched off, which is worse than no check. That lesson is
already written down elsewhere in this project about a gate that fired on every
run; it applies here.

The second test is the one that actually proves it: **the gerber subject must
consume `core/` without adding anything to it.** If building the stack explode
requires a change under `core/`, that change is either genuinely general (fine,
justify it in the commit) or the boundary is wrong.

## 3. What moves, what stays

| From `project-foundry`                                | To                                   | Note                                |
| ----------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| `tools/hex-promo-cuts.mjs` (2222 l)                   | split into `core/` + `subjects/hex/` | the split is §3.1                   |
| `tools/hex-video.mjs` (644 l)                         | `subjects/hex/hero.mjs`              | makes shipped page assets; see §7.3 |
| `tools/hex-stills.mjs` (152 l)                        | `subjects/hex/stills.mjs`            |                                     |
| `tools/hex-social-master.mjs` (163 l)                 | `core/master.mjs`                    | already subject-agnostic            |
| `tools/hex-bed.py`, `hex-master.py`, `hex-samples.py` | `audio/`                             | already subject-agnostic            |
| `tools/hex-drums.py` (738 l)                          | `audio/_retired-drums.py`            | §3.2                                |
| `docs/social-asset-map.md`                            | `docs/`                              |                                     |

**Stays in `project-foundry`:** `public/hex/**` (page assets),
`scripts/gerber-to-paths.ts` and `scripts/gen-l101-gerber-data.ts` (the app's own
diagrams depend on them at build time), `src/components/guide/diagrams/**`.

`project-foundry` keeps a stub `docs/promo-pipeline.md` — three lines saying
where the pipeline went and that `public/hex/*` is generated by it. Without that,
the next person to need a re-cut finds an empty `tools/` and no trail.

### 3.1 The split of `hex-promo-cuts.mjs`

| Goes to `core/`                                                                        | Stays in `subjects/hex/`                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| virtual clock (+ timer queue + pinned epoch, §5.0)                                     | `frameOrbit`, `extentOverTurn`, `installOrbitStepper`             |
| `boot()` + chrome hiding + GPU flags                                                   | the beat table and every placement                                |
| the frame loop and its ordering                                                        | `forceCollapsed`, `waitForRest`, `waitForCameraRest`, `__closure` |
| `seamCheck`                                                                            | `addGroundMark` **and `markMult`**                                |
| preset table (aspect, dolly, lift, textSafe, textDl), `--frames`, `--probe`, `--light` | the hex cue sheet (PRINT/SNAP/GROW/FREE)                          |
| the whole cue/type layer                                                               | the `POLAR_PLAN` / `ORBIT_DOLLY` constants                        |
| encode + poster + webp                                                                 | the bed choice (`rd-revtaiko`)                                    |

Two hex-era defaults have to leave `core/` with the code that uses them:
**`markMult`** is the ground-mark multiplier — brand furniture that happens to be
tuned per preset — and **the default bed path** in the master. A default is a
coupling that does not look like one; the bed becomes a required parameter.

**The port is not a rewrite.** Acceptance is byte-identical output: re-render
`vertical`/`wide`/`band` from the new repo and compare against the mp4s the
current tool produced from the same `bioscale-viz` commit. Any difference is a
port bug, not an improvement. §10.1.

### 3.2 `hex-drums.py` is retired, not deleted

It synthesised the bed that was rejected after four rounds. It is kept because
the sub layer still uses one of its generators and because deleting it loses the
record of what did not work. It is renamed with a `_retired-` prefix so nobody
reaches for it by accident, and `audio/README.md` says why in one line.

## 4. The stage problem

`subjects/hex` drives someone else's app. `subjects/gerber` and `subjects/board`
have no app at all — there is nothing to point a browser at.

So the repo carries **`subjects/_stage/`**: a minimal Vite + three.js app whose
only job is to be a canvas the harness can drive. One route per subject, a scene
module per subject, no UI, no router, no state management. It boots, it exposes
`window.__scene`, and it gets out of the way.

This is a real new component and the plan must not pretend otherwise. It is
small — a canvas, a renderer, a camera controller, a GLB loader and an extruder
— but it is the difference between "port the hex tool" and "build a pipeline".

**The academy subject does NOT use the stage.** It drives a local
`project-foundry` dev server, because the whole point is capturing the real
product.

## 5. Determinism — per surface, honestly

The hex pipeline works because a WebGL scene is entirely rAF-driven on a canvas:
freeze `performance.now` and everything freezes. That property does not survive
contact with a Next app, and the plan is only as good as its answer here.

| Motion source                        | Scrubbable?          | Mechanism                                                                             |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------- |
| `requestAnimationFrame`              | yes                  | virtual clock (built)                                                                 |
| CSS animation / transition           | yes                  | `getAnimations({subtree:true})`, `pause()` + `currentTime` (built for the type layer) |
| Web Animations API                   | yes                  | same call covers it                                                                   |
| **`setTimeout` / `setInterval`**     | **not by the clock** | virtual timer queue, §5.0                                                             |
| **`Date.now()` / `new Date()`**      | **not by the clock** | pinned epoch, §5.0                                                                    |
| **`scrollTo({behavior:"smooth"})`**  | **NO**               | drive `scrollTop` per frame; §5.1                                                     |
| **`scroll-behavior: smooth` in CSS** | **NO**               | same; forced to `auto` in the capture stylesheet                                      |
| video / iframe embeds                | no                   | detected and replaced with their poster still, §5.3                                   |
| `IntersectionObserver` reveals       | indirectly           | forced layout read + one paint after each scroll write, before the shutter            |
| network arrival time                 | no                   | capture-scoped seed + blocked third parties (§5.2)                                    |
| font swap                            | no                   | `document.fonts.ready` before frame 0 (built)                                         |
| image decode                         | no                   | `img.decode()` on everything in viewport before frame 0                               |

### 5.0 The clock has to cover more than `performance.now`

The hex capture replaces `performance.now`, which covers rAF and the Web
Animations timeline, and that was sufficient because a WebGL scene has no other
source of time. **A React app has two more, and both were missing from the first
draft of this plan.**

**Timers.** `setTimeout` and `setInterval` are untouched by a `performance.now`
override, so they keep firing on wall time — toasts, debounces, staged reveals,
the XP fanfare. A frame that takes 1.2 s to render lets a 300 ms timeout fire
four times over. `core/clock.mjs` therefore replaces both with a **virtual
queue** pumped from the frame loop: a 300 ms timeout fires exactly nine frames
later, on every run, regardless of how long each frame took.

This is the same failure as the smooth-scroll trap — time entering through a
door the clock does not watch — and it is worth stating in those terms, because
the first draft found the scroll case and did not generalise it.

**Wall-clock reads.** `Date.now()` and `new Date()` are pinned to a fixed
instant, recorded in the manifest as `captureEpoch`. Two reasons, and the second
is the one that is easy to miss: the obvious one is reproducibility, and the
other is that **relative timestamps in the UI would otherwise age in the
footage**. A logbook that says "earned 2 days ago" on the day of capture says
"earned 400 days ago" when the clip is re-rendered a year later.

**The epoch is defined relative to the seeded persona's timeline** — the seed
dates its events backwards from `captureEpoch` — so every relative timestamp
reads identically on every render, forever. Pinning the epoch to _today_ would
have fixed determinism and left the content wrong.

### 5.1 Smooth scroll is the load-bearing trap

`src/components/logbook/RankLadderModal.tsx` drives its rank wheel with
`wheel.current?.scrollTo({ top: idx * ROW_H, behavior: "smooth" })`, plus a
`requestAnimationFrame` snap when the target rank changes, over a container with
`scrollSnapType: "y proximity"`.

Smooth scrolling is implemented by the browser's scrolling machinery on its own
timeline. It is **not** a rAF callback, **not** a CSS animation, and **not** in
`getAnimations()`. Under a virtual clock it will advance on wall time or not at
all, and either way the captured motion is non-deterministic — which is
precisely the judder the clock exists to remove, arriving through a door the
clock does not watch.

**The rule:** a captured scroll is _authored_, never _requested_. The harness
sets `element.scrollTop` to an explicit value each frame, from its own easing
function, and the capture stylesheet forces `scroll-behavior: auto` globally so
nothing the app does can reintroduce a smooth scroll.

This is not a workaround. It is strictly better: authored scroll can be eased on
the same 120 BPM grid as everything else, so a scroll can land on a beat.

**Consequence for `scroll-snap`:** snapping is also compositor-driven and will
fight an authored `scrollTop`. The capture stylesheet disables
`scroll-snap-type`. The wheel's visual result is unchanged because the harness
puts each row where the snap would have.

### 5.2 Network

- A **capture-scoped seed** supplies all first-party data (§6.4.1). Not a
  production restore — see §6.4.4, which is a disclosure requirement, not a
  convenience.
- The Playwright context **blocks every third-party origin** by route
  interception — PostHog, Stripe, DigiKey, Google Fonts, Vercel telemetry. A
  blocked request is deterministic; a slow one is not.
- Anything first-party and genuinely async (a server action, a streamed segment)
  is awaited to quiescence **before the clock starts**, the same discipline
  `waitForRest` already applies to the hex scene.

### 5.3 Embeds, and what blocking them does to the picture

The first draft asserted there were no video elements on the target surfaces.
That is **false**: lesson pages carry YouTube embeds via the `youtube` content
block, and `/hex` has a `<video>` hero.

The interaction with §5.2 is the sharp part. Blocking third-party origins makes
an embed deterministic by making it **fail**, and a failed iframe is not blank —
it is a visible error box, in frame, in a promotional video.

So embeds are **detected and replaced** with their poster still before the clock
starts, and each scene asserts what it found rather than relying on a global
claim that no surface has any.

## 6. Subjects

### 6.1 `hex` — ported, unchanged

Choreographies `hero` and `orbit`, six presets, `--text`, `--light`,
`--ground-mark`, `--probe`. Behaviour frozen; see §10.1 for the acceptance test.

### 6.2 `gerber` — the layer stack explode

**The parsing is already done and it is trustworthy.** `scripts/gerber-to-paths.ts`
in `project-foundry` is a real RS-274X reader for the subset KiCad 10 emits, and
it is verified three independent ways: flash and region counts match a raw grep
of each file; the parsed `Edge_Cuts` bounding box comes out 30.1 × 62.1 mm, which
is exactly what the `.gbrjob` declares, derived independently of it; and In1_Cu
and In2_Cu parse identical, as they must. `data/l101-gerber-layers.ts` is the
L1.01 answer-key set already reduced to per-layer path geometry, tagged
`cu`/`mask`/`silk`, re-based to the Edge_Cuts origin, in millimetres.

L1.01 is **4-layer** — F_Cu, In1, In2, B_Cu — so the stack is silk / mask / F_Cu
/ In1 / In2 / B_Cu / mask / silk. Eight sheets. That explodes far better than a
two-layer board would.

**Vendoring.** `assets/gerber/l1-01.json` is generated by running
`project-foundry`'s `gen-l101-gerber-data.ts` against a checkout, and the
academy commit SHA is recorded in `assets/gerber/SOURCES.md` and in every
manifest entry. Regeneration is a documented one-liner. The promo repo does not
re-implement the parser; duplicating a three-ways-verified reader would be a
second thing to keep correct.

**Geometry.** Each sheet's paths become `THREE.ExtrudeGeometry`. Copper and silk
extrude as real shapes so the explode shows conductors, not a texture of them.

**Z is a stated exaggeration, not a measurement.** Real: 35 µm copper on a
1.6 mm core — the conductors are ~2% of the stack, so a true-scale explode is a
slab with dust on it. The plan renders each sheet at a **visual** thickness and
spacing, declared as constants with the real value in a comment beside them.
Nobody should later "fix" this back to reality and wonder why it looks wrong.

**The explode reuses the hex easing and beat grid deliberately**, so the two sets
read as one brand: the board opens the way the tray lid does.

**Why this scene earns its place:** it renders the thesis. The academy teaches
you to make a board; the stack _is what a board is_, which is the exact mental
model a beginner lacks. Vendors show renders. Nobody shows the stack.

### 6.3 `board` — GLB turntables, boards **and parts**

The cheapest new subject: a turntable is the hex orbit with a different scene
graph. Reuses the clock, the seam check, the presets, the type layer, the bed.

**Scope is the board _and_ its assets.** The owner asked for "3D rotations of
the L1.01 board and assets"; the parts platform already carries component CAD
served through `/api/part-model/[id]`, so a part turntable is the same subject
with a different GLB and different framing bounds. A component spinning next to
the board it lands on is also the better shot — it says "these are real parts
you will actually buy", which is the claim the live BOM backs up.

Three traps carried over from the `/learn` hero work, all of which will
reproduce here:

- **Force opaque.** KiCad's solder-mask export declares `alphaMode: BLEND` at
  α 0.30, so the board renders see-through unless materials are forced opaque.
- **GLB units are metres.** Framing maths that assumes millimetres is off by
  1000 and the camera ends up inside the board.
- **Bounds from the world-space AABB half-diagonal**, not the local one, or the
  fit is wrong at every orientation but the rest pose.

`assets/models/l1-01.glb` is vendored and pinned the same way as the gerber data.

### 6.4 `academy` — the UI scenes

Drives a local `project-foundry` dev server against local Postgres.

**Scenes**, each an exact 10 s loop:

| #   | Scene                                                            | Surfaces                                               |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| A1  | logbook: scroll the wall, click a rank, the ladder wheel spins   | `/logbook`, `PatchWall`, `RankWing`, `RankLadderModal` |
| A2  | the library: index, into a cluster, into a lesson                | `/library`, `/library/[slug]`                          |
| A3  | field guide: 3D object, push into the cover, scroll the contents | `subjects/_stage` → `/library/field-guide/...`         |

Plus `board` (A4) and `gerber` (A5) from §6.2–6.3. Five scenes.

**Every scene must return to its opening state.** A scroll ends where it began; a
modal that opens closes. This is the same closure discipline the hex
choreography already enforces, and it is a constraint on the choreography, not a
post-processing step.

#### 6.4.1 The promo persona

A logbook scene is worthless without a logbook. `subjects/academy/seed.mjs`
creates a user with plausible XP, a mid-ladder rank, earned patches and a couple
of enrollments.

- **Local only.** It refuses to run unless `DATABASE_URL` is localhost, in the
  same style as `db:pull-prod`. **The same refusal sits on the capture entry
  point**, not only on the seed — the operation that publishes frames is the one
  that needs the guard, and a seed guard alone would let a capture run against
  whatever the environment happened to point at.
- **Deterministic.** Fixed values, no randomness, no wall-clock reads; every
  event is dated backwards from `captureEpoch` (§5.0). The manifest records
  `seedSha` alongside `appSha`, because an academy frame is a function of the
  database as much as of the code.
- **Plausible, not maxed.** A maxed account reads as a mockup and undercuts the
  thing it is advertising. Mid-ladder with visible headroom is the honest and the
  more persuasive picture.
- **No real person's data.** The persona is synthetic end to end — name, avatar,
  progress. Nothing is derived from a real account.

#### 6.4.4 Disclosure: the local database is a copy of production

This is the sharpest risk in the plan and it is not obvious from any single
document.

`db:pull-prod` dumps production and restores it into local. So the "safe, local"
database that dev runs against **contains real user accounts, real email
addresses and real progress** — and the academy subject points a camera at that
database and publishes the frames. Any surface that renders another user, an
admin list, a count, a name, puts real personal data into a promotional video.

Saying the persona is synthetic addresses the persona. It does not address the
database around it.

Two controls, and the second does not depend on the first being remembered:

1. **The academy subject runs against a capture-scoped seed**, not a production
   restore. Unpublished content is excluded by query — which also keeps **L2.01**
   out of frame, since it exists only on local and is deliberately held back
   pending a safety review.
2. **A disclosure gate before any academy frame is encoded**: the captured DOM
   text is scanned for `@` and for any display name outside a one-name allowlist.
   A hit fails the render.

The gate is the backstop precisely because control 1 is a thing a person has to
get right, and control 2 is a thing the pipeline enforces.

#### 6.4.2 The synthetic cursor

A click on film is three things: a cursor arriving, a press state, and the
transition that follows.

- The **drawn** cursor is an overlay, on the same machinery as the type layer,
  positioned per frame from an authored path eased on the beat grid.
- The **real** interaction is `page.mouse` / `element.click()`, fired on the
  frame the drawn cursor lands, so the app's own state changes are genuine.
- The two are driven from one cue list so they cannot drift.

Drawing the cursor rather than capturing the OS pointer is what makes it
deterministic and lets it be brand-styled.

#### 6.4.3 Auth

`/logbook` is gated. The capture borrows a session the way the existing
verification recipe does — mint a session for the promo persona, set
`authjs.session-token` on the Playwright context. No credentials in the repo; the
seed script mints and prints, the capture reads from env.

### 6.5 The field-guide transition (A3) is the hard one

It is the only scene crossing both worlds: a 3D object that becomes a scrolling
page. The join is the whole trick and it is where it will look cheap if it is
wrong.

**Approach:** the guide rotates on the stage, the camera pushes into the cover
face, and **that face is the first frame of the page capture**. Two clips, joined
on a frame that must match.

**Make the join measurable, not eyeballed.** The 3D shot's final frame and the
page capture's first frame are compared with the same difference metric
`seamCheck` already uses; the join is accepted only when that difference is below
the clip's ordinary frame-to-frame step. It is the loop-seam test pointed at a
cut instead of a wrap — no new machinery, and it turns "does that look right"
into a number.

**If it does not converge, A3 ships as two scenes** and the tour cuts on the
beat instead of matching. Said now, in the plan, so it is a decision rather than
a late compromise.

## 7. Output, storage and lifecycle

### 7.1 R2 layout

```
<subject>/<scene>/<preset>/<generatorSha7>-<bedKit>-<contentSha7>.mp4
<subject>/<scene>/<preset>/<generatorSha7>-<bedKit>-<contentSha7>-poster.jpg
```

**A separate bucket, not a prefix.** The first draft said "credentials scoped to
the `promo/` prefix" — an assertion made without checking. Cloudflare R2 API
tokens scope to **buckets**; per-prefix scoping is not the standard token model,
so the plan would have been built on a control that may not exist. A separate
bucket gives the same isolation and is unambiguously achievable. If prefix
scoping does turn out to be available it is an optimisation, not a dependency.

R2 itself needs no new infrastructure — the S3 client, env shape and public base
URL pattern are already proven in the app (`R2_ENABLED`, `R2_ACCOUNT_ID`,
`R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`NEXT_PUBLIC_R2_PUBLIC_BASE_URL`). The promo repo gets its **own** credentials:
a render pipeline able to write anywhere in the app's bucket is a blast radius
with no upside.

**The content hash in the key is load-bearing.** Without it, re-running the same
generator commit against a different `appSha` or a refreshed vendored asset
silently overwrites a released artefact with different pixels under an identical
key. With it, manifest entries are immutable by construction.

### 7.2 The manifest is the point

`releases/<YYYY-MM-DD>-<name>.json`, committed. One entry per artefact:

```json
{
  "subject": "hex",
  "scene": "orbit",
  "preset": "vertical",
  "generatorSha": "5dd0ae05",
  "appRepo": "Otd-llc/bioscale-viz",
  "appSha": "c0957ded",
  "seedSha": null,
  "captureEpoch": null,
  "toolchain": {
    "playwright": "1.60.0",
    "chromium": "148.0.7778.96",
    "node": "v24.5.0",
    "ffmpeg": "8.0.1"
  },
  "bedKit": "rd-revtaiko",
  "bedSha256": "…",
  "r2Key": "hex/orbit/vertical/5dd0ae0-rd-revtaiko-9f31c02.mp4",
  "bytes": 764988,
  "durationS": 10.0,
  "seam": 0.173,
  "quietestOrdinary": 0.601,
  "loudnessLufs": -14.21,
  "truePeakDbtp": -1.0
}
```

**`appSha` is not optional.** A hex cut is a capture of `bioscale-viz` at a
commit. Without recording it, "reproducible" is a claim the manifest cannot
support — the recipe would be pinned and the subject would not be. The same
applies to `subjects/academy`, where `appSha` is a `project-foundry` commit and
`seedSha` + `captureEpoch` pin the database and the wall clock, and to the
vendored gerber and GLB assets, whose source SHAs live in `SOURCES.md`.

**`toolchain` is not optional either**, and for a reason discovered while
validating §10.1: Playwright ships its own Chromium, so two repos with different
Playwright versions render different anti-aliasing before an encoder is reached.
A capture is a function of its browser build, and a manifest that omits it is
recording half the recipe.

The manifest also carries the verification numbers, so a bad render is visible in
a diff rather than only in a log nobody kept.

### 7.3 Page-shipped assets stay committed where they are served

`public/hex/configurator*.mp4` (1.8 MB in `project-foundry`), the apex band, and
the four README WebPs remain committed in their own repos. A page hero must not
resolve through a bucket: it is a render-blocking dependency with a different
availability story, a different cache story and a different failure mode.

The promo repo _produces_ them; the consuming repo _commits_ them. The manifest
records where each one landed, so there is one place to answer "what is on the
academy hero right now".

### 7.4 Retention

R2 keeps every released artefact indefinitely — they are small and the manifest
indexes them. **Sandbox rounds are not uploaded at all**; they live in
gitignored `out/` and are expected to be deleted. The 42 MB of audio sandboxes
from the last session is exactly what must never reach either store.

## 8. Structure of the academy set

Hex is 10 s loops for feeds. The academy set is a **tour**, which wants 40–60 s.

Each scene renders as its own exact 10 s loop, then the tour is a `concat`
demuxer stream copy of five of them — seamless by construction, no re-encode, no
generation loss. The identical trick `--laps` already uses. Every scene is
postable alone _and_ they assemble.

**The bed is the one genuinely new piece of audio work.** Five laps of the same
10 s arrangement under a 50 s tour is monotonous. A tour wants an arrangement
that builds across 25 bars: sparse under A1, thickening through A2–A3, the drop
landing on the gerber explode, a resolve under the sign-off. `audio/bed.py` today
arranges exactly one lap and will need a section concept.

Loop safety is unchanged and still enforced at both stages: wrapped tails in the
arrangement, two-lap render through the reverb keeping the second.

## 9. Security, licensing, and secrets

### 9.1 Secrets

| Secret                              | Where                                                  | Rule                                                      |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Freesound API key                   | `C:/zzz/_hex-promo/.freesound-key`, outside every repo | stays outside; `.gitignore` entry is belt-and-braces only |
| R2 credentials                      | promo repo `.env.local`, gitignored                    | **own key, scoped to `promo/`** — not the app's key       |
| Session token for the promo persona | minted by the seed script, read from env               | never committed; local-only persona                       |

The promo repo gets its own R2 credentials rather than reusing the academy's. A
render pipeline that can write anywhere in the app's bucket is a blast radius
with no upside.

### 9.2 Licensing

- **CC0 samples**: 85 files, verified individually against the returned `license`
  field rather than trusted from the search filter. In a **private** repo there
  is no redistribution at all, so the risk is nil — but `provenance.json` is
  still committed, because the moment anything derived from it is published the
  attribution trail has to already exist. If the repo ever goes public, that
  file is the audit and it must be complete on the day of the flip, not after.
- **Fonts**: verified from source rather than recalled — `google/fonts`
  `METADATA.pb` gives `license: "OFL"` for both `ofl/bebasneue` (Copyright 2019
  The Bebas Neue Project Authors) and `ofl/spacemono` (Copyright 2016 The Space
  Mono Project Authors). The specimen pages are a SPA and serve nothing to a
  fetch, so they are not the place to check. Embedding as data URIs in a render
  is use; the cached `.woff2` files in `assets/fonts/` are redistribution, which
  OFL permits, and the licence text ships beside them.
- **Third-party marks in footage**: academy scenes will incidentally show
  DigiKey in the live BOM, the KiCad UI in guide media, and Espressif part
  imagery. Incidental nominative depiction in product footage, no endorsement
  implied — and **no third-party mark in a thumbnail or title card**, which is
  where incidental stops being incidental.
- **Board geometry**: L1.01's gerbers are OTD's own. The hex geometry is CC BY
  4.0 and OTD is the licensor. No third-party IP enters the render path.
- **Footage of the app**: the promo persona is synthetic. No real learner's
  progress, name or work appears in any frame. This is a hard rule, not a
  preference (§6.4.1).

## 10. Verification

Nothing here is accepted by looking at it.

### 10.1 The port is proven byte-identical

Re-render `vertical`, `wide` and `band` from the new repo and compare to the
mp4s the current tool produced. **A hash match is the acceptance criterion.**
Any difference is a port bug, not an improvement.

**This test is only meaningful against a pinned reference**, and the first draft
asserted it without one. Both halves are now recorded:

| Reference                                     | Value                                      |
| --------------------------------------------- | ------------------------------------------ |
| `bioscale-viz` commit (tree clean at capture) | `c0957ded742b23402616b59c082f720e7bb5ff96` |
| Playwright                                    | `1.60.0`                                   |
| Chromium (Playwright-bundled)                 | `148.0.7778.96`                            |
| Node                                          | `v24.5.0`                                  |
| ffmpeg                                        | `8.0.1`                                    |

Playwright bundles its own Chromium, so a fresh install in a new repo will very
likely pull a different build and the frames will differ in anti-aliasing before
the encoder is reached. **The new repo pins Playwright to `1.60.0` exactly**, or
the acceptance criterion is unachievable and the port lands unproven.

If encoder non-determinism still makes a hash match impossible, fall back to a
per-frame difference of the decoded PNG sequences, which must be exactly zero —
and record in the commit which route was used and why.

### 10.2 Per-artefact gates, already built or specified

| Gate                                 | Threshold                                                                                        | Status                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------- |
| loop seam < quietest ordinary step   | measured per cut                                                                                 | built                       |
| topology closure (tiles/caps return) | exact equality                                                                                   | built                       |
| framing over a full revolution       | no clipping at any azimuth                                                                       | built                       |
| webfonts rasterised before frame 0   | `document.fonts.check`                                                                           | built                       |
| overlay actually on screen           | computed style + bounding box                                                                    | built                       |
| cue sheet fits the clip              | throws at install                                                                                | built                       |
| **loop seam, academy scenes too**    | `seamCheck` is frame-difference based and subject-agnostic; it applies to a UI capture unchanged | **new use of a built gate** |
| **no smooth scroll survived**        | assert `scroll-behavior:auto` and zero `scrollTo` with `behavior:"smooth"` during capture        | **new**                     |
| **no timer fired on wall time**      | after the clock starts, the count of non-virtual timer firings is 0                              | **new**                     |
| **third-party requests blocked**     | count of allowed cross-origin requests is 0                                                      | **new**                     |
| **no embed left live**               | every `<video>`/`<iframe>` replaced by its poster before frame 0                                 | **new**                     |
| **disclosure**                       | no `@` and no display name outside the allowlist in any captured DOM                             | **new**                     |
| **the persona rendered**             | expected rank name and patch count present before the clock starts                               | **new**                     |
| **A3 join**                          | first/last frame difference below ordinary step                                                  | **new**                     |
| bed loudness                         | −14 LUFS ±0.5, TP ≤ −1.0 dBTP                                                                    | built                       |
| `core/` boundary                     | no subject vocabulary under `core/`, word-boundary matched                                       | **new**                     |
| manifest schema                      | every release entry validates                                                                    | **new**                     |

Two of these exist because a claim in the first draft was unfalsifiable.
"Each scene returns to its opening state" and "timers are virtualised" were both
_intentions_; a gate turns each into a measurement. That distinction has already
cost this project several rounds and is the thing this lens is for.

### 10.3 Operations

**Three subjects, three servers.** `hex` needs the `bioscale-viz` dev server,
`academy` needs a local `project-foundry` dev server plus local Postgres, and
`board`/`gerber` need the promo repo's own stage. Each subject carries its URL
in config, and the harness **preflights** it — a missing server fails
immediately with the exact command to start it, rather than as a Playwright
timeout thirty seconds later that reads like a bug in the capture.

**Promo CI cannot run captures**, and saying so is the point. They need a GPU,
two other repositories and a database. Left unstated, the next person builds a CI
that cannot work and then disables it, which loses the checks that _can_ run. CI
runs lint, the boundary check and the manifest schema check. **The manifest is
the evidence that a capture happened and passed its gates**, which is why §7.2
carries the verification numbers rather than a log file.

**Vendored assets never auto-refresh.** `assets/fonts/`, `assets/gerber/` and
`assets/models/` are committed, and the code that reads them **fails loudly when
they are missing** rather than fetching a replacement. The current
`displayFonts()` helper auto-fetches from Google on a cache miss, which is right
for a scratch directory and wrong for a repo that commits its fonts: a fresh
clone could silently render against a different file if upstream ever changed.
Refreshing any vendored asset is a separate, deliberate command that also updates
`SOURCES.md`.

### 10.4 What is deliberately not automated

Composition. Whether a word sits well against the geometry at a given azimuth is
a judgement, and every attempt so far to turn it into a number has measured the
wrong thing. The probe frames exist to be _looked at_; the plan says so rather
than pretending a metric covers it.

## 11. Sequencing

Tiers land independently. Each is a working state, not a checkpoint.

| Tier   | Content                                                                                                                                  | Proves                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **T0** | repo scaffold, CLAUDE.md, `.gitignore`, assets vendored, boundary check in CI                                                            | the shell                                 |
| **T1** | `core/` extracted + `subjects/hex` ported                                                                                                | byte-identical output (§10.1)             |
| **T2** | `core/manifest.mjs` + R2 + first `releases/*.json`                                                                                       | storage decision is real                  |
| **T3** | `subjects/_stage` + `subjects/board` turntable                                                                                           | core is reusable without touching it      |
| **T4** | `subjects/gerber` stack explode                                                                                                          | the distinctive scene; second reuse proof |
| **T5** | academy harness: timer queue, pinned epoch, authored scroll, cursor, blocked network, embed replacement, seeded persona, disclosure gate | the hard determinism work                 |
| **T6** | scenes A1–A3                                                                                                                             | the UI set                                |
| **T7** | 25-bar tour bed + the 50 s concat                                                                                                        | the film                                  |

**Every tier is independently landable**, and that is a requirement rather than
a nicety. The owner chose to take all of it in one session; written as one block,
a session that runs out of room leaves an unlandable half-state. Each tier ends
at a working state with its own acceptance, so **stopping on a tier boundary is
a success, not an abort**. Nothing is dropped by stopping — only deferred.

**T5 opens by auditing the motion source** of `Fanfare`, `PatchWall` and
`RankWing` before a line of scene code is written. If any of them drives motion
by a mechanism outside §5's table, that is discovered on day one rather than in
a capture that looks subtly wrong.

**T3 and T4 before T5 is deliberate** and is the one place this plan overrides
the stated preference for scene order. The UI scenes are the most expensive and
the least differentiated — every product promo is a cursor clicking a UI. The
board and gerber scenes are cheap, reuse the harness almost verbatim, and are
what nobody else can copy. Doing them first also proves the `core/` boundary
before the hardest subject depends on it. Nothing is dropped; only the order
changes.

## 12. Cost

| Item                                  | Estimate                                                 | Basis                                                                                                    |
| ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| render, per preset — **3D subjects**  | ~6 min                                                   | measured, hex orbit, this session                                                                        |
| render, per preset — **UI subjects**  | **unmeasured**                                           | different profile entirely: no WebGL, but full page layout and paint. Recorded at T5 rather than guessed |
| full social set, 5 scenes × 4 presets | ~2 h wall clock, **one clean pass, excluding iteration** | 20 renders                                                                                               |
| repo size at rest                     | ~25 MB                                                   | 20 MB assets + source                                                                                    |
| R2 per release                        | ~5 MB                                                    | 5 scenes × 4 presets × ~250 KB                                                                           |
| T1 port                               | the largest single piece                                 | 5.3k lines split, proven byte-identical                                                                  |
| T5 academy harness                    | the largest single risk                                  | six determinism problems, all solved on paper only                                                       |

The UI render figure is deliberately blank. Reusing a number measured on a hex
orbit for a surface with no WebGL is how an estimate becomes fiction, and every
prior round of this work has needed sandbox iterations that the "2 h" does not
include.

## 13. Open questions

_Owner-raised: none outstanding — the three decisions at the top of this document
closed them. The following are mine._

1. **(mine) Which board for the stack, long term?** L1.01 is the flagship free
   lesson and its data is already parsed, so it is the right first subject. The
   `OTD-MCU-001A` set in the hardware repo is a real 4-layer product board and a
   better _hero_ stack later. Not a T4 blocker.
2. **(mine) Does the tour need voice?** Assumed no. The set is designed to work
   muted, which is how a feed plays it.
3. **(mine) Does apex want the academy tour embedded?** Out of scope here; the
   manifest makes it cheap to answer later.
