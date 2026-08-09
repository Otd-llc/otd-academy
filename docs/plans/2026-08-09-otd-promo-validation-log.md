# `otd-promo` design — validation log

Engine: `docs/boards/_protocol.md` — **prove → find → improve → re-prove**, one
lens per pass, findings carry a severity, fixes fold back into
`2026-08-09-otd-promo-repo-design.md`, and every earlier lens a fix could have
disturbed is re-proved.

The board protocol's audits are its **interchangeable parts**; the engine is
what generalises. The twelve lenses below replace the electrical audits for a
pipeline design. Ten passes minimum, and never stop before a full sweep yields
zero new material findings.

**Result: 14 passes. Dry at pass 14.** 3 CRITICAL, 8 HIGH, 9 MED, 4 LOW.

**No fan-out.** Every pass is first-party reasoning against the artefacts in the
repo, per the standing no-subagent-research rule. Where a pass rests on a
third-party fact, that fact was fetched and is cited.

---

## Pass 1 — Scope & traceability

_Every owner requirement traces to a deliverable; no orphan requirement, no
unrequested deliverable._

| #   | Severity | Finding                                                                                                                                                                                                                                                                                         | Fix                                                                                                                           |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **HIGH** | The owner asked for "3d rotations of the l1-01 board **and assets**". The design planned only the board GLB. "Assets" — the component models the parts platform already carries — was dropped silently. A requirement lost between statement and plan is the failure this lens exists to catch. | §6.3 extended: the `board` subject covers board **and part** turntables, sourced from the same GLB path.                      |
| 1.2 | MED      | Open questions 2 and 3 are mine, not the owner's, and were not marked as such. A reader would take them as outstanding owner decisions.                                                                                                                                                         | §13 labels each question's origin.                                                                                            |
| 1.3 | LOW      | `subjects/_stage` traces to no owner requirement.                                                                                                                                                                                                                                               | Justified in §4 as required infrastructure for board and gerber. Kept, and the justification is explicit rather than implied. |

Re-proof: none needed; first pass.

---

## Pass 2 — Determinism

_Every source of motion on every captured surface: name the scrub mechanism, or
name it as unsolved._

This pass produced the most material findings in the run, and two of them
invalidate the approach as originally written.

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                             |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **CRITICAL** | **Timers were not in the table at all.** The virtual clock replaces `performance.now`, which covers rAF and the Web Animations timeline. It does **not** touch `setTimeout`, `setInterval` or `Date.now`. The hex scene never needed them because it is pure rAF; a React app is full of them — toasts, debounces, staged reveals, the fanfare. Under the virtual clock these keep firing on wall time, so the capture is non-deterministic through a door the clock does not watch. This is the same class of failure as the smooth-scroll trap, and I had already found that one and still did not generalise it. | §5 gains a **timer queue**: `core/clock.mjs` replaces `setTimeout`/`setInterval` with a virtual queue pumped from the frame loop, so a 300 ms timeout fires exactly 9 frames later, every time. |
| 2.2 | **CRITICAL** | **`Date.now` freezes nothing, and that is visible in the picture.** Any relative timestamp — "earned 2 days ago", a streak, a "last active" — renders against the real wall clock. The same capture re-run next month reads differently, which breaks the reproducibility claim in §7.2; worse, a published video ages visibly.                                                                                                                                                                                                                                                                                     | `Date.now` and `new Date()` are pinned to a fixed instant recorded in the manifest as `captureEpoch`. Reproducible, and the footage never ages.                                                 |
| 2.3 | **HIGH**     | §5 asserted "no video/GIF elements on the target surfaces; assert their absence". **False.** Lesson pages carry YouTube embeds (the `youtube` content block, from the video-structured-courses work), and `/hex` has a `<video>` hero. An A2 scene entering a lesson can hit one. Worse, §5.2 blocks third-party origins, so a YouTube iframe renders as a **visible error box** in frame.                                                                                                                                                                                                                          | §5 replaces the assertion with a rule: embeds are detected and replaced with their poster still during capture, and their absence is asserted per scene rather than globally.                   |
| 2.4 | MED          | `IntersectionObserver` reveal animations fire from scroll position. With authored scroll they do fire, but the callback is queued off the observer's own timing, not the frame loop.                                                                                                                                                                                                                                                                                                                                                                                                                                | Flushed by forcing a layout read and one extra paint after each scroll write, before the shutter. Recorded as a per-scene assertion rather than assumed.                                        |
| 2.5 | MED          | `src/components/logbook/Fanfare.tsx` is on an A1 surface and its animation mechanism was never checked. If it is timer-driven it is covered by 2.1; if it is rAF it is already covered; if it is neither the scene is not capturable as designed.                                                                                                                                                                                                                                                                                                                                                                   | T5 gains an explicit first task: audit Fanfare, PatchWall and RankWing for motion source before writing the scene. Named as a task, not assumed away.                                           |

Re-proof: pass 1 unaffected.

---

## Pass 3 — Reproducibility & provenance

_Can a shipped artefact be regenerated? What silently breaks it?_

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                 | Fix                                                                                                                                                                                                                                                                            |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | **CRITICAL** | **§10.1's acceptance test was unachievable as written.** "Byte-identical output" across two repos requires the same Chromium, the same ffmpeg and the same encoder settings. Playwright ships its own Chromium; a fresh `npm i` in a new repo will very likely pull a different build, and the frames will differ in anti-aliasing before the encoder is even reached. The plan asserted a criterion it could not meet. | The reference toolchain is now **recorded and pinned**: Playwright **1.60.0**, Chromium **148.0.7778.96**, Node **v24.5.0**, ffmpeg **8.0.1**. The new repo pins Playwright exactly. §10.1 also gains the documented fallback and the requirement to log which route was used. |
| 3.2 | **HIGH**     | **The byte-identical test's reference was about to expire.** It compares against mp4s rendered from a `bioscale-viz` working tree that is free to move at any moment. Nobody had written the commit down.                                                                                                                                                                                                               | Recorded now, tree clean: `c0957ded742b23402616b59c082f720e7bb5ff96` ("Re-cut the loop on the orbit choreography"). In the design and the handoff.                                                                                                                             |
| 3.3 | **HIGH**     | An academy capture depends on **database contents**, not only on a code SHA. Two seed runs with different XP produce different frames, so `appSha` alone cannot support the reproducibility claim.                                                                                                                                                                                                                      | The persona seed is deterministic — fixed values, no randomness, no `Date.now` — and the manifest carries `seedSha` alongside `appSha`.                                                                                                                                        |
| 3.4 | MED          | `displayFonts()` auto-fetches from Google when the cache is missing. In a repo that commits its fonts, an automatic network fallback means a fresh clone can silently render against a _different_ file if upstream ever changes.                                                                                                                                                                                       | In the promo repo the fonts are committed and the fetch path **fails loudly**; refreshing them is a separate, deliberate command.                                                                                                                                              |

Re-proof: pass 2's timer and epoch fixes strengthen 3.3 rather than disturb it.

---

## Pass 4 — Boundary and coupling

_Is `core/` generic, or hex code in a new folder?_

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                           | Fix                                                                                                                                                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **HIGH** | **The boundary check as specified is broken.** It greps `core/` for `cap` — which matches `capture`, the single most common word in the harness. The guard would fire on every file on day one, and a check that always fires gets disabled, which is worse than no check. This is the same lesson already recorded about the lift-residual gate. | Word-boundary regex, and `cap` is replaced by `\btray\b`/`\blid\b`.                                                                                                        |
| 4.2 | MED      | `markMult` sits in the shared preset table but is the **ground-mark** multiplier — hex brand furniture, per-preset only because it was tuned per preset.                                                                                                                                                                                          | Moves to `subjects/hex`.                                                                                                                                                   |
| 4.3 | MED      | `core/master.mjs` inherits a default bed path of `hex-bed-rd-revtaiko-master.wav` — a hex-era default living in core.                                                                                                                                                                                                                             | The bed becomes a required parameter; the default moves to the subject.                                                                                                    |
| 4.4 | LOW      | Preset names `band` and `readme` are delivery-surface names, not aspects.                                                                                                                                                                                                                                                                         | Kept. They are OTD delivery surfaces, not hex ones, and renaming them would break every existing filename for no gain. Recorded as considered-and-kept rather than missed. |

Re-proof: pass 1's §6.3 extension adds no `core/` vocabulary. Clean.

---

## Pass 5 — Data, fixtures and disclosure

_What state must exist for a scene to be capturable, where does it come from,
and what does it leak?_

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Fix                                                                                                                                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **HIGH** | **The local database is a restore of production.** `db:pull-prod` dumps prod and restores into local, so local carries **real user accounts, emails and progress**. The academy capture points a camera at that database and publishes the frames. Any surface showing another user — an admin list, a count, a name — puts real personal data into a promotional video. The design said "the persona is synthetic" and stopped there, which addresses the persona and not the database around it. | Hard gate before any academy frame is encoded: scan the captured DOM text for `@` and for any display name outside a one-name allowlist. A hit fails the render. Stated as a gate in §10.2, not as care. |
| 5.2 | **HIGH** | **L2.01 exists only on local and is deliberately held back pending a safety review.** An A2 library scene that scrolls the index would put unreleased, safety-held content on screen.                                                                                                                                                                                                                                                                                                              | The academy subject runs against a **capture-scoped seed**, not a prod restore, and unpublished content is excluded by query. The disclosure gate in 5.1 is the backstop.                                |
| 5.3 | MED      | The persona must be plausible rather than maxed — already in §6.4.1, but with no check.                                                                                                                                                                                                                                                                                                                                                                                                            | Left as authored judgement. A number cannot tell a flattering fixture from a fake-looking one; §10.3 already says composition is not automated, and this is that.                                        |

Re-proof: 5.2's capture-scoped seed strengthens 3.3's determinism claim — a
narrower fixture is a more reproducible one. Pass 3 re-proved clean.

---

## Pass 6 — Secrets and blast radius

| #   | Severity | Finding                                                                                                                                                                                                                                                                                | Fix                                                                                                                                                                                              |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | **HIGH** | §7.1 claimed R2 credentials "scoped to the `promo/` prefix". **I asserted a capability I had not verified.** Cloudflare R2 API tokens scope to buckets; per-prefix scoping is not the standard token model. The plan would have been implemented against a control that may not exist. | Replaced with a **separate bucket**, which is unambiguously achievable and gives the same isolation. If prefix scoping does turn out to be available, that is an optimisation, not a dependency. |
| 6.2 | MED      | The promo persona's session token is minted locally and read from env — fine — but nothing stops a capture running against a non-local `DATABASE_URL`.                                                                                                                                 | The seed script's localhost refusal is extended to the **capture entry point**, so the guard sits on the operation that publishes, not only on the one that writes.                              |
| 6.3 | LOW      | Freesound key handling is already correct: outside every repo, with a `.gitignore` entry as belt-and-braces.                                                                                                                                                                           | No change.                                                                                                                                                                                       |

Re-proof: 6.1's bucket change touches §7.1 only; pass 8 re-run below.

---

## Pass 7 — Licensing and redistribution

| #   | Severity | Finding                                                                                                                                              | Fix                                                                                                                                                                                                                                                                                                                                      |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | MED      | The design asserted the two webfonts are "SIL OFL" **from memory**, which my own standing rule forbids for third-party facts.                        | **Verified from source**, not from the SPA specimen pages, which serve no content to a fetch: `google/fonts` `METADATA.pb` gives `license: "OFL"` for both `ofl/bebasneue` (Copyright 2019 The Bebas Neue Project Authors) and `ofl/spacemono` (Copyright 2016 The Space Mono Project Authors). The assertion holds; it is now evidence. |
| 7.2 | MED      | Academy footage will contain third-party marks — DigiKey in the live BOM, the KiCad UI in guide media, Espressif part imagery. Not addressed at all. | §9.2 gains a line: incidental, nominative depiction in product footage, no endorsement implied, and no third-party mark in a thumbnail or title card.                                                                                                                                                                                    |
| 7.3 | LOW      | CC0 samples in a **private** repo are not redistributed, so the licence risk is nil today.                                                           | Unchanged — but §9.2 keeps `provenance.json` committed anyway, because if the repo ever flips public the trail must already be complete on that day, not assembled after.                                                                                                                                                                |

Re-proof: none disturbed.

---

## Pass 8 — Storage, keys and lifecycle

| #   | Severity | Finding                                                                                                                                                                                                                                                         | Fix                                                                                                                                                        |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | MED      | The R2 key is `<generatorSha7>-<bedKit>.mp4`, which does **not** include the vendored-asset or app SHA. Re-running the same generator commit against a different `appSha` silently overwrites a released artefact with different pixels under an identical key. | The key gains a short content hash. Manifest entries become immutable by construction.                                                                     |
| 8.2 | LOW      | `docs/manifest-schema.md` is named but nothing validates against it.                                                                                                                                                                                            | A schema check joins the CI list (it is one of the few things promo CI _can_ run — see 10.2).                                                              |
| 8.3 | LOW      | Retention says released artefacts are kept indefinitely; no rule for superseded ones.                                                                                                                                                                           | Kept deliberately, and now stated: they are the record of what was posted, they are ~250 KB, and deleting them would break the manifest's job as an index. |

Re-proof: 6.1's separate bucket does not disturb the key layout. Clean.

---

## Pass 9 — Failure modes and verification

_How does each stage prove itself, and what passes silently?_

| #   | Severity | Finding                                                                                                                                                                                                      | Fix                                                                                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **HIGH** | The academy scenes had **no loop gate**. §6.4 says each scene "returns to its opening state", which is an intention, not a measurement — exactly the shape of claim that has failed repeatedly in this work. | `seamCheck` is frame-difference based and subject-agnostic: it applies unchanged to UI captures. Added to §10.2 for every scene. |
| 9.2 | MED      | Nothing verifies that the seeded persona is what the scene _shows_. A silently failed seed yields a plausible, empty logbook.                                                                                | An assertion on the rendered DOM before the clock starts: expected rank name and patch count present.                            |
| 9.3 | MED      | The determinism fixes of pass 2 are unfalsifiable as written — nothing proves the timers were actually virtualised.                                                                                          | A capture-time assertion: after the clock starts, the count of timers that fired against wall time is zero.                      |

Re-proof: pass 2 re-run against 9.3 — the fix makes 2.1 checkable rather than
merely designed. Pass 3 re-proved: 9.2 strengthens 3.3.

---

## Pass 10 — Cross-repo operations

| #    | Severity | Finding                                                                                                                                                                                         | Fix                                                                                                                                                  |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | MED      | Three subjects target three different servers — bioscale-viz on 5180, the academy dev server, the promo stage on Vite's own port — and nothing in the design said how the harness learns which. | Per-subject config carrying its URL and a preflight that fails with the exact command to start the missing server, rather than a Playwright timeout. |
| 10.2 | MED      | **Promo CI cannot run captures.** It needs a GPU, two other repos and a database. Left unsaid, the next person builds a CI that cannot work and then disables it.                               | Stated explicitly: promo CI runs lint, the boundary check and the manifest schema check. Captures are local, and their evidence is the manifest.     |
| 10.3 | LOW      | Three checkouts are now needed to make one hex video, against two today.                                                                                                                        | Accepted and recorded. It is the cost of the decision, not a defect.                                                                                 |

Re-proof: none disturbed.

---

## Pass 11 — Sequencing and landing

| #    | Severity | Finding                                                                                                                                                      | Fix                                                                                                                                                                                                                                                   |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | **HIGH** | The owner chose "everything in one session", and T0–T7 is very large. Written as one block, a session that runs out of room leaves an unlandable half-state. | Tiers are restated as **independently landable**, each a working state with its own acceptance. The handoff says explicitly that stopping on a tier boundary is a success, not an abort. Nothing is dropped — only the stopping points are made safe. |
| 11.2 | MED      | T7's tour bed needs a _section_ concept; `audio/bed.py` arranges exactly one lap today. That is design work, not tier tail.                                  | Called out in §8 as the one genuinely new piece of audio work, and placed last so it blocks nothing.                                                                                                                                                  |
| 11.3 | LOW      | T3/T4 before T5 overrides the owner's stated scene order.                                                                                                    | Kept, with the reasoning in §11 and surfaced in the handoff so it is visible rather than quietly done.                                                                                                                                                |

Re-proof: none disturbed.

---

## Pass 12 — Cost and scale

| #    | Severity | Finding                                                                                                                                                                                                                                                                          | Fix                                                                               |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 12.1 | MED      | "~6 min per preset per scene" is measured for a **hex orbit** capture and was applied to UI scenes, which have a different cost profile entirely — no WebGL, but full page layout and paint. Reusing a measured number outside what it measured is how estimates become fiction. | §12 marks the UI figure **unmeasured**, to be recorded at T5 rather than guessed. |
| 12.2 | MED      | The 2 h figure covers one clean pass of the social set. It excludes the tour, iterations, and the sandbox rounds that every prior round of this work has needed.                                                                                                                 | Restated as "one clean pass, excluding iteration", which is the honest framing.   |

Re-proof: none disturbed.

---

## Pass 13 — Full sweep (dry attempt 1)

All twelve lenses re-run against the amended design. **One new finding**, which
is why the run did not stop here.

| #    | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                           | Fix                                                                                                                                                                                              |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13.1 | **HIGH** | Re-running the determinism lens after the `Date.now` fix surfaced its consequence: pinning the epoch fixes reproducibility, but **the pinned instant must also be chosen**. Pin it to the seed's own reference date and every relative timestamp reads sensibly; pin it to today and re-renders next year say "earned 400 days ago". The fix had solved determinism and left the _content_ wrong. | `captureEpoch` is defined **relative to the seeded persona's timeline** — the seed dates its events backwards from the epoch — so relative timestamps read identically on every render, forever. |

Re-proof: passes 2, 3 and 5 re-run against 13.1. Clean.

---

## Pass 14 — Full sweep (dry)

All twelve lenses re-run. **Zero new material findings.** Design is dry.

Spot re-proofs performed in this pass:

- **Scope** — the `board` subject now carries part turntables (1.1); every owner
  requirement traces.
- **Determinism** — rAF, WAAPI, CSS, timers, `Date.now`, scroll, snap, network,
  fonts, images, embeds all have a named mechanism or a named exclusion.
- **Boundary** — the amended check uses word boundaries and would not fire on
  `capture` (4.1); `markMult` and the bed default have left `core/` (4.2, 4.3).
- **Verification** — every claim in §10.2 is either built today or has a named
  new gate; nothing is verified by intention alone (9.1).
- **Provenance** — generator, app, seed, epoch and toolchain are all pinned and
  recorded (3.1, 3.2, 3.3, 2.2).

---

## Residual risk, carried knowingly

| Risk                                                    | Why accepted                                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The A3 field-guide join may not converge.**           | It has a measured gate and a stated fallback (ship as two scenes, cut on the beat). A fallback decided in advance is not a risk; it is a branch.     |
| **Composition is not automated.**                       | Every attempt to reduce it to a number has measured the wrong thing. §10.3 says so plainly rather than implying coverage.                            |
| **T5's four determinism problems are solved on paper.** | Timers, epoch, embeds and observers each have a mechanism, but none has been executed. T5 is the plan's largest single risk and is labelled as such. |
| **Promo CI cannot exercise the pipeline.**              | Captures need a GPU and two other repos. The manifest is the evidence instead.                                                                       |
| **`--frames` normalises the whole choreography.**       | Correct for hex; carries to authored scroll unchanged. Verified in pass 14, not assumed.                                                             |
