# Hex share-URL: scannable sheets, shorter payloads, identity fixes

**Status: ALL ITEMS SHIPPED OR CUT (2026-08-06).** Item 1 merged as bioscale-viz
PR #18 and is live. Items 0 and 2-8 are on bioscale-viz `fix/sheet-url-and-identity`
(PR #19), unmerged. Three corrections to this document are marked **[CORRECTED]**
below — two of its measurements did not survive execution.

| item | outcome | commit |
| --- | --- | --- |
| 0 — per-test timeouts | shipped; the premise was wrong, see [CORRECTED] | `1d1cce2` |
| 1 — merge ghost-wire-audit | **merged and deployed**, PR #18 | `2757c0a` |
| 2 — `.qr-url` as an anchor | shipped | `92ab94c` |
| 3 — caption honesty + quiet zone | shipped | `8284b90` |
| 4 — `u=` save pre-flight | shipped | `0ac59dd` |
| 5 — three identity forks | shipped, all mutation-checked | `488ce88` |
| 8 — freeze the token corpus | shipped, before item 6 as required | `5455528` |
| 6 — v2 palette wire format | shipped; saving overstated here, see [CORRECTED] | `472abd4` |
| 7 — telemetry | **mostly cut**, one event kept | `3e5d428` |

**Three adversarial validation rounds** were run before execution (2026-08-06);
this was plan v4. What follows is the plan as written, annotated where execution
disproved it.
**Repos:** `bioscale-viz` (configurator, most of the work) · `project-foundry`
(academy — doc edits only; **no code change and no deploy needed**, proven below).

---

## 1. Why: the measured problem

Every saved build in production currently **fails to scan off a printed sheet**,
and the fix is a CSS width that is already written but unmerged.

### Prod census — 2026-08-06, read-only

`scripts/hex-prod-census.ts` and `scripts/hex-prod-tokens.ts` (both read-only,
run via `pnpm db:prod`):

| revisions | clusters | median | max payload | max cells | ≥19 cells | `u=` | retired tokens |
|---|---|---|---|---|---|---|---|
| 4 | 3 | 268 ch | **401 ch** | **35** | 2 | 0 | **0 of 4** |

Per row: 31 cells/377 ch · 35 cells/401 ch · 4 cells/210 ch · 4 cells/268 ch.
All `schemaVersion 1`; all decode cleanly. Density ≈ **11.5 chars/cell**.

> The earlier claim "only 2 builds ever, max 17 cells" came from LOCAL
> `foundry_dev` and was **worthless**: the last `db:pull-prod` was 2026-07-15,
> three weeks before the hex tables existed (migration `20260802040000`). Local
> has never held a production hex row. Do not re-derive scope from local.
>
> Blind spot that remains: a build too large to store never becomes a row
> (`payload-too-large` / `payload-uncompressed` reject before insert), so this
> census cannot see failed saves. Pair with PostHog `hex_save_started` vs
> `hex_save_completed` if that matters.

### The QR arithmetic

Printed module size is `mm = 41.275 / (19 + 4V)` — the `.qr` box is 156 px, CSS
fixes 1 in = 96 px, and `qr.ts` `margin: 1` makes the viewBox `17 + 4V + 2`
modules. Write that formula down; it is the whole analysis.

| box | largest build (401 ch → QR v16) | verdict |
|---|---|---|
| **78 px** (20.64 mm) — what `origin/main` ships | 0.249 mm/module | **fails everything** |
| **156 px** (41.28 mm) — commit `2f9f388`, unmerged | **0.497 mm/module** | passes (GS1 *target*) |

Reference floors: GS1 GenSpecs §5.12.3.1 gives X-dimension min **0.396 mm**,
target 0.495 mm. **Cite this as a rule of thumb, not as compliance** — that
clause governs retail POS scanning of consumer units, not engineering drawings,
and the 0.4 mm/module figure is *not* a per-module minimum in ISO 18004. The
prior design doc (§7.1 of `2026-08-01-hex-cluster-saved-builds-design.md`) says
exactly this; do not delete the caveat when updating that file.

Scannable ceiling at 156 px is **v21** (0.401 mm passes; v22 = 0.386 fails).

---

## 2. What ships, in dependency order

### Item 0 — PRECONDITION: make `pnpm test` green

**These 23 commits have never run CI**, and four tests sit within 6-8% of
vitest's 5000 ms default timeout.

`ci.yml` triggers only on `push: [main]` and `pull_request: [main]`. PR #17 was
merged 2026-08-05T07:37, so no PR is open and branch pushes fire nothing. The
last branch run is `462fb12` (the squash boundary): **20 test files then, 21
now** — `cap-collision.test.ts` and `cap-occupancy.test.ts` have never executed
in CI, on any runner.

**Measured, on an idle 12-core box: the suite is GREEN.** 22 files / 284 tests /
exit 0, three consecutive runs. It goes red only under parallel load (verified
by re-running under 8 burner processes, which reproduces exactly 4 timeouts —
`cap-collision.test.ts:221/:233/:255` and `history.test.ts:134`, **zero
assertion failures**). Idle margins: `MAX_HISTORY` 4394-4588 ms, cap-collision
3766-4693 ms, both against 5000 ms.

> **[CORRECTED] on execution — two claims here did not hold.**
>
> 1. **"22 files" is right; the hazard note in §5 saying 21 tracked files is
>    WRONG.** There are **22 tracked** test files. The 22nd is
>    `src/analytics.test.ts`, tracked since PR #11, at depth 1 — and a
>    `git ls-files 'src/**/*.test.ts'` pathspec drops depth-1 files, which is
>    exactly how "21" was derived. **There is no stray file.** Do not go hunting
>    for one.
> 2. **The red-under-load condition could not be reproduced.** 8 burners: no
>    inflation at all. 36 burners on 12 cores: `MAX_HISTORY` reached 4724 ms,
>    still under 5000. A stashed A/B at 48 burners with the timeouts REMOVED was
>    **still green**. So the timeouts are correct-by-construction — raising a
>    budget cannot fail a passing test — but they are not a proven fix for a
>    reproduced failure.
>
> **CI has since answered the real question.** These four tests ran on a GitHub
> runner for the first time in PR #18 and passed comfortably: 22 files / 284
> tests, **9.16 s of total test time**, faster than the local box. The
> smaller-runner worry was unfounded.
>
> Separately, one unattended local `pnpm test` hit **71 s** of test time, a 5.5×
> inflation, and passed — which is the contention evidence the burners failed to
> manufacture.

**The claimed `history.test.ts` perf regression does NOT exist — refuted.**
Controlled interleaved A/B in an isolated worktree at `ef72cb4` (the commit
immediately before `f648a35`, where `setBaseRotation` provably has no reseed),
same test file: **before 1038 ms mean, after 1017 ms mean — HEAD is 2% faster.**
Reason: `placeCell` already reseeds (`cells.ts:315`, neighbours at `:145`), so by
the time `setBaseRotation` reseeds, `emitDovetailMarker` is skipped by the guard
at `caps.ts:574`. The cost is one redundant `slotsForCell`. The test is
inherently ~1.0 s because it does 105 `placeCell` + 100 `restoreSnapshot` of up
to 105 cells — O(n²) scene work predating this branch.

**Fix: explicit per-test timeouts on all four slow tests** (or a blanket
`vitest.config.ts` `testTimeout` — the earlier objection that this would "hide"
a regression dissolves, because there is no regression). **Do NOT do the
reseed-batching refactor**: it is feasible and arguably more correct, but
correctness still requires every cell's markers to be right, so it stays
O(cells) per restore and removes only the ~2% duplicate. It cannot move a 1.0 s
test below a timeout that trips only at 4× parallel inflation.

This is still a merge precondition — not because the code is slow, but because
these four tests have never run on CI's much smaller runner and their behaviour
there is genuinely unknown.

### Item 1 — Merge `fix/ghost-wire-audit` → main (bioscale)

**SQUASH ONLY.** The "13 files / +1855 / −95" figure is true only for a squash;
the branch carries **23 commits** past base `cd4132d` and a three-dot diff reads
80 files / +20110 because PR #17 was squash-merged out from under it.

A plain `git merge` **conflicts in 4 files** (`cells.ts`, `ghosts.ts`,
`main.ts`, `palette.ts`) — pure squash artifact. Correct procedure:

```
git rebase --onto origin/main 462fb12 fix/ghost-wire-audit
```
Safe by construction: `git diff 462fb12 origin/main` is **empty**, so the 23
patches replay onto an identical tree.

Then: re-run all gates locally → open a NEW PR (#17 is merged; no PR exists) →
squash-merge. Acceptance check: exactly **13 files / +1855 / −95**.

Notes:
- CI is **advisory, not required**: `gh api .../rulesets` and
  `.../branches/main/protection` both 403 ("Upgrade to GitHub Pro or make this
  repository public"). Nothing blocks a merge; read the run yourself, and
  remember `gh pr checks` reports false-green on queued checks.
- `deploy.yml` fires on push to main with no `needs`, so **a red CI still
  deploys** to Cloudflare Pages, and the academy `/hex` iframe picks it up with
  no academy deploy.
- User-visible behaviour this ships, ranked: **choosing an insert now ARMS
  instead of places** (worth a release note; deliberately not applied to the
  cap/spike/accessory drawers, so the palette is now inconsistent by design) ·
  wider cap hit volume · base rotation reseeds cap slots · busier ghost wiring ·
  slower clock-based explode · Q6 mobile masthead · **QR 78→156 px** · font
  preloading · orphan-footer detector.
- **The Q6 mobile re-grid is entirely unguarded.** `check-sheet.mjs` only ever
  opens a 1180 px viewport and `build-sheet-spec.css` has no 640 px block, so
  `sheet:check` passes because it never evaluates the mobile design.
- Update stale 78 px comments: `save-link.ts:51-56`, `export/index.ts:423-429`,
  `export.css:478`, `export.css:1049`, `html.test.ts:175`.
- Update `docs/plans/2026-08-01-hex-cluster-saved-builds-design.md` §7.1 (whole
  table is 78 px and now contradicts main). **Separate PR in project-foundry**,
  where `main` is PR-only with required `guard` + `Vercel`.

### Item 2 — `.qr-url` becomes an `<a href>` carrying the full URL

`shortURL()` (`html.ts:457-464`) returns `host + pathname`, dropping fragment
AND query. So an **unsaved** sheet prints a link to an empty configurator while
the entire build sits in the discarded `#s=`. Measured: real default scene
prints `demo.onethousanddrones.com/hex` (30 ch) while the payload is 186 ch.
A saved sheet is unaffected (its code lives in the pathname).

Fix: make it an anchor. Chrome's print pipeline preserves the full URI in a
`/Link` annotation — **verified to 283 chars, at zero layout cost** — and the
text is recoverable from the PDF's `/ToUnicode` CMap. Follow the approved
`.foot-url` pattern (`export.css:715-720`) plus a `:focus-visible` ring.

**Decide `target`/`rel` explicitly — do not inherit.** `.foot-url`
(`html.ts:359`) is a same-tab `<a>` with neither, and the export modal is
reachable **inside the academy `/hex` iframe**. Inheriting that pattern means a
click navigates the iframe and drops embed mode (parent handshake, save-to-
academy). One attribute settles it; make it a decision, not an accident.

Visible text: keep `host+path`, or `host+path#fragment` while ≤84 chars (the
measured 2-line headroom at 42 ch/line). Do **not** print ~500 chars of
case-sensitive base64url at 6 px — P(perfect human transcription) ≈ 12%.

Fix the false claims at `html.ts:454-456` and `export.css:466-469` ("the
transcription fallback for a smudged or photocopied sheet"). Also
`export.css:468` says `word-break: normal` while `:481` is
`overflow-wrap: anywhere`.

`check-sheet.mjs`: the **unsaved** pass (`:560`) never reads `.qr-url` — that is
why this shipped. Add an `href`-contains-`#` assertion there. Add `.qr-url` to
BOTH `docs/build-sheet-spec.css` and `SELECTOR_MAP` (`check-sheet.mjs:139`) or
the `UNMAPPED` gate fails the build.

### Item 3 — Caption honesty at v22

Keep the QR **always**. Never fall back to no-QR: with item 2 unfixed that
converts "might scan" into "definitely lost", and even with item 2 the QR is the
primary path.

Above **v21**, replace "Scan to open" with a ≤29-char note that reads sensibly
**on paper** (the caption prints; nothing is clickable there). Needs
`QRCode.create(url, {errorCorrectionLevel:'M'}).version`.

**Unspecified plumbing to resolve during implementation:** the caption is
rendered at `html.ts:287` from `qrSVG.html ? 'Scan to open' : 'Too large to
encode'`. A version-dependent caption needs the version plumbed from
`renderSheet` (`export/index.ts`) into `sheet()` — a renderer signature change.
Pick ONE threshold: the 78 px rule is `@media screen` only, so one caption
serves both surfaces; gate on the print box (v21). Extend
`html.test.ts:172-180`, which asserts `not.toContain('Scan to open')` for the
empty-QR case and does not anticipate a third caption.

**Do NOT change `margin: 1 → 4`.** The box is locked, so it shrinks modules
(v24: 0.359 → 0.341 mm). The quiet zone is already physically present —
`qr.ts:23` sets `light: '#ffffff00'` on a white sheet.

Separately, `.qr-cap { margin-top: 4px }` gives only **1.90X** bottom quiet zone
at v4 — the SAVED sheet, the bulletproof path. 4X needs ≥13.37 px, so ~14 px.
`.qr-cap` IS in the frozen spec, so update it in the same change, and re-measure
the masthead (already grew 223 → 251 px and wrapped SHEET to two lines).

### Item 4 — `u=` save pre-flight

`hex-cluster.ts:110` refuses `u=` server-side, so a Safari 15.0-16.3 user can
**never** save — and learns it only after crossing origins, signing in, and
filling the name form. Gate or warn in `beginSave` (`save-link.ts:137`) before
`window.location.assign`. `HAS_COMPRESSION` (`state-url.ts:557`) is not
exported; simplest gate is `captured.payload.startsWith('u=')`.

**The caller is not exhaustive — tsc will NOT catch this.** `beginSave`'s only
production caller (`export/index.ts:203-224`) handles `awaiting-parent` and
`navigating`, then falls through a ternary:
`result === 'no-lineage' ? '…' : 'Could not capture the scene. Try again.'`.
A new `BeginSaveResult` variant compiles clean and silently shows the Safari
user **"Could not capture the scene. Try again."** — the wrong message for a
browser-capability refusal. So this item must ship three things together: the
named variant, its copy, and the new branch in `export/index.ts`.

Test via the existing `EncodeOptions.forceUncompressed` (`state-url.ts:319-327`),
which exists for exactly this.

### Item 5 — Three identity bugs

Measured hash movement across a 21-payload corpus including both real builds:
**ZERO** for every real payload; only hand-crafted orphan-spike payloads move.

- **5a lid-fork** (most reachable — two clicks, no crafted input).
  `cells.ts:364` writes the armed lid onto every carrier, but only the 5
  `CARRIER_BOARD_MODEL` carriers have a fill. Identical geometry and identical
  BOM produce a different drawing number, sticky for the session →
  `lookupIdentity` misses → a saved build prints UNCONTROLLED.
  Fix: `cell.carrierFilled = CARRIER_BOARD_MODEL[carrier] ? currentCarrierFilled : true;`
  (needs a new import from `./types.js`.)
- **5b `carrierFilled` restore leak.** `state-url.ts:455` and `history.ts:127`
  are both `if (cs.cf === false) …` — downward-only. Set it explicitly BOTH
  ways. `history.ts` is the reachable one: undo after arming lid-off drops a lid
  the user never touched.
- **5c orphan spikes never pruned.** `clearAllSpikes()` empties `spikeNodes`;
  `applySpikeSnapshots` writes only `spikes`; the prune loop
  (`spikes.ts:881-886`) iterates `spikeNodes` and is a guaranteed no-op after
  restore. The second loop cannot save it — `canPlaceSpikeVariantAt` returns
  true for every variant but `platform-lrg`. A phantom spike is invisible,
  hashed, **and printed into the BOM** (`export/anchors.ts:145`) and the parts
  pack (`html.ts:164`). Fix must iterate the **union** of `spikes` and
  `spikeNodes` or it leaks scene nodes.
  Then rewrite `corpus.test.ts:347 validTriples()` to use `enumerateJunctions()`
  — it currently infers junction-ness from `spikes.size === 1` after exactly the
  path this fix repairs, so post-fix it returns zero triples and silently no-ops
  ~29 corpus tests. **`enumerateJunctions` is not exported** (`spikes.ts:435`);
  export it first (tsc will catch this one).
  Also fix the comment at `state-url.ts:467-470`, which asserts the pruning this
  bug disproves.

### Item 6 — v2 palette wire format

~60 lines, bioscale only. A **pre-serialisation transform**: decode expands to a
v1-*shaped* object, so the 197-line validator, `canon.ts`, and all 4 pinned
fixtures run untouched and `JSON.parse` stays the integrity check.

```ts
type PaletteEntry =
  | [SubSlot, BaseType, number, number, CarrierType, boolean, EncodedCell['cp']]
  | [SubSlot, BaseType, number, number, CarrierType, boolean, EncodedCell['cp'], false];
//   ss       bt        br      ir      cr           ex       cp                  cf===false

interface WireV2 {
  v: 2;                                  // migrate() dispatches on this
  p: PaletteEntry[];                     // canonically ordered
  k: Array<[number, number, number]>;    // [q, r, paletteIndex]
  sp?: EncodedSpike[];                   // v1 tuple shape, unchanged
}
```

**Three versions, all distinct — this table is load-bearing:**

| version | value | why |
|---|---|---|
| wire `v` (what `migrate()` dispatches on) | **2** | so a stale reader returns `unsupported-version`, not `malformed` — the contract at `state-url.ts:283-296` |
| canon `v` (in `CanonV1`) | **1**, always | `canon.ts:171` hashes it; anything else renumbers every drawing. Do NOT add a `canonVersion` key — any new key moves every digest too |
| `HexClusterRevision.schemaVersion` | the **wire** version | `save-link.ts:154` currently feeds `captured.state.v`, which is about to become a constant 1 |

**The `v:1` stamp needs no new code.** `validateEncodedState` (`state-url.ts:243,
:276`) hard-requires `raw.v === 1` and returns a literal `v: 1`. Route
`expandWireV2` output through it and the stamp is enforced twice.

**Pipeline:** `migrate()` gains a `v === 2` branch → `expandWireV2` → the same
`validateEncodedState`. Expansion happens **before** validation, so
`MAX_CELLS` / `MAX_CAPS_PER_CELL` still bound the expanded state — this is what
stops a 20-char index array becoming a decompression bomb. Add
`if (p.length > MAX_CELLS) return null` as well, so the palette itself is bounded
and the claim is literally true rather than true-by-consequence. `expandWireV2`
must **never clamp or repair**: any bad index, wrong arity, or an 8th element
that is not literally `false` returns null → `malformed`.

**Carrying the wire version to `save-link.ts:154` needs a new field.**
`SceneCapture` is `{payload, state}` (`state-url.ts:505-510`) and the wire
version is decided inside `encodeState`, so nothing downstream can read it
today. Add `wire: WireVersion` to `SceneCapture`, sourced from the decode
outcome (authoritative — it is what the payload *is*, not what the encoder
intended, so it follows the guard automatically).

**Total ordering** (makes the encoder a pure function of the state; export the
comparators from `canon.ts`, do not copy them):
1. caps within an entry: by `slotId` code-unit order, then stringified
2. key on `cf !== false` (absent and `true` must fold to one entry)
3. palette order: by code-unit order of the stringified entry
4. index = position in that sorted palette
5. cell order in `k`: `q` asc, `r` asc, subslot rank, then stringified
6. `sp`: normalised triples sorted numerically, arity preserved

Rules 1, 2 and 6 are invisible to `canonicalize()` and each costs real bytes —
omitting rule 1 measured 237 → 332 ch (+40%) and made the palette a function of
click order.

**Guard:** pick v2 only if `JSON.stringify(v2).length < JSON.stringify(v1).length`
(strict `<`, ties to v1), compared **pre-deflate** — deflate output is not
byte-specified, so a post-deflate comparison flips across engines. Honest note:
the v1 branch is **unreachable today** (0 of 2560 sweep rows, 0 of 5000 random
states). Keep it as a tripwire for a future `PaletteEntry` change; do not mistake
it for what protects the QR. What protects the QR is measured: **v2 never turned
a scannable sheet unscannable** in 2560 sweep rows or 4000 adversarial trials.

**Measured, real prod profiles:**

| build | v1 | v2 | QR v1 → v2 | mm/module v2 |
|---|---|---|---|---|
| 31 cells (377 ch) | 377 | **233** | v16 → v12 | 0.616 |
| 35 cells (401 ch) | 401 | **244** | v16 → v12 | 0.616 |

> **[CORRECTED] on execution — this table is optimistic.** Re-measured against
> the same four prod payloads, using the shipped `toWireV2` rather than an
> estimate:
>
> | cells | JSON v1 → v2 | **payload v1 → v2** | QR | mm/module |
> |---|---|---|---|---|
> | 35 | 3307 → 537 (**84%**) | **401 → 276 (31%)** | v16 → v13 | 0.497 → 0.581 |
> | 31 | 2923 → 501 (**83%**) | **377 → 262 (31%)** | v16 → v13 | 0.497 → 0.581 |
> | 4 | 503 → 292 (42%) | 268 → 197 (26%) | v13 → v11 | 0.581 → 0.655 |
> | 4 | 441 → 146 (67%) | 210 → 136 (35%) | v11 → v9 | 0.655 → 0.750 |
>
> **The gap is the two columns.** Deflate ALREADY exploits the repetition the
> palette removes, so an 84% saving on the raw JSON is worth **31%** once both
> sides are compressed. The drop is **three** QR versions, not four. The
> original table almost certainly compared pre-deflate sizes while labelling
> them payload characters.
>
> Still worth shipping — a third off the payload and 0.497 → 0.581 mm/module —
> but quote 31%, not 40%.

**Headroom correction:** this buys **98-240 cells depending on shape**, NOT 512.
512 cells is unscannable in every shape including the palette's best case
(uniform-512 = 1384 ch = v31 = 0.289 mm). Do not repeat the "to 512" claim.

> **[CORRECTED] again:** the 98-240 figure rests on the same pre-deflate
> arithmetic as the table above and was **not** re-derived. Treat it as unproven
> and re-measure before repeating it.

**Separable free win:** dropping `_doc` is **36-70% of the entire saving** on
real prod builds. `canonicalize()` drops it (`canon.ts:170`) and
`validateEncodedState` defaults it when absent, so removal is hash-invisible.
Ship it alone if item 6 slips.

**Rollout is free:** ship the DECODER first, let Pages propagate, then the
encoder. An open tab hitting a v2 payload before the decoder lands gets
`unsupported-version` — correct, and avoidable at zero cost.

**Academy needs no change and no deploy — verified end to end:** `checkPayload`
accepts any `s=` base64url ≤ `MAX_PAYLOAD_CHARS`; `hex-clusters.ts:98` accepts
any integer `schemaVersion ≥ 1`; the DB CHECK is `>= 1`; and **`schemaVersion` is
written and never read** anywhere in the academy. Update the two doc comments
that will otherwise lie: `save-link.ts:73` and `schema.prisma:1502-1503`.

**REJECTED (round 1 measured each producing a silently WRONG scene from legacy
payloads):** bit-packing, derived caps, derived cap shape/gender, junction
bitmaps, adaptive best-of-N coordinate coders.

### Item 7 — Telemetry

**Not implementable as written — resolve first.** `hex_sheet_opened` fires at
`main.ts:462`, *before* `await import('./export/index.js')`, so `payloadChars`
and `qrVersion` do not exist at that call site. Decide: move the properties to
`hex_sheet_printed`, emit a second event after capture, or delay the first.

Also add an event on the QR-capacity catch (`export/index.ts:436-438`), which
today only `console.error`s into the visitor's own devtools, and `cells` to
`hex_save_started`.

Note the original justification is gone — this existed to fire a deferral
trigger for item 6, which now ships. Re-state the acceptance criterion or cut it.
Consent is opt-in and strict, so a visitor arriving **by printed QR or shared
link is 100% untracked** — precisely the population that hits the ceiling.
Home for tests: `analytics.test.ts`.

### Item 8 — Guard the enum-deletion class

Deleting a `CarrierType` / `BaseType` / `SubSlot` token silently breaks stored
payloads with no `migrate()` case, and nothing in CI catches it. Locally one
build carries `tb-1-power-full`, removed 2026-08-02 — it decodes as `malformed`
and its `/c/` link boots the demo. **Prod is clean (0 of 4), verified.**

Add a test asserting the live unions are a superset of the tokens in a pinned
corpus, so a deletion fails the build. **Freeze the corpus before item 6.**

---

## 3. Verification

Minimum test set for item 6, in decreasing strength — `canonicalize()`
comparison is **necessary but NOT sufficient**, because this transform is made
of paired conventions and a symmetric bug (swap `br`/`ir` in both directions)
round-trips perfectly:

1. **Pinned wire vectors** (asymmetric) — literal v2 JSON string ⇄ literal
   expanded object ⇄ pinned canon string + digest. The ONLY oracle that catches a
   symmetric slot swap. ≥5 cases: empty · palette-of-1 · `cf:false` 8-element
   entry alongside `cf` absent · unsorted `cp` · 7- and 8-tuple spikes.
2. A `canon.fixture.ts` case whose **input is v2-shaped** and whose expected
   canon string still reads `"v":1`, with a digest equal to the v1 case.
3. Deep equality vs the v1 reference across `{forceWire:1,2} × {s=,u=}`.
4. Scene-level equality after restore — canon re-sorts arrays, so it cannot see
   that v2 changes `applyState`'s replay order (`state-url.ts:447`), and caps are
   applied in an order-sensitive second pass.
5. Determinism negative controls: same caps in different click orders → one
   palette entry and an identical payload string; mixed `cf` absent/`true` → one
   entry; same junctions built in different orders → identical `sp`.
6. Malformed v2 → `malformed`, never `unsupported-version`; `v:3` →
   `unsupported-version`; bounds still enforced post-expansion.

**Would otherwise ship unverified:** item 2's printed artifact (the `/Link`
annotation proof is a scratchpad PDF; nothing re-checks it in CI) · item 3's
threshold (`sheet:check` asserts CSS declarations, not caption behaviour, and
nothing measures mm/module) · item 4 (no test named) · item 7.

> **What execution actually added.** Every item above now has coverage except
> the one that genuinely cannot have it in CI:
>
> - item 2: five assertions in `check-sheet.mjs`'s **unsaved** pass (anchor,
>   href contains `#`, `target`, `rel`, label length), plus `.qr-url` in the
>   approved spec and `SELECTOR_MAP` — `sheet:check` went 1987/1987 across 71
>   rules to **2012/2012 across 72**. The reference markup gained an `<a>`, not
>   a `<div>`, so `display: block` cannot be satisfied for free.
> - item 3: `qr.test.ts` cross-checks the reported version against the viewBox
>   of the symbol actually inlined (`V = (width − 19) / 4`), and pins v21/v22
>   either side of the threshold. The quiet zone was measured in a real browser:
>   14 px exactly, 4.14X at v4, masthead unchanged at 193.19 px with **3.8 px**
>   of slack left.
> - item 4: three tests, and the fix was **mutation-checked**.
> - item 7: mostly **cut** — see the item.
> - item 2's printed `/Link` annotation remains the one unverified claim. It
>   still rests on a scratchpad PDF.
>
> **Mutation-checking found a worthless test.** A companion assertion for item 4
> (`not.toBe('capture-failed')`) passed with the fix removed, because the
> un-gated result is `navigating` — which is also not `capture-failed`. It would
> have passed against the bug it existed to catch. Deleted, with the reasoning
> left in the file. Every item-5 fix was then mutation-checked the same way.

---

## 4. Cut — do not re-litigate without new evidence

Anonymous short links + R2 offload · base81 fragment alphabet · QR alphanumeric
uppercase payload · Structured Append (phones do not reassemble it; `qrcode`
cannot emit it) · EC M→L for print · brotli (absent from Chrome's
CompressionStream) · `margin: 1 → 4` · the no-QR fallback · delta-coded
coordinates (measured 0-1%).

---

## 5. Hazards for whoever implements this

- **This document and its evidence must be COMMITTED before anyone starts.**
  §5 tells you to use your own `git worktree` — and a fresh worktree carries no
  untracked files, so following that advice while this plan is untracked
  destroys the plan. Commit `docs/plans/2026-08-06-hex-share-url.md` plus
  `scripts/hex-prod-census.ts` and `scripts/hex-prod-tokens.ts` (renamed off the
  `_` prefix precisely because `.gitignore` `/scripts/_*` was swallowing them).
- **Shared worktree.** Another session created — and later deleted —
  `src/hex/_allparts.local.test.ts` in `c:\zzz\otd\bioscale-viz` during
  validation. It matches vitest's `src/**/*.test.ts` glob, so whether it exists
  changes what `pnpm test` collects. ~~Tracked test files: **21** at branch tip
  (a "22" anywhere is counting that stray).~~ Use your own `git worktree`, and
  diff `<base>..<head>` before merging.

  > **[CORRECTED]: 22 tracked, and no stray.** The 22nd is
  > `src/analytics.test.ts` (tracked since PR #11, depth 1). A
  > `git ls-files 'src/**/*.test.ts'` pathspec silently drops depth-1 files —
  > that is where "21" came from, not from a stray. The shared-worktree warning
  > itself was borne out in the strongest possible way: during execution a
  > concurrent session opened PR #18 and **merged it**, 41 seconds before doing
  > the same to academy PR #451.
- Local `main` (`cc7c390`) is **behind** `origin/main` (`9c8b776`); `local-main`
  (`f7e3488`) is a third stale ref; the `c:\zzz\bioscale-glyph` worktree holds a
  stale `main`.
- `pnpm format:check` is a CI step — autocrlf + prettier can loop.
- `sheet:check` genuinely flakes on CI (30 s Playwright timeout, self-labels
  `HARNESS FAILURE (not a design regression)`, exit 2, no retry). **Re-run before
  debugging.** It passed clean locally: `1987/1987 across 71 rules`.
- project-foundry `feat/hex-parts-pack` has **4 unpushed commits** plus the
  recaptured hero videos. Those clips were shot against the full
  `fix/ghost-wire-audit` build, so **ship them after the bioscale merge** or the
  hero advertises a configurator that is not live. PR #450 is already merged;
  these need a new PR.
