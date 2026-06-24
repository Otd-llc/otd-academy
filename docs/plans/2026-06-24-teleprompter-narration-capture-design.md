# Design — Teleprompter narration during capture (§1)

**Status:** DESIGN / validated in brainstorm, ready for implementation plan.
**Source requirement:** [`docs/plans/2026-06-24-capture-audio-script-pipeline.md`](./2026-06-24-capture-audio-script-pipeline.md) §1.
**Scope:** Show the teacher a script to read/enact while recording a narrated clip — a
teleprompter in the OTD Capture overlay — plus the academy-side data + transport to feed it.

## Locked constraints (do not re-litigate)

- **Human narration only — no AI/TTS.** The teleprompter shows authored text for a human to read.
- **$0 tooling.** No new per-use/subscription cost (this feature adds none).
- **Teleprompter must NOT appear in the recording.** It sits outside the captured crop box.

## Decisions (locked in brainstorm 2026-06-24)

| Decision | Choice |
|---|---|
| Where the script is stored/authored | **Field on the guide `video` block** (rides the existing onSession seam) |
| How the script reaches the overlay | **The app (main process) fetches it via the slot token** from a new academy GET route (not a URL param), then enriches the session payload sent to the overlay |
| Teacher advances the script via | **Manual** — global hotkey + hover scroll-wheel (hands are in KiCad) |
| "This video needs narration" | **Implied** — a non-empty `script` is the signal; empty = silent screencast (today) |

Rationale for transport: a 1–3 min read is ≈ 1,500–4,000 chars (more once URL-encoded). The
deep link arrives as a **Windows argv/registry string** (`main.js` `second-instance` / launch
argv), which has length limits that can silently truncate, and `main.js` writes the parsed deep
link into a debug `.log`. Fetching by token keeps long text out of the URL and the log entirely.

## Existing seam (verified)

- Guide `video` block schema: `src/lib/schemas/guide.ts` (`caption`/`captureHint`/`aspect`).
- `createCaptureSession` returns `{token, kind, hint, caption, aspect}`: `src/lib/actions/guide-images.ts`.
- `CaptureLauncher` packs them into `otd-capture://capture?…`: `src/components/guide/CaptureLauncher.tsx`.
- Overlay `onSession(s)` unpacks them: `capture-app/overlay.js` (~line 140).
- Token verify: `src/lib/capture-token.ts` (`verifyCaptureToken`); precedent GET route:
  `src/app/api/capture/status/route.ts`. Upload route: `src/app/api/capture/route.ts`.
- Deep-link/protocol handling + debug `.log`: `capture-app/main.js`.

## Design

### 1. Data model & authoring (academy)

Add one optional field to the `video` block in `src/lib/schemas/guide.ts`, parallel to `captureHint`:

```ts
// Narration script for this clip. Non-empty ⇒ this video needs human narration:
// the capture overlay shows it as a teleprompter and the mic defaults on.
// Empty/absent ⇒ silent screencast (today's behavior).
script: z.string().max(8000).optional(),
```

- `max(8000)` holds a 3–4 min read with headroom; `caption` stays `max(200)`.
- Optional ⇒ no migration (content blocks are JSON) and every existing
  `guideContentBlocksSchema.parse` call site keeps validating unchanged.
- Authoring: add a multiline `<textarea>` (`maxLength={8000}`) for `script` to the **video block's
  editor** in `src/components/guide/BlockEditor.tsx` — the block that today renders Description
  (`alt`) / Caption / Capture aspect (around lines 572–624). Place it after Caption. Label it
  clearly as "what the teacher reads aloud," distinct from `caption` (on-page text). Same
  `onChange`/save path as the other inputs — no new server action.
  - **Note (validation finding):** `captureHint` is **not** edited in this UI today (only `alt`,
    `caption`, `aspect` are) — it's set via stage-skeleton templates / raw JSON. So the design's
    earlier "next to captureHint" was inaccurate; `script` is the first long author-facing field
    in this editor and sits with Caption/Aspect. (Surfacing `captureHint` here too is optional and
    out of scope.)

### 2. Transport endpoint (academy)

New `GET /api/capture/session?token=…`, mirroring `/api/capture/status`:

```
verifyCaptureToken(token)              // same signed, slot-scoped token
→ load card.contentBlocks, pick block[blockIndex]
→ 200 { kind, hint, caption, aspect, script }   // script: "" when none
→ 401 on bad/expired token
```

- Reuses `verifyCaptureToken` + the same block lookup `createCaptureSession` already does — it is
  effectively the **read half** of that action, exposed for the app to pull after hand-off.
- Holding the token already authorizes that one slot ⇒ no new auth surface.
- Pure read, no side effects ⇒ safe to call on every session open and safe to retry.
- Serves the whole session bundle (not just `script`) so the app can treat the GET as the source
  of truth; the deep-link URL can stay minimal. `createCaptureSession` and `CaptureLauncher` are
  unchanged — the URL params become a harmless fast-path/fallback. The fetch is done in the capture
  app's **main process** (Node fetch — no browser CORS); see §3.

### 3. Fetch in the MAIN process, enrich the payload (capture)

**CORS gate (validation finding):** the app deliberately does its academy HTTP **from the main
process** (Node `fetch`, `upload-capture` IPC) precisely to avoid browser CORS — see
`capture-app/README.md` ("from the main process — no browser CORS") and `main.js` `upload-capture`.
So the overlay **renderer must NOT** `fetch` the academy directly; the script fetch goes in main.

In `capture-app/main.js`, a session is produced from a deep link by `parseDeepLink`. Add an async
`enrichSession(s)`: when `s.token` is present, `fetch(`${s.api}/api/capture/session?token=…`)`
(Node fetch, no CORS), merge `script` (and optionally refresh hint/caption/aspect) into `s`,
return it.

**It must cover ALL THREE deep-link entry points — they are NOT uniform (validation finding):**
- `second-instance` (app already running) → `handleDeepLink`
- `open-url` (macOS) → `handleDeepLink`
- **first-launch argv (cold launch from the lesson "+", the MOST COMMON flow)** → currently
  `pendingSession = parseDeepLink(link)` **directly**, bypassing `handleDeepLink`/`deliverSession`.

So route every path through one async chokepoint, e.g. `async function sessionFromLink(link)
{ const s = parseDeepLink(link); return s ? await enrichSession(s) : s; }`, and then
**`deliverSession(await sessionFromLink(link))`** in all three — including replacing the bare
`pendingSession = parseDeepLink(link)` at first launch with the deliver call. If the enrich fetch
were added only to `handleDeepLink`, the primary cold-launch flow would silently get no script.

**Cold-launch ordering trap:** don't `await` into `pendingSession` and rely on the `did-finish-load`
flush — the flush can fire while the fetch is still pending and read a null `pendingSession`,
losing the session. Always go through `deliverSession` *after* the await: it sends if the overlay
is ready, else stores the already-enriched session for the flush. `deliverSession` stays sync;
only the link-handling wrappers become async. No new IPC channel, no renderer fetch.

**Best-effort:** wrap the enrich fetch in try/catch — a network failure or non-200 must never
block capture. On failure, deliver `s` without `script` (degrades to a silent screencast; the
URL-param hint/caption/aspect still populate). Same defensive posture as the existing `.log`-and-
continue error handling.

Net effect: `overlay.js` `onSession(s)` just reads `s.script` — exactly like `s.caption` today.

### 3b. Overlay teleprompter UI (capture)

- `s.script` non-empty ⇒ render the teleprompter panel. Empty ⇒ behave exactly as today (no
  panel). This is the single enforcement point of the "implied needsNarration" rule.
- **Mic (validation finding):** `overlay.js` already defaults `micEnabled = true`, so "turn the
  mic on for narrated clips" is a no-op — the mic is already on for every clip. Do **not** couple
  script-presence to the mic default; leave the existing behavior alone (changing it would flip
  mic *off* for today's silent screencasts, an unrelated behavior change). Script presence drives
  the *teleprompter only*, not the mic.
- Panel (`overlay.html` + `overlay.js`): large, high-contrast, scrollable text shown in the
  **framing and recording** phases.
- **Manual advance:** scroll wheel while hovering the panel + global hotkeys to page down/up that
  work without focusing the panel (hands are in KiCad), plus a hide/show toggle. **The hotkeys
  MUST be `Ctrl+Shift+` chords** — the existing globals are `Ctrl+Shift+Enter`/`Ctrl+Shift+Backspace`
  precisely because bare Space/Esc/arrow/F keys clobber KiCad (Space = pan) or are Fn-unreliable
  (`README.md`). Do NOT use `↓`/`↑`/`Space`. E.g. `Ctrl+Shift+Down`/`Ctrl+Shift+Up` to page,
  `Ctrl+Shift+H` to hide.
- Reuses the overlay interactivity model — the panel is part of the on-top overlay window,
  hit-tested via `setInteractive` like the other panels.

### 4. Frame-safety — already handled by content protection (validation finding)

The recording is `getDisplayMedia` of the **whole primary screen** (`overlay.js` ~line 363; source
auto-picked in `main.js`), and the overlay window has `overlay.setContentProtection(true)`
(`main.js`). Content protection excludes the **entire overlay window** from screen capture — which
is exactly how the framing box + dim are already kept out of the shot (`README.md`: "confirm the
box/dim are NOT in the uploaded shot"). A teleprompter panel lives in that same overlay window, so
it is **frame-safe regardless of position** — no box-tracking, no docking logic required.

- Panel position is therefore a **usability** choice, not a frame-safety one: place it where it
  doesn't visually cover the KiCad work area / the framing box (e.g. a screen edge), so the teacher
  can both read and see their work. Movable is nice-to-have, not required for v1.
- **Manual verification (Josh), belt-and-suspenders:** record one throwaway narrated clip with the
  teleprompter up and confirm it's absent from the output — the same content-protection check the
  README already prescribes for the box. The agent cannot see the GUI, so this is the manual gate.

### 5. Writing the scripts (content task — separate track)

Pure content. Inventory every `video` slot needing narration in the built curriculum (today
mainly **L1.01** guide cards) and write one script per slot in OTD house voice via the
`otd-content-writing` skill, honoring the academy disclosure boundary (generic education only).
Long pole, but decoupled: it just fills the new `script` field in BlockEditor. Can run in parallel
with or after the code.

## Surface summary

`+1` schema field · `+1` GET route · `+1` BlockEditor input · `+1` main-process session-enrich
fetch · `+1` overlay panel (manual scroll) · `+1` manual out-of-frame check · `+` the content task.
**No migration, no new auth, no new IPC channel, no renderer-side network, no change to
`createCaptureSession`/upload.**

## Validation pass (2026-06-24)

### Pass 1 — three material corrections folded in:

1. **CORS.** Original draft had the overlay *renderer* `fetch` the academy. The app deliberately
   does academy HTTP from the **main process** (`README.md`: "from the main process — no browser
   CORS"; `main.js` `upload-capture`). Fix: fetch the script in main, enrich the `capture:session`
   payload (§3). No renderer network.
2. **Frame-safety.** Original draft required the panel to track/avoid the crop box. But the overlay
   window is `setContentProtection(true)` and capture is whole-screen `getDisplayMedia`, so the
   panel is excluded from the recording **anywhere** — same mechanism that already hides the box
   (§4). Box-tracking removed; position is usability only.
3. **Hotkeys.** Original draft used `↓`/`↑`/`Space` for scroll — those clobber KiCad (Space = pan).
   The app's global keys are `Ctrl+Shift+` chords for that reason (`README.md`). Fix: teleprompter
   scroll uses `Ctrl+Shift+` chords (§3b).

Also confirmed safe-as-drafted: the slot token already carries `cardId`/`blockIndex`/`kind`
(`/api/capture` + `/api/capture/status` both use them), so the new GET route adds no auth surface;
and `script` being optional means no Prisma migration (content blocks are JSON).

### Pass 2 — three more, deeper in the call graph:

4. **Enrich must cover the first-launch argv path (highest-severity).** The three deep-link entry
   points aren't uniform: `second-instance` + `open-url` go through `handleDeepLink`, but the
   **cold-launch** path (the most common: app not running, user clicks "+") does
   `pendingSession = parseDeepLink(link)` **directly** (`main.js` ~line 297). Adding the fetch only
   to `handleDeepLink` would silently skip the script on the primary flow. Fix: one async
   `sessionFromLink` chokepoint used by all three, `deliverSession` after the await — plus a noted
   cold-launch ordering trap (don't leave an un-flushed `pendingSession` while the fetch is pending)
   (§3).
5. **Mic default is already `true`.** "Default the mic ON for narrated clips" was a no-op; coupling
   script→mic would have flipped mic *off* for existing silent screencasts. Decoupled — script
   drives the teleprompter only (§3b).
6. **`captureHint` isn't in the BlockEditor UI.** The video editor exposes only `alt`/`caption`/
   `aspect`, so "add the textarea next to captureHint" was inaccurate; `script` sits with
   Caption/Aspect (§1).

Confirmed safe in pass 2: content protection covers the whole overlay window (so §4's frame-safety
holds); the GET route is a pure read so calling it on every cold launch is harmless; `script`
travels only via the token-fetched bundle, never the URL/`.log`, so the Windows arg-length concern
is fully retired.

## Out of scope (deferred to sibling handoff items)

- Studio-audio export/replace WAV (§2), editable audio timeline (§3), captions/transcript STT
  (§5), capture-app repo split (§4) — see the source handoff doc.
