# OTD Capture ⇄ Academy — integration contract

The wire contract between the **OTD Capture** desktop app (`capture-app/`) and the
**academy** (`src/`). Pinned here so the eventual repo split (design §4) carries the
boundary with it. Three surfaces: the deep link in, the session read, and the upload
out. All three are **token-gated** by the same slot-scoped HMAC token (no cookie,
no session).

The app now records the screen **silent** and narration happens **after the fact in
Kdenlive**. The teleprompter is no longer painted into the recording: it is a separate
always-on-top window you read from while you narrate in Kdenlive. The finished
Kdenlive export is uploaded into the slot through the same upload contract. See
[`../docs/plans/2026-06-24-capture-postnarration-pivot-design.md`](../docs/plans/2026-06-24-capture-postnarration-pivot-design.md)
for the why.

## The token

Minted by `createCaptureSession` (admin-only) in
[`src/lib/actions/guide-images.ts`](../src/lib/actions/guide-images.ts), signed/verified
by [`src/lib/capture-token.ts`](../src/lib/capture-token.ts).

- HMAC-SHA256 over a tiny JSON payload with the academy's `AUTH_SECRET`.
- Claims: `{ cardId, blockIndex, kind: "image" | "video", exp }`.
- TTL **4 hours** (long enough to record the silent clip, narrate it in Kdenlive, and
  upload the export; the token only authorizes writing one block).
- Format: `base64url(payload).base64url(sig)`.

## 1. Deep link IN — `otd-capture://`

The lesson **+** opens:

```
otd-capture://capture?api=‹academyOrigin›&token=‹token›&kind=‹image|video›&hint=‹…›&caption=‹…›&aspect=‹16:10|16:9|4:3|1:1|free›
```

Parsed by `parseDeepLink` in [`main.js`](./main.js). The short metadata
(`hint`/`caption`/`aspect`) rides the URL for an instant first paint. The narration
**`script` does NOT ride the URL**: it is too long and would leak into OS/shell logs.
It is fetched in step 2.

Three entry points, all funneled through `sessionFromLink` → `enrichSession`:
- **cold launch** (app not running): Windows passes the URL in `process.argv`; the
  `whenReady` handler `await`s the enrich, sets `pendingSession` **before**
  `createOverlay()` (preserves the "queue before the window loads" invariant), and
  calls `setTeleprompterScript(...)` so a freshly-launched lesson "+" loads its script
  into the teleprompter window.
- **second-instance** (app running, Windows) and **open-url** (macOS): both call the
  async `handleDeepLink`, which enriches then `deliverSession`s to the live overlay.
  `deliverSession` also calls `setTeleprompterScript(s.script || "")`.

## 2. Session read — `GET ‹api›/api/capture/session?token=‹token›`

Served by [`src/app/api/capture/session/route.ts`](../src/app/api/capture/session/route.ts).
Called by `enrichSession` in [`main.js`](./main.js) from the **main process** (Node
fetch, no renderer/CORS) right after the deep-link hand-off, to pull the slot's
authoritative metadata, crucially the narration `script`.

**Request:** `GET` with the slot token in the `token` query param. No body, no cookie.

**Responses:**

| Status | When | Body |
| --- | --- | --- |
| `400` | no `token` | `{ error }` |
| `401` | bad/expired token | `{ error }` |
| `200` | valid token | `{ kind, hint, caption, aspect, script }` |

On `200`, every field is always present:
- `kind`: `"image" | "video"` (from the token claims).
- `hint`, `caption`: strings, `""` if unset on the block.
- `aspect`: the block's aspect, else the kind default (`16:9` video / `16:10` image).
- `script`: the narration script, **`""` when absent** or for an `image` block.

Best-effort on the app side: any non-200, network error, or missing field leaves the
session as-is and capture proceeds with an empty teleprompter (a silent clip with no
script). The app logs `session enrich ok: hasScript=‹bool›` and **never logs the script
body**.

### The teleprompter window (the `script` payoff)

The `script` no longer paints into the recording. It loads into a **separate, standalone
window** in the same Electron app, created by `createTeleprompter()` in
[`main.js`](./main.js) and rendered by [`teleprompter.html`](./teleprompter.html). It is
deliberately the opposite of the recorder overlay:

- **Not content-protected and not click-through.** It never overlaps the recording: it
  floats over **Kdenlive** while you narrate in post. So it behaves like any window: you
  move it with the **drag bar** across the top (`#bar`, `-webkit-app-region: drag`), resize
  it, push it to a second monitor.
- **Natively scrollable.** The script sits in a no-drag `#doc` region with `overflow-y:
  auto`, so the wheel, the arrow keys, and PageUp/PageDown all scroll it. No hotkey paging,
  no IPC-forwarded scroll.
- **Always-on-top**, `setAlwaysOnTop(true, "screen-saver")` + `setVisibleOnAllWorkspaces`,
  so it stays above Kdenlive.
- **Toggle on/off** with the global hotkey **`Ctrl+Shift+H`** (registered once in
  `app.whenReady`, not in the arm/disarm lifecycle). Hidden by default; created lazily.
- **Pre-loaded with the slot's script.** `setTeleprompterScript(text)` remembers the
  latest script in `lastScript` and sends it over the `teleprompter:script` IPC channel;
  the renderer subscribes via the `onTeleprompterScript` preload bridge in
  [`preload.js`](./preload.js). A late-opened window also picks up `lastScript` on its
  `did-finish-load`. If there is no script the window shows a short empty-state note.
- **Pronunciation / format markup.** The script may contain `{TERM|pronunciation}` tokens;
  the window renders `TERM` (bright) followed by a small gold pronunciation cue (e.g.
  `{VOUT|vee-out}` shows "VOUT (vee-out)"), so the reader says it right and never reads the
  cue aloud. Newlines in the script become line breaks (`white-space: pre-wrap`), so scripts
  are written one short phrase per line for read-aloud cadence. The cue is parsed with DOM
  nodes (not `innerHTML`), so the script text is never interpreted as markup beyond the
  `{…|…}` form. The authoring textarea (`MediaEditor`) shows the raw markup; only the
  teleprompter renders it.

There is no longer any in-overlay teleprompter panel and no `Ctrl+Shift+Down`/`Up`
scroll chord. The mic, the `save-audio`/`mux-audio` IPC handlers, and the editor's audio
lane have all been removed (design "Removed"): the recorder produces a **silent** clip.

## 3. Upload OUT — `POST ‹api›/api/capture?token=‹token›&ext=‹ext›`

Served by [`src/app/api/capture/route.ts`](../src/app/api/capture/route.ts). The token in
the query scopes the write to one guide block; the body is the raw blob. There are now
**two callers**, both in the main process (Node fetch, no browser CORS):

1. `upload-capture`: uploads the in-app capture. For a video slot this is the
   **silent** screen clip (after any trim/reorder/speed edit). For an image slot it is
   the screenshot.
2. `upload-file`: the **post-narration** verb. After you narrate + export in Kdenlive,
   you pick that finished file and it is POSTed to the same endpoint. It is wired to the
   "Upload a finished video to this slot" button (`#uploadFileBtn` in
   [`overlay.html`](./overlay.html)), shown only in a deep-link session (there is no slot
   to target in standalone mode). The handler opens a native file picker
   (`dialog.showOpenDialog`, filtered to `mp4`/`webm`), derives `ext` from the
   chosen file, and uploads.

Contract for both:

- Body: raw bytes. `Content-Type`: `image/webp` / `video/webm` / `video/mp4` by `ext`.
- Optional `x-caption` header (URL-encoded), set by the `upload-capture` path.
- `redirect: "manual"`: a 3xx (auth/middleware) is treated as failure, never success.
- Success: `200` `{ ok: true, src }`; the academy stored the blob in R2 and pointed the
  block at `/api/shot/‹id›.‹ext›`.

**Accepted `ext`:** the route's `MIME` map accepts only `webp`, `webm`, and `mp4`, and
`ALLOWED` further restricts a **video** token to `webm` or `mp4` (an **image** token to
`webp`). The `upload-file` picker is filtered to `mp4`/`webm` to match; **export mp4 from
Kdenlive** (the recommended default).

## The end-to-end workflow

1. Click the lesson **+**. The recorder window opens. The teleprompter window is created
   with the slot's script loaded; press **`Ctrl+Shift+H`** to show it (and again to hide
   it).
2. **Record the silent clip.** The app records the screen (no audio) and produces the
   video; in-app trim/reorder/speed editing is still available. The clip is silent: there
   is no mic UI and no audio track.
3. **Open that clip in Kdenlive.** Toggle the teleprompter on (`Ctrl+Shift+H`), read the
   script onto Kdenlive's timeline as a voiceover, adjust levels/retakes, and **export an
   mp4**. The teleprompter floats over Kdenlive and scrolls with the wheel/arrows.
4. **Back in the Electron app, click "Upload a finished video to this slot."** Pick the
   Kdenlive export; it POSTs to the same token-scoped `/api/capture`. The narrated export
   lands in the exact placeholder.

The slot binding stays intact end to end (the 4-hour capture token easily covers a few
minutes of narration in Kdenlive). No new academy upload UI, no browser round-trip.

## Ordering note

The app depends on **2** existing. Deploy/run the academy with
`GET /api/capture/session` **before** pointing the app at it; a premature call
degrades to an empty teleprompter (silent clip with no script), never a crash.
