# Embedded hex configurator on `/hex` — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement
> this plan task-by-task.

**Goal:** Open the hex configurator inside `/hex`, expanding from the CTA, with
the academy chrome intact and the save round-trip reduced from three
cross-origin navigations to zero.

**Architecture:** The configurator stays a separate deploy and a real standalone
page (printed QR codes point at it and cannot be changed). The academy frames it
and talks to it over an origin-restricted `postMessage` channel. When framed,
the configurator stops navigating the window and delegates: it asks the parent
to save, and the parent — already on the academy, already holding the session —
runs the existing server action and posts the result back. The build never
travels through a URL again.

**Tech stack:** Next 16 App Router (academy), Vite + three.js (configurator),
`postMessage`, the existing `saveHexCluster` server action, View Transitions
with a measured-rect fallback for the expand animation.

---

## 1. Why this exists

Today, saving a build is three navigations across two origins:

```
demo/hex  --assign-->  academy/account/hex-clusters/save?mode=..#envelope
                       (maybe a magic-link round trip)
                       --assign-->  demo/hex?d=..&r=..&s=..&h=..&n=..&t=..#payload
```

The user leaves the academy, comes back, and leaves again. Every hop carries the
whole build in a URL fragment because the two origins share no session, which is
why `save-link.ts` and `SaveHexClusterForm.tsx` are as intricate as they are.

Framed, the same operation is a message, a server action, and a message back.
Nothing navigates. The fragment gymnastics stop being necessary for the embedded
path (they stay for the standalone path, which must keep working).

**What must not break:**

- `demo.onethousanddrones.com/hex` stays a working standalone page. Printed
  build sheets carry QR codes pointing at it, and paper cannot be re-issued.
- `/c/[shareCode]` and the existing save flow keep working for anyone arriving
  from a QR or a saved link.
- The register semantics: drawing number, revision, payload hash, lineage.

## 2. Verified constraints

Checked 2026-08-03, not assumed:

| Fact | Evidence |
| --- | --- |
| The demo host sets no framing headers | `curl -I https://demo.onethousanddrones.com/hex` returns no `X-Frame-Options` and no CSP; no `_headers` file in bioscale-viz |
| An origin-restricted postMessage bridge already exists and is trusted | `bioscale-viz/src/main.ts:231` guards on `/^https?:\/\/([a-z0-9-]+\.)*onethousanddrones\.com$/` and localhost; `parentTargetOrigin()` derives the reply target from the referrer |
| Embed detection idiom already in use | `main.ts:139` — `if (window.parent === window) return;` |
| The hex app has NO bridge yet | the listener above is in `src/main.ts` (the BioScale visualiser), not `src/hex/main.ts` |
| Save currently navigates the window | `bioscale-viz/src/hex/save-link.ts` — `window.location.assign(buildSaveURL(...))` |
| The return leg also navigates | `project-foundry/src/components/hex/SaveHexClusterForm.tsx:192,239` |

## 2a. Owner decisions, settled 2026-08-03

These were open questions; they are now requirements, and they change the work.

1. **Mobile embeds too.** There is no desktop-only branch and no navigation
   fallback by viewport. Task 1 is therefore not a go/no-go on scope, it is the
   point where mobile problems get found and fixed, and mobile is a first-class
   target for every task after it.
2. **The configurator hides its own brand chrome when embedded.** Driven by
   `?embed=1`, not by frame-detection alone, so a standalone visitor who is
   somehow framed still sees a complete app.
3. **Auto-open on a deep link.** A visitor arriving with a build in the URL
   (a QR scan, a shared link) gets the frame already open. A COLD visitor does
   not: `/hex` is the spec page the printed files cite, and opening a 3D app
   over it before it has been read once would bury the thing every published
   `LICENSE.txt` points at.

**Mobile consequences to design for, not discover:**

- `100svh`, never `100vh`. Mobile browser chrome resizes the viewport and `vh`
  leaves the canvas cut off behind the URL bar.
- Touch arbitration is the real risk: a drag on the canvas must orbit the
  camera, not scroll the page. Body scroll lock while open is mandatory, and
  `touch-action` on the frame wrapper needs checking on iOS specifically.
- The academy header is sticky and costs vertical space that a phone does not
  have. Decide whether it collapses while the frame is open, and if it does,
  keep a visible way back out.
- The configurator already handles phones standalone (`syncMobileToolbarTop` in
  `src/hex/main.ts` exists for exactly this), so the app is mobile-capable; what
  is unproven is the app INSIDE a frame on a phone.

---

## Task 1: Make the frame work on a phone, first

**Files:**
- Create: `src/app/(chrome)/sandbox/hex-embed-probe/page.tsx`

**Step 1: Write the probe**

```tsx
// Dev-only spike. Answers three questions before any real work:
// does the configurator frame at all, does WebGL run inside it, and is it
// usable on a phone viewport. DELETE once Task 1 is signed off.
import { notFound } from "next/navigation";

export default function HexEmbedProbe() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="title-section">Embed probe</h1>
      <iframe
        src="https://demo.onethousanddrones.com/hex"
        title="Hex configurator"
        className="mt-6 h-[70svh] w-full border border-panel-border/60"
        allow="fullscreen"
      />
    </main>
  );
}
```

**Step 2: Check it on the desktop viewport**

Run: `pnpm dev`, open `http://localhost:3000/sandbox/hex-embed-probe`

1. The configurator renders (not a blank frame, not refused-to-connect).
2. Placing a cell works and the camera responds to drag.

**Step 3: Check it on a REAL phone, not an emulated viewport**

DevTools device mode does not reproduce iOS Safari's viewport behaviour,
its touch handling, or its WebGL limits, and those are the three things at
risk. Serve the dev server on the LAN (`pnpm dev --host`) and open it on an
actual handset.

Confirm, and record each answer in this file:

- **Sizing.** No cut-off canvas behind the URL bar, on both first paint and
  after the bar collapses on scroll.
- **Touch.** A one-finger drag on the canvas orbits the camera and does NOT
  scroll the page. Pinch zooms the model, not the document.
- **Frame rate.** Rotating a seven-tile cluster is smooth enough to use.
- **Memory.** The tab survives opening, closing and reopening the frame several
  times without the renderer being killed. iOS is the one that reclaims WebGL
  contexts aggressively.

**Step 4: Fix what fails, here, before Task 2**

Mobile is a requirement, not a branch, so a failure at this step is work to be
done rather than scope to be cut. The likely fixes, in order of probability:
`100svh` instead of `100vh`; `overscroll-behavior: contain` and a body scroll
lock; `touch-action: none` on the frame wrapper; and, if the renderer is being
reclaimed, unmounting the iframe on close rather than hiding it.

**Step 4: Commit**

```bash
git add "src/app/(chrome)/sandbox/hex-embed-probe/page.tsx" docs/plans/2026-08-03-hex-configurator-embed.md
git commit -m "spike(hex): probe whether the configurator survives being framed"
```

---

## Task 2: The message protocol, defined once and shared

Both repos must agree on the wire format. Define it in one file per side with
identical contents, because they cannot import from each other.

**Files:**
- Create: `src/lib/hex-embed-protocol.ts` (academy)
- Create: `bioscale-viz/src/hex/embed-protocol.ts` (configurator)
- Test: `src/lib/__tests__/hex-embed-protocol.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isAcademyOrigin, parseMessage } from "@/lib/hex-embed-protocol";

describe("isAcademyOrigin", () => {
  it.each([
    "https://academy.onethousanddrones.com",
    "https://demo.onethousanddrones.com",
    "http://localhost:3000",
  ])("accepts %s", (o) => expect(isAcademyOrigin(o)).toBe(true));

  it.each([
    "https://onethousanddrones.com.evil.test",
    "https://evil-onethousanddrones.com",
    "https://academy.onethousanddrones.com.attacker.io",
    "null",
    "",
  ])("rejects %s", (o) => expect(isAcademyOrigin(o)).toBe(false));
});

describe("parseMessage", () => {
  it("returns null for anything that is not our envelope", () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage({})).toBeNull();
    expect(parseMessage({ type: "otter" })).toBeNull();
    expect(parseMessage("otd-hex:save-request")).toBeNull();
  });

  it("reads a save request", () => {
    const msg = {
      channel: "otd-hex",
      type: "save-request",
      mode: "new",
      share: null,
      envelope: { p: "PAYLOAD", h: "HASH", v: 1, s: {}, n: "Bench" },
    };
    expect(parseMessage(msg)?.type).toBe("save-request");
  });
});
```

**Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/__tests__/hex-embed-protocol.test.ts`
Expected: FAIL, cannot resolve `@/lib/hex-embed-protocol`.

**Step 3: Implement**

```ts
// The academy <-> configurator wire format. Two origins, no shared code, so
// this file exists TWICE, byte-identical, and the test pins the half that can
// be tested here. Changing one without the other silently breaks the channel:
// messages are dropped, not rejected loudly.
export const CHANNEL = "otd-hex";

/** Only OTD origins may drive the embed, and only OTD origins may be replied
 *  to. The regex anchors BOTH ends: `onethousanddrones.com.evil.test` and
 *  `evil-onethousanddrones.com` both match a lazy version of this. */
const OTD = /^https:\/\/([a-z0-9-]+\.)*onethousanddrones\.com$/;
const LOCAL = /^http:\/\/localhost(:\d+)?$/;

export function isAcademyOrigin(origin: string): boolean {
  return OTD.test(origin) || LOCAL.test(origin);
}

export type SaveRequest = {
  channel: typeof CHANNEL;
  type: "save-request";
  mode: "new" | "rev";
  share: string | null;
  envelope: { p: string; h: string; v: number; s: unknown; n: string };
};

export type Saved = {
  channel: typeof CHANNEL;
  type: "saved";
  drawingLabel: string;
  revLabel: string;
  shareCode: string;
  payloadHash: string;
  name: string;
  savedAt: string;
};

export type Cancelled = { channel: typeof CHANNEL; type: "save-cancelled" };
export type Ready = { channel: typeof CHANNEL; type: "ready" };

export type HexMessage = SaveRequest | Saved | Cancelled | Ready;

/** Narrow an untrusted `event.data`. Returns null rather than throwing: a
 *  malformed message from a permitted origin must be ignored, not crash the
 *  page that received it. */
export function parseMessage(data: unknown): HexMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.channel !== CHANNEL || typeof d.type !== "string") return null;
  switch (d.type) {
    case "save-request":
      return typeof d.envelope === "object" && d.envelope !== null
        ? (d as unknown as SaveRequest)
        : null;
    case "saved":
      return typeof d.shareCode === "string" ? (d as unknown as Saved) : null;
    case "save-cancelled":
    case "ready":
      return d as unknown as HexMessage;
    default:
      return null;
  }
}
```

**Step 4: Run the test**

Run: `pnpm vitest run src/lib/__tests__/hex-embed-protocol.test.ts`
Expected: PASS.

**Step 5: Copy the file verbatim into bioscale-viz**

Copy to `bioscale-viz/src/hex/embed-protocol.ts`, changing nothing but the
import-free content (it has no imports).

**Step 6: Commit both repos**

```bash
git add src/lib/hex-embed-protocol.ts src/lib/__tests__/hex-embed-protocol.test.ts
git commit -m "feat(hex): define the embed message protocol"
```

---

## Task 3: The configurator learns it is embedded

**Files:**
- Create: `bioscale-viz/src/hex/embed.ts`
- Modify: `bioscale-viz/src/hex/save-link.ts` (the `beginSave` tail)
- Test: `bioscale-viz/src/hex/embed.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { isEmbedded, requestParentSave } from './embed.js';

describe('isEmbedded', () => {
    it('is false when the page owns its window', () => {
        expect(isEmbedded()).toBe(false); // jsdom: window.parent === window
    });
});

describe('requestParentSave', () => {
    it('posts the envelope to the parent, never to *', () => {
        const post = vi.fn();
        const env = { p: 'P', h: 'H', v: 1, s: {}, n: 'Bench' };
        requestParentSave(env, 'new', null, {
            parent: { postMessage: post } as unknown as Window,
            targetOrigin: 'https://academy.onethousanddrones.com',
        });
        expect(post).toHaveBeenCalledOnce();
        const [msg, origin] = post.mock.calls[0];
        expect(origin).toBe('https://academy.onethousanddrones.com');
        expect(origin).not.toBe('*'); // a build is not for every listener
        expect(msg.type).toBe('save-request');
        expect(msg.envelope.p).toBe('P');
    });
});
```

**Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/hex/embed.test.ts`
Expected: FAIL, module not found.

**Step 3: Implement**

```ts
/**
 * Being embedded changes exactly one thing: this app stops navigating the
 * window and starts asking its parent to act.
 *
 * The parent is the academy, which is already signed in and already owns the
 * register, so the whole three-navigation round trip collapses to a message.
 * Standalone behaviour is untouched -- printed QR codes point at this page
 * directly and paper cannot be re-issued.
 */
import { CHANNEL, isAcademyOrigin } from './embed-protocol.js';

export function isEmbedded(): boolean {
    try {
        return window.parent !== window;
    } catch {
        return true; // cross-origin parent access threw: we are framed
    }
}

/** The origin to reply to, derived from the referrer and VALIDATED. Never `*`:
 *  a build payload posted to `*` is readable by any frame that can reach us. */
export function parentTargetOrigin(): string | null {
    try {
        const ref = document.referrer;
        if (!ref) return null;
        const origin = new URL(ref).origin;
        return isAcademyOrigin(origin) ? origin : null;
    } catch {
        return null;
    }
}

export function requestParentSave(
    envelope: { p: string; h: string; v: number; s: unknown; n: string },
    mode: 'new' | 'rev',
    share: string | null,
    deps?: { parent?: Window; targetOrigin?: string | null },
): boolean {
    const target = deps?.targetOrigin ?? parentTargetOrigin();
    const parent = deps?.parent ?? window.parent;
    if (!target) return false; // unknown parent: caller falls back to navigating
    parent.postMessage({ channel: CHANNEL, type: 'save-request', mode, share, envelope }, target);
    return true;
}
```

**Step 4: Wire it into `beginSave`**

Modify `bioscale-viz/src/hex/save-link.ts`, replacing the navigation tail:

```ts
    track(EVENTS.saveStarted, { mode, hasLineage: Boolean(lineage) });

    // EMBEDDED: ask the parent and stay put. The academy runs the save with the
    // session it already has, then posts the identity back. FALLS THROUGH to
    // the navigation when the parent cannot be identified, so a frame we do not
    // recognise degrades to the behaviour that has always worked.
    if (isEmbedded() && requestParentSave(envelopeObject, mode, lineage?.shareCode ?? null)) {
        return 'awaiting-parent';
    }

    window.location.assign(buildSaveURL(mode, lineage?.shareCode ?? null, encoded));
    return 'navigating';
```

`BeginSaveResult` gains `'awaiting-parent'`. Every caller must handle it: grep
`beginSave(` and update the switch, or TypeScript will tell you.

**Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS, and the existing `save-link.test.ts` still passes untouched.

**Step 6: Commit**

```bash
git add src/hex/embed.ts src/hex/embed.test.ts src/hex/save-link.ts src/hex/embed-protocol.ts
git commit -m "feat(hex): delegate save to the parent when embedded"
```

---

## Task 4: The configurator adopts the saved identity without reloading

**Files:**
- Modify: `bioscale-viz/src/hex/main.ts` (add the listener near the existing one)
- Modify: `bioscale-viz/src/hex/identity.ts` (expose a setter if none exists)

**Step 1: Add the listener**

```ts
// Embedded save: the parent did the write and is handing back the register
// entry. Adopt it exactly as a return navigation would have, minus the reload.
window.addEventListener('message', (ev) => {
    if (!isAcademyOrigin(ev.origin)) return;
    const msg = parseMessage(ev.data);
    if (!msg) return;
    if (msg.type === 'saved') {
        writeLineage({
            drawingLabel: msg.drawingLabel,
            revLabel: msg.revLabel,
            shareCode: msg.shareCode,
            name: msg.name,
            savedAt: msg.savedAt,
        });
        // The sheet's masthead switches from "uncontrolled print" to the
        // register number on the next render; nothing else changes.
        rerenderIdentityDependentUI();
    }
});
```

**Step 2: Verify by hand against the probe**

There is no unit test that proves a cross-origin handshake; this one is checked
in the browser. Open the probe, place a cell, save, and confirm the sheet
masthead shows the drawing number **without the page reloading**.

**Step 3: Commit**

```bash
git commit -am "feat(hex): adopt a parent-saved identity in place"
```

---

## Task 5: The academy frame, expanding from the button

**Files:**
- Create: `src/components/hex/HexConfiguratorFrame.tsx`
- Modify: `src/app/(chrome)/hex/page.tsx` (swap the CTA)

**Step 1: Build the component**

Requirements, each of which is a real decision:

- **Expands from the CTA.** Measure the button rect, render the frame at that
  rect, then animate to the target box on the next frame. Prefer
  `document.startViewTransition` where supported and fall back to the measured
  rect, because View Transitions are not universal.
- **Respects `prefers-reduced-motion`.** No expansion; the frame simply appears.
- **Header stays.** The frame occupies `100svh` minus the header, pinned below
  it. `svh`, not `vh`: mobile browser chrome changes the viewport and `vh`
  leaves a cut-off canvas.
- **Body scroll locks while open**, or the page scrolls under the 3D drag. Unlock
  on close, and restore the previous scroll position.
- **Escape closes.** So does an explicit close control; the control is not
  optional, since Escape is invisible on a touch device.
- **Focus is trapped while open and returns to the CTA on close.**
- **The iframe `src` carries `?embed=1`** plus the `ph_did` handoff, so the
  configurator can hide its own brand chrome and adopt the person id.
- **`sandbox` is NOT set.** The frame needs scripts, WebGL and same-origin
  storage for its own persistence; a sandbox attribute that omits any of those
  silently breaks the app. Leave it off and rely on origin checks, which is what
  the protocol is for.

**Step 2: Swap the CTA on `/hex`**

`ConfiguratorLink` stays for the no-JS and fallback case. The new component
renders it as its trigger, so with JS disabled the link still navigates to the
standalone configurator.

**Step 3: Verify**

- Open, close, reopen: no leaked scroll lock, focus back on the CTA.
- `prefers-reduced-motion: reduce`: no animation, frame still opens.
- 390px: the frame fills the viewport under the header and the canvas responds.

**Step 4: Commit**

```bash
git add src/components/hex/HexConfiguratorFrame.tsx "src/app/(chrome)/hex/page.tsx"
git commit -m "feat(hex): open the configurator in place, expanding from the CTA"
```

---

## Task 6: The academy handles the save request

**Files:**
- Create: `src/components/hex/EmbeddedSavePanel.tsx`
- Modify: `src/components/hex/HexConfiguratorFrame.tsx`

The parent listens for `save-request`, and because it is already the academy it
can do what the standalone flow needs three navigations for:

1. **Signed out?** Render the existing `SaveSignInGate` in a panel over the
   frame. The envelope is held in React state, not a URL, so nothing has to
   survive a fragment round trip.
2. **Signed in?** Render the existing `SaveHexClusterForm` in the panel, in a
   mode that returns the result rather than navigating.
3. On success, post `saved` back into the iframe.
4. On cancel, post `save-cancelled` so the configurator can re-enable its UI.

`SaveHexClusterForm` currently ends with `window.location.assign`. Give it an
`onSaved` callback; when provided, call it instead of navigating. The standalone
route passes nothing and keeps navigating, so that path is untouched.

**Commit:**

```bash
git commit -am "feat(hex): run the save in place when the configurator is embedded"
```

---

## Task 7: Deep links and the QR path

**Files:**
- Modify: `src/app/(chrome)/hex/page.tsx`
- Modify: `src/app/(bare)/c/[shareCode]/page.tsx`

- `/hex?build=<code>` opens with the frame **already expanded** and the build
  loaded, by putting the payload on the iframe `src` fragment. This is owner
  decision 3.
- A COLD `/hex` visit does not auto-open. The page is the spec sheet every
  published `LICENSE.txt` cites; opening a 3D app over it before it has been
  read once buries the thing the URL exists to serve. Auto-open is keyed on the
  build parameter, not on arrival.
- Because auto-open skips the expand-from-button animation (there is no button
  press to expand from), the frame must render open on first paint rather than
  animating from nothing, or the page visibly lurches. Reduced-motion handling
  already covers this case; reuse it.
- `/c/[shareCode]`'s "Open in the configurator" points at `/hex?build=…` so a
  scanned QR lands on the academy with chrome, not on the bare configurator.
- The printed QR itself still points at `demo…/hex`. It cannot be changed and
  must keep working standalone. **Do not "fix" this.**

**Commit:**

```bash
git commit -am "feat(hex): deep-link builds into the embedded configurator"
```

---

## Task 8: Lock the frame down

**Files:**
- Create: `bioscale-viz/public/_headers`

```
/*
  Content-Security-Policy: frame-ancestors 'self' https://academy.onethousanddrones.com https://onethousanddrones.com
```

Framing is currently unrestricted, which is how this plan is possible at all
and also means anyone can frame the configurator today. Once the academy is a
known ancestor, restrict it. **Ship this AFTER Task 5 works**, or the frame
breaks before the allow-list is right, and verify the standalone page still
loads afterwards.

**Commit:**

```bash
git commit -am "chore(hex): restrict who may frame the configurator"
```

---

## 3. What this deliberately does not do

- **Does not retire the standalone page.** Printed sheets cite it.
- **Does not remove the fragment-based save flow.** It stays for the standalone
  path and as the fallback when the parent cannot be identified.
- **Does not merge the two deploys.** They stay separate; the frame is the seam.
- **Does not change the register semantics.** Drawing numbers, revisions and
  payload hashes are untouched; only the transport changes.

## 4. Task 9: The configurator hides its own chrome when embedded

Owner decision 2. Two stacked brand headers is the giveaway that something has
been iframed rather than integrated.

**Files:**
- Modify: `bioscale-viz/src/hex/main.ts`
- Modify: `bioscale-viz/src/styles/index.css` (or the hex stylesheet)

**Step 1: Read the flag and mark the document**

```ts
// `?embed=1`, not frame-detection alone. A standalone visitor who is somehow
// framed should still get a complete app; only a parent that asked for the
// embedded presentation gets it.
if (new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.setAttribute('data-embed', '1');
}
```

**Step 2: Hide the chrome in CSS, not by deleting nodes**

```css
/* Embedded: the academy supplies the header, the footer and the page title.
   Hidden rather than removed so the standalone page is untouched and one
   attribute flips the whole presentation back. */
html[data-embed='1'] .hex-brand,
html[data-embed='1'] .hex-page-title {
    display: none;
}
```

Keep the toolbar, the export control and the theme toggle: those are the app,
not the chrome. **The theme toggle is the interesting one** — the academy has
its own, and two toggles that disagree is worse than one that is missing.
Either hide the configurator's and have the parent post the theme across, or
keep it and accept the divergence. Recommend the former, and it needs a
`set-theme` message added to the protocol in Task 2.

**Step 3: Verify both presentations**

Standalone `demo…/hex` is unchanged; `demo…/hex?embed=1` has no brand header.

**Commit:**

```bash
git commit -am "feat(hex): drop the app's own chrome when embedded"
```

---

## 5. Settled, previously open

All three owner questions are answered in section 2a. Nothing in this plan is
blocked on a decision; what remains is the mobile evidence from Task 1.
