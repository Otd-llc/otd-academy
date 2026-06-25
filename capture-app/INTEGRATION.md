# OTD Capture ⇄ Academy — integration contract

The wire contract between the **OTD Capture** desktop app (`capture-app/`) and the
**academy** (`src/`). Pinned here so the eventual repo split (design §4) carries the
boundary with it. Three surfaces: the deep link in, the session read, and the upload
out. All three are **token-gated** by the same slot-scoped HMAC token — no cookie,
no session.

## The token

Minted by `createCaptureSession` (admin-only) in
[`src/lib/actions/guide-images.ts`](../src/lib/actions/guide-images.ts), signed/verified
by [`src/lib/capture-token.ts`](../src/lib/capture-token.ts).

- HMAC-SHA256 over a tiny JSON payload with the academy's `AUTH_SECRET`.
- Claims: `{ cardId, blockIndex, kind: "image" | "video", exp }`.
- TTL **4 hours** (a multi-clip record/retake/stitch session runs long; the token
  only authorizes writing one block).
- Format: `base64url(payload).base64url(sig)`.

## 1. Deep link IN — `otd-capture://`

The lesson **+** opens:

```
otd-capture://capture?api=‹academyOrigin›&token=‹token›&kind=‹image|video›&hint=‹…›&caption=‹…›&aspect=‹16:10|16:9|4:3|1:1|free›
```

Parsed by `parseDeepLink` in [`main.js`](./main.js). The short metadata
(`hint`/`caption`/`aspect`) rides the URL for an instant first paint. The narration
**`script` does NOT ride the URL** — it's too long and would leak into OS/shell logs;
it's fetched in step 2.

Three entry points, all funneled through `sessionFromLink` → `enrichSession`:
- **cold launch** (app not running) — Windows passes the URL in `process.argv`; the
  `whenReady` handler `await`s the enrich and sets `pendingSession` **before**
  `createOverlay()` (preserves the "queue before the window loads" invariant).
- **second-instance** (app running, Windows) and **open-url** (macOS) — both call the
  async `handleDeepLink`, which enriches then `deliverSession`s to the live overlay.

## 2. Session read — `GET ‹api›/api/capture/session?token=‹token›`

Served by [`src/app/api/capture/session/route.ts`](../src/app/api/capture/session/route.ts).
Called by `enrichSession` in [`main.js`](./main.js) from the **main process** (Node
fetch — no renderer/CORS) right after the deep-link hand-off, to pull the slot's
authoritative metadata, crucially the narration `script`.

**Request:** `GET` with the slot token in the `token` query param. No body, no cookie.

**Responses:**

| Status | When | Body |
| --- | --- | --- |
| `400` | no `token` | `{ error }` |
| `401` | bad/expired token | `{ error }` |
| `200` | valid token | `{ kind, hint, caption, aspect, script }` |

On `200`, every field is always present:
- `kind` — `"image" | "video"` (from the token claims).
- `hint`, `caption` — strings, `""` if unset on the block.
- `aspect` — the block's aspect, else the kind default (`16:9` video / `16:10` image).
- `script` — the narration script, **`""` when absent** or for an `image` block.

Best-effort on the app side: any non-200, network error, or missing field leaves the
session as-is and capture proceeds as a **silent clip** (no teleprompter). The app
logs `session enrich ok: hasScript=‹bool›` and **never logs the script body**.

### Teleprompter (the `script` payoff)

A non-empty `script` marks the clip as needing narration. The overlay shows it as a
bottom-band **teleprompter** in the framing section (visible through framing AND
recording, hidden at review). It's excluded from the recording automatically by the
overlay window's `setContentProtection(true)` — same mechanism that hides the crop
box. The panel is `pointer-events: none` (click-through, never steals a click from
KiCad); scroll/hide is **hotkey-only**:

- `Ctrl+Shift+Down` / `Ctrl+Shift+Up` — page the script down/up.
- `Ctrl+Shift+H` — hide/show the panel.

These are `globalShortcut`s registered in `main.js` (in the `arm-space`/`disarm-space`
lifecycle, alongside the trigger/cancel/follow chords) and forwarded to the overlay
over IPC — **not** renderer keydowns, because the overlay is unfocused (hands in
KiCad) while recording. The mic is unaffected (`micEnabled` already defaults on).

## 3. Upload OUT — `POST ‹api›/api/capture?token=‹token›&ext=‹ext›`

Served by [`src/app/api/capture/route.ts`](../src/app/api/capture/route.ts), called by
the `upload-capture` IPC handler in [`main.js`](./main.js) (main process, Node fetch).

- Body: raw bytes. `Content-Type`: `image/webp` / `video/mp4` / `video/webm` by `ext`.
- Optional `x-caption` header (URL-encoded).
- `redirect: "manual"` — a 3xx (auth/middleware) is treated as failure, never success.
- Success: `200` `{ src }`; the academy stored the blob in R2 and pointed the block at
  `/api/shot/‹id›.‹ext›`.

## Ordering note

The app depends on **2** existing. Deploy/run the academy with
`GET /api/capture/session` **before** pointing the app at it; a premature call
degrades to no-teleprompter (silent clip), never a crash.
