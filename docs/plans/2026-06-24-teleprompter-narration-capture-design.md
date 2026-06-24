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
- Authoring: add a multiline `<textarea>` for `script` to the video block's editor in
  `src/components/guide/BlockEditor.tsx`, next to `captureHint`/`aspect`. Label it clearly as
  "what the teacher reads aloud," distinct from `caption` (on-page text) and `captureHint` (shot
  instruction). Same save path as other block fields — no new server action.

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

In `capture-app/main.js`, the session is built by `parseDeepLink` and pushed to the renderer via
`deliverSession` → `webContents.send("capture:session", s)`. Enrich there: when `s.token` is
present, `fetch(`${s.api}/api/capture/session?token=…`)` (Node fetch, no CORS), merge `script`
(and optionally refresh hint/caption/aspect) into `s`, **then** deliver. Make
`deliverSession`/`handleDeepLink` async; the `pendingSession` (overlay-not-ready) path stores the
already-enriched session, so the existing `did-finish-load` flush is unchanged. No new IPC channel,
no renderer fetch.

**Best-effort:** wrap the enrich fetch in try/catch — a network failure or non-200 must never
block capture. On failure, deliver `s` without `script` (degrades to a silent screencast; the
URL-param hint/caption/aspect still populate). Same defensive posture as the existing `.log`-and-
continue error handling.

Net effect: `overlay.js` `onSession(s)` just reads `s.script` — exactly like `s.caption` today.

### 3b. Overlay teleprompter UI (capture)

- `s.script` non-empty ⇒ render the teleprompter panel + default the mic toggle ON (still
  operator-overridable). Empty ⇒ behave exactly as today. This is the single enforcement point
  of the "implied needsNarration" rule.
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

## Validation pass (2026-06-24) — findings folded in

Checked the design against the real code; three material corrections were made:

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

## Out of scope (deferred to sibling handoff items)

- Studio-audio export/replace WAV (§2), editable audio timeline (§3), captions/transcript STT
  (§5), capture-app repo split (§4) — see the source handoff doc.
