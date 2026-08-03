# Embedded hex configurator on `/hex` — implementation plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement
> this plan task-by-task.

**Goal:** Open the hex configurator inside `/hex`, expanding from the CTA, with
the academy chrome intact and saving working in place — no cross-subdomain
bouncing.

**Architecture:** The configurator stays a separate deploy and a real standalone
page. The academy frames it and talks to it over a pinned `postMessage` channel.
Saving is delegated to the parent, which already holds the session. Auth is
discovered lazily at save time so `/hex` stays static, and sign-in runs in a
popup so the frame and the in-progress build survive it.

**Tech stack:** Next 16 App Router, Vite + three.js, `postMessage`, the existing
`saveHexCluster` server action.

---

## 0. Status: v1 was validated and largely rejected

v1 of this plan was reviewed by four independent lenses (security, mobile/iOS,
codebase fidelity, adversarial completeness). They returned 11 critical and 14
high findings. Four of v1's code blocks referenced functions, variables and CSS
selectors **that do not exist**. This document is re-derived against verified
code; every API below was read, not recalled.

The three findings that changed the design rather than the code are answered in
§3. Read that before any task.

---

## 1. Why this exists

Saving today is three navigations across two origins: the user leaves the
academy, the academy hands them back, and they leave again. Every hop carries
the whole build in a URL fragment because the two origins share no session.

Framed, it is a message, a server action, and a message back.

**What must not break:**

- `demo.onethousanddrones.com/hex` stays a working standalone page. Printed
  build sheets carry QR codes pointing at it; paper cannot be re-issued.
- The register semantics: drawing number, revision, and the content-hash
  identity that decides whether a sheet prints as controlled.
- `/hex` stays statically prerendered. It is the URL every published
  `LICENSE.txt` cites.

---

## 2. Verified constraints

Read from source, with line numbers, 2026-08-03.

| Fact | Where |
| --- | --- |
| Identity store is **content-keyed** on a bare 64-hex canon hash; `rememberIdentity(hash, entry)` is what makes a sheet print as controlled | `bioscale-viz/src/hex/identity.ts:194`, `:214`, consumed `src/hex/export/index.ts:359` |
| `writeLineage` takes `{shareCode, drawingLabel}` ONLY — it is not the identity write | `identity.ts:63-66`, `:158` |
| `beginSave` already computes the bare canon hash before wrapping it | `src/hex/save-link.ts:135-137` (`payloadHash(await canonHash(captured.state))`) |
| `beginSave`'s callers **discard the result** (`void`), so widening its return type is a compile-time no-op | `src/hex/export/index.ts:186`, `:190` |
| `SaveEnvelope.n` is OPTIONAL | `save-link.ts:91` |
| `SaveSignInGate` does a **top-level** `window.location.replace` | `project-foundry/src/components/hex/SaveSignInGate.tsx:46` |
| `SaveHexClusterForm` takes `{mode, share}` only; the envelope comes from `location.hash` or a localStorage stash; it has TWO navigation exits and renders a full page | `SaveHexClusterForm.tsx:93-99`, `:103-160`, `:204`, `:246`, `:252-257` |
| `requireUser()` **throws**; `saveHexCluster` has eight failure codes | `src/lib/auth-helpers.ts:8-16`; `src/lib/actions/hex-clusters.ts` |
| `input.share` reaches Prisma unvalidated at runtime | `src/lib/actions/hex-clusters.ts:137-140` |
| The cluster cap is **terminal** — 200, no hard delete in v1 | `src/lib/hex-cluster.ts:77`; `actions/hex-clusters.ts:264-269` |
| The academy sets `frame-ancestors` on `/embed/*` ONLY; every other route keeps the browser default | `next.config.ts:47-58` |
| `/hex` is fully prerendered; there is no `SessionProvider`/`useSession` anywhere in the academy | `src/app/(chrome)/hex/page.tsx:36`; grep |
| Configurator brand chrome is `#header > a.brand-link` with `.brand-line`, `.page-title` — NOT `.hex-brand` | `bioscale-viz/hex.html:68-72`; `src/styles/header.css` |
| `#webgl` already sets `touch-action: none`; page sets `user-scalable=no` | `src/styles/base.css:41`; `hex.html:25` |
| No `webglcontextlost` handling anywhere; PMREM env baked once at import | grep; `src/hex/scene.ts:67-68` |
| Child scrollers have no `overscroll-behavior` containment | `inspector.css:223`, `:805`; `export.css:79`, `:137` |
| `ConfiguratorLink`'s own handler calls `preventDefault` then `location.assign` unconditionally | `src/components/hex/ConfiguratorLink.tsx:74`, `:93` |
| `ph_did` is resolved ASYNC, after `await getPosthog()` | `ConfiguratorLink.tsx:79` |
| bioscale-viz deploys on push to `main` only — no preview deploys | `.github/workflows/deploy.yml` |
| Vite dev server defaults to port 3000, colliding with `next dev` | `bioscale-viz/vite.config.ts` |
| The established kill-switch pattern is Edge Config, request-time, fail-safe | `src/lib/abuse-defense-flag.ts:14` |

**Storage partitioning is NOT a production problem.** `demo.` and `academy.`
share a registrable domain, so Safari treats the frame as first-party. It bites
only when framing from `localhost` or `*.vercel.app` — which is a testing
problem, handled in Task 1.

---

## 3. The three problems that nearly sank v1, and their answers

### 3.1 Removing the navigation removes the payload-matches-scene guarantee

`adoptReturnLink` compares the link's hash against the live scene, because
"without the `h=` comparison the value being checked is the value being
written" (`identity.ts:257-262`). That works standalone only because
`location.assign` tears the page down: nothing can edit during a teardown.

Framed, nothing tears down. The user can keep placing cells while the save panel
is open, and a naive adopt stamps a drawing number onto geometry the register
has never seen.

**The answer is not to lock the scene. It is to key the identity on the hash of
what was actually saved.** `rememberIdentity` is content-keyed, and the child
already has the bare canon hash at `save-link.ts:135` — it never needs to cross
the wire.

So: the child stashes the canon hash it captured when it sent the request, and
on `saved` calls `rememberIdentity(stashedHash, entry)`. If the user edited
meanwhile, the current scene's hash no longer matches and the sheet correctly
prints UNCONTROLLED; undo back to the saved state and it correctly prints the
number. The store does the reasoning for us.

This is strictly better than v1's proposal AND better than locking the UI.

### 3.2 Sign-in destroys the frame

`SaveSignInGate` does a top-level `window.location.replace`, which unmounts the
iframe and discards the scene, the undo stack and the envelope. v1 claimed "the
envelope is held in React state, so nothing has to survive a fragment round
trip" — exactly wrong. The localStorage stash is the ONLY thing that survives,
and v1 removed the reason for it. OAuth additionally refuses to render in a
frame at all.

**Answer: sign-in runs in a popup, with the existing flow as the fallback.**

- Parent opens `window.open('/sign-in?callbackUrl=…')`. A popup is a top-level
  context, so OAuth works and the frame is untouched.
- Parent polls `/api/auth/session` until authenticated or the popup closes.
- **The stash is still written before opening the popup.** If the user completes
  a magic link on another device, or the popup is blocked, the existing
  standalone recovery path still works. It is a fallback, not dead code.

### 3.3 `/hex` cannot know whether the user is signed in

No `SessionProvider`, no `useSession`, and the page is deliberately static.

**Answer: do not ask. Discover auth lazily at save time.** The parent attempts
the save; `requireUser()` throws on an anonymous caller; the panel catches that
and opens the sign-in popup. `/hex` stays prerendered, no session read at
render, no loading state for auth, and one less thing to keep in sync.

---

## 4. Non-negotiables carried from the review

Every task below must respect these. They are listed once so they are not
re-litigated per task.

1. **Pin the peer, do not pattern-match it.** The parent accepts messages only
   when `ev.source === iframeRef.current.contentWindow` AND `ev.origin` equals a
   single constant child origin. The child replies only to an origin captured
   from the parent's `ready` handshake. No family regex, no `*`, no
   `document.referrer` dependency, and `localhost` only when
   `NODE_ENV !== "production"`.
2. **`parseMessage` validates, it does not cast.** Every field, every type. A
   non-string `share` must never reach Prisma — `input.share` is a live filter
   injection today (`actions/hex-clusters.ts:137-140`), and the message channel
   would be the first way a non-string gets there. Re-validate `mode` and
   `share` inside `saveHexCluster` as well; it is now reachable from a channel
   the page does not control.
3. **No message performs a write.** A `save-request` may only open a panel. The
   write is gated on a click in the academy's own DOM. State this as a non-goal
   so an executor reading the summary does not build the auto-run version.
4. **The protocol carries `protocolVersion` and a `requestId`.** Two repos
   deploy independently; an unknown version falls back to navigation rather than
   dropping messages silently. A `saved` whose `requestId` does not match the
   in-flight request is ignored.
5. **`save-failed` exists.** Eight failure codes plus a throwing `requireUser`
   plus a user who closes the panel. The child needs a timeout that restores its
   Save control regardless.
6. **The academy gets `frame-ancestors` too, before the frame ships.** The
   parent holds the session and the write; today it is framable by anyone. With
   auto-open, `evil.test` can frame `/hex?build=…` and harvest clicks against a
   terminal 200-cluster cap.

---

## Task 1: Make it testable, then probe on a real phone

v1's probe could not have worked: `/sandbox/*` is not in `isPublicPath`, so it
307s to `/sign-in` signed-out and reads as "the frame is broken". And nothing in
v1 let the two sides run locally at once — Vite and Next both default to 3000,
bioscale has no preview deploys, and Task 8's allow-list excluded every dev
origin.

**Files:**
- Create: `src/app/(chrome)/sandbox/hex-embed-probe/page.tsx`
- Modify: `bioscale-viz/vite.config.ts` (move dev server off 3000)
- Modify: `src/env.ts` (add `NEXT_PUBLIC_HEX_CONFIGURATOR_URL`, optional)

**Steps:**

1. Move the Vite dev port to 5180. Two dev servers must coexist.
2. Add `NEXT_PUBLIC_HEX_CONFIGURATOR_URL`, defaulting to the production demo, so
   the frame can be pointed at a local Vite build. Without this, every
   configurator-side task can only be tested after it is in production.
3. Build the probe. Sign-in is required to reach it; that is fine as long as it
   is known — put it in the page comment so a blank frame is not misdiagnosed.
4. Probe on a **real handset** over the LAN, not DevTools device mode. Confirm
   and record here: sizing with the URL bar collapsing; one-finger drag orbits
   and does not scroll the parent; pinch on a NON-canvas part of the child;
   **background the tab for 30s and return** (this is the WebGL context-loss
   trigger, and v1's checklist missed it); export the sheet and **print**;
   the Back button.

**Commit:** `spike(hex): make the embed testable locally, probe it on a phone`

---

## Task 2: The protocol

**Files:**
- Create: `src/lib/hex-embed-protocol.ts`, `bioscale-viz/src/hex/embed-protocol.ts`
- Test: `src/lib/__tests__/hex-embed-protocol.test.ts`

Message set: `ready` (parent → child, carries theme and the parent origin),
`save-request`, `saved`, `save-failed`, `save-cancelled`, `close-request`
(child → parent, so Escape works), `set-theme`, `context-lost`.

`set-theme` and `context-lost` are defined HERE, not bolted on in a later task —
v1 referenced a `set-theme` that Task 2 never declared.

Every message carries `protocolVersion` and, where it is part of a save,
`requestId`.

Tests must cover: the rejection table for origins (including
`onethousanddrones.com.evil.test` and `evil-onethousanddrones.com`), and that
`parseMessage` returns null for a non-string `share`, a bad `mode`, and a
non-string envelope field.

**Commit:** `feat(hex): define the embed message protocol`

---

## Task 3: The configurator delegates saving

**Files:**
- Create: `bioscale-viz/src/hex/embed.ts`
- Modify: `bioscale-viz/src/hex/save-link.ts`, `src/hex/export/index.ts`

Key points, all of which v1 got wrong:

- **Hoist the envelope literal.** There is no `envelopeObject` at
  `save-link.ts:135`; the literal goes straight into `encodeSaveEnvelope`.
  Hoist it, and handle `n` being optional.
- **Stash the bare canon hash** alongside the pending request. This is what §3.1
  turns on.
- **The callers must consume the result.** `export/index.ts:186,190` are
  `void beginSave(...)`. Widening the return type changes nothing on its own.
  Give the Save control a pending state, or `save-cancelled` and `save-failed`
  have nothing to re-enable.
- **The fallback must navigate the TOP window,** not the frame. v1's fallback
  loaded the academy save page *inside* the iframe.

**Commit:** `feat(hex): delegate save to the parent when embedded`

---

## Task 4: The configurator adopts the identity

**Files:**
- Modify: `bioscale-viz/src/hex/main.ts`

On `saved`, matching `requestId`:

```ts
// Keyed on the hash captured when the request was SENT, not the scene as it
// stands now. The user can keep building while the panel is open, and the
// identity store is content-keyed, so attaching the number to the saved
// geometry makes an edited scene correctly print UNCONTROLLED and a scene
// undone back to the saved state correctly print the number.
rememberIdentity(pending.canonHash, {
    drawingLabel: msg.drawingLabel,
    revLabel: msg.revLabel,
    shareCode: msg.shareCode,
    name: msg.name,
    savedAt: msg.savedAt,
    touchedAt: Date.now(),
});
writeLineage({ shareCode: msg.shareCode, drawingLabel: msg.drawingLabel });
```

Both writes. v1 called only `writeLineage`, with the wrong shape, which is why
its own verification step could never have passed. Apply the same format guards
`adoptReturnLink` uses (`identity.ts:250-253`) before writing.

**Commit:** `feat(hex): adopt a parent-saved identity in place`

---

## Task 5: The frame

**Files:**
- Create: `src/components/hex/HexConfiguratorFrame.tsx`
- Modify: `src/components/hex/ConfiguratorLink.tsx` (add an `onActivate` seam)
- Modify: `src/app/(chrome)/hex/page.tsx`

- **`ConfiguratorLink` needs a seam.** Wrapping it does not work: its own
  handler runs first and unconditionally navigates. Add
  `onActivate?: () => boolean`; returning true suppresses the navigation while
  keeping `trackCtaClicked` and the `ph_did` resolution.
- **Mount the iframe at final size** and animate a wrapper's `clip-path`. A
  `transform: scale()` never changes the iframe's layout box, so the child never
  fires `resize` and renders at the button's aspect ratio. `startViewTransition`
  snapshots a canvas with no `preserveDrawingBuffer` — a black box inflating.
- **`allow="fullscreen; clipboard-write; web-share"`.** Without `web-share` the
  child's share chain falls through to `window.prompt`, which Chrome ignores in
  cross-origin frames entirely.
- **`sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-modals allow-forms"`.**
  v1's reason for omitting it was wrong: `allow-same-origin` restores the
  *child's* origin, not the parent's. What omission actually grants is
  `allow-top-navigation` — the framed app could navigate the academy anywhere.
- **Size from a measured header**, not a constant. The academy header wraps to
  two rows on mobile and is taller for admins. Reuse the measured-header pattern
  at `IslandRail.tsx:92-100`. Subtract `env(safe-area-inset-bottom)`.
- **`100dvh`, with the child coalescing resize into rAF** and skipping `setSize`
  under ~2px. `svh` leaves a dead strip under a scroll-locked page; raw `dvh`
  reallocates the drawing buffer on every toolbar transition, which is itself a
  context-loss trigger.
- **Body lock is `position: fixed; top: -scrollY`,** not `overflow: hidden`,
  which iOS still rubber-bands.
- **Escape cannot be trapped cross-origin.** The child posts `close-request`;
  the parent's visible close control is the guaranteed exit. Use `inert` on the
  rest of the document rather than a focus trap that cannot enumerate the child.
- **Resolve `ph_did` BEFORE setting `src`.** It is async, and on the auto-open
  path there is no click to resolve it during — so the child would get no id,
  refuse to init, and the embedded funnel would be dark. Never bake it in
  server-side: `cacheComponents` would hand one visitor's id to everyone.

**Commit:** `feat(hex): open the configurator in place`

---

## Task 6: The academy handles the save

**Files:**
- Create: `src/components/hex/EmbeddedSavePanel.tsx`
- Modify: `src/components/hex/SaveHexClusterForm.tsx`

`SaveHexClusterForm` cannot be reused as-is: it takes `{mode, share}`, sources
the envelope from `location.hash` or the stash, renders a full page, has **two**
navigation exits, and its done-state copy says "Returning you to the
configurator…". Extract the form body into a component that accepts an envelope
as a prop and reports via callback, and let both the route and the panel render
it.

Flow: `save-request` → panel → click → server action inside `try/catch` →
`saved` or `save-failed`. On an auth throw, write the stash and open the sign-in
popup (§3.2), poll `/api/auth/session`, resume in place.

**Commit:** `feat(hex): run the save in place when embedded`

---

## Task 7: Deep links

`/hex?build=<shareCode>` — a share code, never a payload. A payload in an
academy query string would land in access logs, the Referer of every asset, and
PostHog's `$current_url`; `save-link.ts:12-18` forbids exactly this.

Resolving a code to a payload needs a DB read, which `/hex` cannot do without
losing its prerender. **Decide explicitly:** a client fetch from a cached
route is the recommendation, keeping the page static. Carry `d/r/s/h/n/t`
through so `adoptReturnLink`'s guarantees survive; v1 dropped `h`.

**Commit:** `feat(hex): deep-link builds into the embedded configurator`

---

## Task 8: Framing headers, BOTH sides, before the frame ships

Moved earlier than v1, which deferred it to last on backwards reasoning: nobody
legitimately frames the configurator today, so the header can ship first.

- `bioscale-viz/public/_headers`: `frame-ancestors` allowing the academy, the
  apex, `localhost:3000` and the Vercel preview pattern. Omitting the dev
  origins kills local development of every later task.
- `project-foundry/next.config.ts`: `frame-ancestors 'self'` on `/:path*`,
  keeping `/embed/:path*` as the explicit exception, ordered first. Plus
  `frame-src` pinning what the parent may embed.

**Commit:** `chore(hex): restrict framing on both sides`

---

## Task 9: The configurator's chrome, and its escapes

- `html[data-embed='1'] #header { display: none }` — the real selector.
  `.hex-brand` and `.hex-page-title` do not exist, and CSS fails silently.
- Call `syncMobileToolbarTop()` again after setting the attribute.
- **`target="_top"` on every outbound anchor** reachable while embedded. The
  brand link goes to the BioScale demo and the sheet footer to the apex site;
  today both would load inside the academy's frame.
- Ship `overscroll-behavior: contain` on `#inspector-body`, `#export-modal` and
  `.export-modal-body` — **in bioscale**, since a parent cannot reach a
  cross-origin child's scrollers.
- `html[data-embed='1'] body { touch-action: none }` so a pinch starting off the
  canvas does not zoom the academy.
- De-rate the GPU budget under `[data-embed='1']` + coarse pointer:
  `setPixelRatio(1)`, 1024² shadow map, `antialias: false`.

**Commit:** `feat(hex): drop the app's own chrome when embedded`

---

## Task 10: WebGL context loss

Nothing handles it today, and iOS takes the context on backgrounding.

- Child: `webglcontextlost` → `preventDefault()`, stop the loop, post
  `context-lost`. `webglcontextrestored` → **re-bake the PMREM environment**
  (`scene.ts:67-68` runs once at import and three's restore path does not redo
  it, so materials come back unlit) → resume.
- Parent: on `context-lost`, show a reload control that remounts the iframe with
  a fresh `key`.
- Do **not** unmount on close as the primary remedy — that costs a 6.4 MB,
  75-file reload plus a PMREM bake per reopen. Keep it mounted and hidden for a
  grace window, unmount after.

**Commit:** `fix(hex): survive a lost WebGL context`

---

## Task 11: Kill switch and entry-point sweep

- **Flag the embed.** Rolling back otherwise needs coordinated Vercel and
  Cloudflare Pages redeploys. It must be build-time (`NEXT_PUBLIC_*`) or a small
  dynamic island — a request-time Edge Config read would un-static `/hex`.
- **Sweep the entry points.** `account/hex-clusters/page.tsx:30` and
  `AppFooter.tsx` both still point at the standalone configurator, and the
  footer link carries no `ph_did`, so it reaches a configurator that correctly
  refuses to initialise analytics. Decide per surface: framed or standalone.
- **Analytics.** Add `embedded: true` to `saveStarted` and an academy-side
  `hex_save_completed`. Without it, every existing funnel on `hex_save_started`
  silently mixes two different behaviours.

**Commit:** `chore(hex): flag the embed and sweep the entry points`

---

## 5. Non-goals

- Retiring the standalone page. Printed sheets cite it.
- Removing the fragment save flow or the localStorage stash. Both are the
  fallback, and the stash is the only thing that survives a magic link opened on
  another device.
- Merging the two deploys.
- **Any message performing a write.** See §4.3.
