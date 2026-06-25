# Teleprompter Narration During Capture (§1) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an admin attach a narration script to a guide video slot and have the OTD Capture
desktop app show it as a teleprompter (off-frame) while recording that clip.

**Architecture:** A new optional `script` field on the guide `video` content block (academy);
a token-gated `GET /api/capture/session` the capture app calls to pull it; the capture app's
**main process** fetches and merges `script` into the existing `capture:session` payload (no
renderer network → no CORS); the overlay renders a teleprompter panel in the framing section
(frame-safe via the existing content-protection on the overlay window). No DB migration, no new
auth, no new IPC channel.

**Tech Stack:** Next.js (App Router) + Zod 4 + Prisma + Vitest (academy, `src/`); Electron +
plain JS (capture app, `capture-app/`).

**Source design (read first):** [`2026-06-24-teleprompter-narration-capture-design.md`](./2026-06-24-teleprompter-narration-capture-design.md)
— validated dry over 7 passes. This plan implements it verbatim; do not re-derive decisions.

---

## Ground rules (codebase-specific — an engineer new here WILL trip on these)

- **Two codebases, two gates.**
  - **Academy (`src/`)** is TDD'd with **Vitest**. Run `pnpm test <file>` (PowerShell, *not* the
    Bash tool — `pnpm` under Bash exits 127). Tests lease an isolated Neon branch per DB-file;
    **`.env.test.local` must exist** or tests silently hit PROD.
  - **Capture app (`capture-app/`)** has **no test harness** (its `package.json` has only
    `start`). The agent gate is **`node --check <file>`** (syntax only). Behavior is verified by
    **Josh running the GUI** — you cannot see it. Do not invent a test framework for it; that's a
    separate, out-of-scope decision (the app is slated to split into its own repo, design §4).
- **Run academy commands in PowerShell.** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.
- **Commit after every green step.** Branch is `docs/capture-audio-script-handoff` already off
  `main`; stay on it (or a fresh feature branch off `main` — do **not** merge without Josh's
  explicit go-ahead).
- **TDD discipline:** for academy tasks, write the test, watch it FAIL for the right reason, then
  implement. Use @superpowers:test-driven-development if you need the rhythm.

---

## Task 1: Add the `script` field to the guide `video` block schema (academy, TDD)

**Files:**
- Modify: `src/lib/schemas/guide.ts` (the `video` object, ~lines 91–106)
- Test: `src/lib/__tests__/guide-schema.test.ts`

**Step 1 — Write the failing tests.** Append inside the existing `describe` block in
`src/lib/__tests__/guide-schema.test.ts`:

```ts
it("accepts a video block with a narration script", () => {
  expect(
    contentBlockSchema.safeParse({
      type: "video",
      src: "",
      alt: "solder a row",
      script: "Today we solder the first row. Take the iron…",
    }).success,
  ).toBe(true);
});

it("preserves script through parse (not stripped)", () => {
  const parsed = contentBlockSchema.safeParse({
    type: "video",
    src: "",
    alt: "a",
    script: "read me aloud",
  });
  expect(parsed.success).toBe(true);
  if (parsed.success) {
    // discriminatedUnion strips unknown keys, so this only holds once `script`
    // is part of the schema — the whole point of this task.
    expect((parsed.data as { script?: string }).script).toBe("read me aloud");
  }
});

it("rejects a script over the 8000-char cap", () => {
  expect(
    contentBlockSchema.safeParse({
      type: "video",
      src: "",
      alt: "a",
      script: "x".repeat(8001),
    }).success,
  ).toBe(false);
});
```

**Step 2 — Run, verify FAIL.**
Run (PowerShell): `pnpm test src/lib/__tests__/guide-schema.test.ts`
Expected: the "preserves script" test FAILS (`script` is `undefined` — stripped by the
discriminatedUnion) and the "rejects over 8000" test FAILS (extra key ignored, parse succeeds).
The "accepts" test may already pass (extra keys are ignored) — that's fine; the other two prove the
field isn't really there yet.

**Step 3 — Implement.** In `src/lib/schemas/guide.ts`, inside the `z.object({ type:
z.literal("video"), … })`, add the field after `aspect`:

```ts
    // Narration script for this clip. Non-empty ⇒ this video needs human
    // narration: the capture overlay shows it as a teleprompter (mic already
    // defaults on). Empty/absent ⇒ silent screencast (today's behavior). This is
    // the ONE long field on a content block; everything else is short metadata.
    script: z.string().max(8000).optional(),
```

**Step 4 — Run, verify PASS.**
Run: `pnpm test src/lib/__tests__/guide-schema.test.ts`
Expected: all three new tests PASS, plus the pre-existing ones still green.

**Step 5 — Commit.**

```bash
git add src/lib/schemas/guide.ts src/lib/__tests__/guide-schema.test.ts
git commit -m "feat(guide): add optional narration script to the video content block"
```

---

## Task 2: `GET /api/capture/session` — serve the slot bundle incl. script (academy, TDD)

Mirrors `src/app/api/capture/status/route.ts` (token-gated read) and the test style of
`src/lib/__tests__/refresh-route.test.ts` (mock `@/env` + `@/lib/db`, import the handler, call it).

**Files:**
- Create: `src/app/api/capture/session/route.ts`
- Test: `src/lib/__tests__/capture-session-route.test.ts`

**Step 1 — Write the failing tests.** Create `src/lib/__tests__/capture-session-route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

// capture-token reads AUTH_SECRET from @/env; give it a deterministic one so the
// real signCaptureToken/verifyCaptureToken round-trip in-test.
vi.mock("@/env", () => ({ env: { AUTH_SECRET: "test-secret" } }));

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { guideCard: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

import { GET } from "@/app/api/capture/session/route";
import { signCaptureToken } from "@/lib/capture-token";

const BASE = "https://academy.onethousanddrones.com/api/capture/session";
const req = (token?: string) =>
  new Request(token ? `${BASE}?token=${encodeURIComponent(token)}` : BASE);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/capture/session", () => {
  test("400 with no token", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  test("401 with a bad token", async () => {
    expect((await GET(req("not.a.token"))).status).toBe(401);
  });

  test("200 returns the slot bundle incl. script for a video block", async () => {
    findUnique.mockResolvedValue({
      contentBlocks: [
        {
          type: "video",
          src: "",
          alt: "solder a row",
          caption: "First solder joint",
          captureHint: "KiCad ▸ pcb",
          aspect: "16:9",
          script: "Today we solder the first row…",
        },
      ],
    });
    const token = signCaptureToken({ cardId: "c1", blockIndex: 0, kind: "video" });
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      kind: "video",
      hint: "KiCad ▸ pcb",
      caption: "First solder joint",
      aspect: "16:9",
      script: "Today we solder the first row…",
    });
  });

  test("200 with script:'' when the block has no script", async () => {
    findUnique.mockResolvedValue({
      contentBlocks: [{ type: "video", src: "", alt: "a" }],
    });
    const token = signCaptureToken({ cardId: "c1", blockIndex: 0, kind: "video" });
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect((await res.json()).script).toBe("");
  });
});
```

**Step 2 — Run, verify FAIL.**
Run: `pnpm test src/lib/__tests__/capture-session-route.test.ts`
Expected: FAIL at import — `Cannot find module '@/app/api/capture/session/route'` (route doesn't
exist yet).

**Step 3 — Implement the route.** Create `src/app/api/capture/session/route.ts`:

```ts
// Session-detail read for the OTD Capture desktop app. The app holds the same
// slot-scoped signed token it will upload with; it GETs this AFTER the deep-link
// hand-off to pull the slot's metadata — crucially the narration `script`, which
// is too long (and too log-leaky) to ride the otd-capture:// URL. Pure read, no
// side effects. Token-gated (no cookie), like /api/capture and /api/capture/status.
import { db } from "@/lib/db";
import { verifyCaptureToken } from "@/lib/capture-token";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

// Token-dependent response — never static-optimize/cache it.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const claims = verifyCaptureToken(token);
  if (!claims) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const card = await db.guideCard.findUnique({
    where: { id: claims.cardId },
    select: { contentBlocks: true },
  });

  // Defaults mirror createCaptureSession (src/lib/actions/guide-images.ts).
  let hint = "";
  let caption = "";
  let aspect = claims.kind === "video" ? "16:9" : "16:10";
  let script = "";
  if (card) {
    try {
      const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
      const block = blocks[claims.blockIndex];
      if (block && (block.type === "image" || block.type === "video")) {
        hint = block.captureHint ?? "";
        caption = block.caption ?? "";
        aspect = block.aspect ?? aspect;
        if (block.type === "video") script = block.script ?? "";
      }
    } catch {
      // fall through to defaults (same defensive posture as /status)
    }
  }
  return Response.json({ kind: claims.kind, hint, caption, aspect, script });
}
```

> Note: `block.script` type-resolves only because Task 1 added it to the schema — keep Task 1
> first. `image` blocks have no `script`; the `if (block.type === "video")` guard satisfies the
> discriminated-union narrowing.

**Step 4 — Run, verify PASS.**
Run: `pnpm test src/lib/__tests__/capture-session-route.test.ts`
Expected: all four tests PASS.

**Step 5 — Typecheck (the route touches the discriminated union).**
Run: `pnpm exec tsc --noEmit`
Expected: no errors.

**Step 6 — Commit.**

```bash
git add src/app/api/capture/session/route.ts src/lib/__tests__/capture-session-route.test.ts
git commit -m "feat(api): add token-gated GET /api/capture/session serving the slot script bundle"
```

---

## Task 3: Author the script — textarea in the video block editor (academy, UI gate)

No Vitest here — `BlockEditor` is a React component and the repo has no component-test harness for
it; the gate is `tsc` + `pnpm build` + **Josh eyeballing the field**. (This is consistent with how
the codebase treats guide-editor UI.)

**Files:**
- Modify: `src/components/guide/BlockEditor.tsx` (the video/image block branch, ~lines 585–624)

**Step 1 — Implement.** In the video block's editor JSX, **after** the Caption `<div>` (the block
ending ~line 598) and **before** the Capture-aspect `<div>` (~line 600), insert a script textarea.
It must only render for video blocks (image blocks have no script):

```tsx
      {block.type === "video" ? (
        <div>
          <label htmlFor={`${baseId}-script`} className={labelClass}>
            Narration script (optional — what the teacher reads aloud)
          </label>
          <textarea
            id={`${baseId}-script`}
            rows={6}
            maxLength={8000}
            value={block.script ?? ""}
            onChange={(e) =>
              onChange({ ...block, script: e.target.value || undefined })
            }
            className={`mt-1 ${inputClass}`}
          />
          <p className={helpClass}>
            Shown as a teleprompter in OTD Capture while recording this clip. A
            non-empty script marks the clip as needing narration.
          </p>
        </div>
      ) : null}
```

> Use the SAME `labelClass` / `inputClass` / `helpClass` / `baseId` already in scope in this
> component (the Caption/Aspect inputs use them). Store `""` as `undefined` (matches how Caption
> clears itself) so an empty textarea doesn't persist an empty string.

**Step 2 — Typecheck.**
Run: `pnpm exec tsc --noEmit`
Expected: no errors (`block.script` resolves because the block is narrowed to `type:"video"` and
Task 1 added the field).

**Step 3 — Build.**
Run: `pnpm build`
Expected: build succeeds.

**Step 4 — Manual verification (Josh).** Run `pnpm dev` (launch detached:
`Start-Process pnpm.cmd dev -WindowStyle Hidden`), open a guide card with a `video` block in the
admin editor, confirm the "Narration script" textarea appears for video blocks (and NOT for image
blocks), type a script, Save, reload, confirm it persisted. (The save path round-trips through
`guideContentBlocksSchema` → `saveGuideCard`; the field persists because Task 1 put it in the
schema.)

**Step 5 — Commit.**

```bash
git add src/components/guide/BlockEditor.tsx
git commit -m "feat(guide-editor): author a narration script on video blocks"
```

---

## Task 4: Capture app — fetch the script in MAIN, enrich every deep-link path (capture, `node --check` + manual)

**The single most important correctness point in this plan** (validation finding #4): the three
deep-link entry points are NOT uniform, and the **cold-launch** path (the most common: app not
running, user clicks "+") assigns `pendingSession` *directly*, bypassing `handleDeepLink`. The
enrich must cover all three or the primary flow silently gets no script.

**Files:**
- Modify: `capture-app/main.js` (`parseDeepLink`/`deliverSession`/`handleDeepLink` ~lines 76–115;
  `second-instance` ~252; `open-url` ~259; first-launch argv ~296–298)

**Step 1 — Add `enrichSession` + a single async `sessionFromLink` chokepoint.** Near
`parseDeepLink` in `capture-app/main.js`:

```js
// Pull the slot's narration script (and refresh the short metadata) from the
// academy using the slot token. Done HERE in the main process — Node fetch, no
// browser CORS (the renderer must never fetch the academy; see upload-capture).
// Best-effort: any failure leaves `s` as-is and capture proceeds (silent clip).
async function enrichSession(s) {
  if (!s || !s.token || !s.api) return s;
  try {
    const res = await fetch(
      `${s.api}/api/capture/session?token=${encodeURIComponent(s.token)}`,
    );
    if (!res.ok) {
      logLine(`session enrich: ${res.status} — proceeding without script`);
      return s;
    }
    const d = await res.json();
    // Authoritative server values win; never log the script body.
    s.script = typeof d.script === "string" ? d.script : "";
    if (d.hint) s.hint = d.hint;
    if (d.caption) s.caption = d.caption;
    if (d.aspect) s.aspect = d.aspect;
    logLine(`session enrich ok: hasScript=${!!s.script}`);
  } catch (e) {
    logLine(`session enrich threw: ${e && e.message} — proceeding without script`);
  }
  return s;
}

async function sessionFromLink(link) {
  const s = parseDeepLink(link);
  return s ? await enrichSession(s) : s;
}
```

**Step 2 — Route `handleDeepLink` through it (covers `second-instance` + `open-url`).** Replace:

```js
function handleDeepLink(link) {
  deliverSession(parseDeepLink(link));
}
```

with:

```js
async function handleDeepLink(link) {
  deliverSession(await sessionFromLink(link));
}
```

(`deliverSession` stays synchronous and unchanged — it sends if the overlay is ready, else stores
the already-enriched session for the `did-finish-load` flush.)

**Step 3 — Fix the first-launch argv path (the bypass).** In `app.whenReady().then(...)`, replace:

```js
    const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) pendingSession = parseDeepLink(link);
    else logLine("no deep link in launch argv (standalone launch)");
```

with:

```js
    const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) {
      // Enrich BEFORE delivering. Do NOT assign pendingSession from a pending
      // fetch — the did-finish-load flush could read a null pendingSession and
      // lose the session (cold-launch ordering trap). deliverSession handles the
      // ready-vs-queue branch itself.
      sessionFromLink(link).then(deliverSession);
    } else logLine("no deep link in launch argv (standalone launch)");
```

> Verify `createOverlay()` is called in `whenReady` BEFORE this block (so `overlay` exists for the
> `deliverSession` readiness check; if not ready yet, the enriched session is queued and flushed on
> `did-finish-load`). The two `app.on("second-instance"/"open-url", … handleDeepLink)` callers don't
> need `await` — fire-and-forget is fine.

**Step 4 — Syntax gate.**
Run (PowerShell): `node --check capture-app/main.js`
Expected: no output (exit 0). A syntax error prints the location.

**Step 5 — Commit.**

```bash
git add capture-app/main.js
git commit -m "feat(capture): fetch the narration script in main and enrich every deep-link path"
```

---

## Task 5: Capture app — teleprompter panel + off-frame, Ctrl+Shift scroll (capture, `node --check` + manual)

**Files:**
- Modify: `capture-app/overlay.html` (add the panel markup inside the **framing** section)
- Modify: `capture-app/overlay.js` (show/populate the panel from `s.script`; global scroll/hide
  hotkeys; constants near the other `$()` element refs ~lines 16–62)
- Modify: `capture-app/preload.js` (comment only — line 16 lists the payload fields; add `script`)

**Key constraints baked in from the design (do not deviate):**
- Render the panel **inside the framing section's DOM**. There is **no** `showSection("recording")`
  — recording reuses the framing section, so a framing-section panel is visible through framing AND
  recording, then hidden at `showSection("review")`. (Validation finding #8.)
- Frame-safety is automatic: the whole overlay window is `setContentProtection(true)`, so the panel
  is excluded from the recording **anywhere** — same mechanism that hides the framing box. Position
  is a *usability* choice (keep it off the KiCad work area), not a frame-safety one. (Finding §4.)
- **Global hotkeys MUST be `Ctrl+Shift+` chords** — bare Space/Esc/arrows clobber KiCad (Space =
  pan) and bare F-keys are Fn-unreliable, which is exactly why the existing globals are
  `Ctrl+Shift+Enter`/`Ctrl+Shift+Backspace`. Suggested: `Ctrl+Shift+ArrowDown`/`ArrowUp` to page,
  `Ctrl+Shift+H` to hide/show. (Validation finding §3b.)
- **Do NOT touch the mic.** `micEnabled` already defaults `true`; script presence drives the
  teleprompter only. (Validation finding #5.)

**Step 1 — Markup.** In `capture-app/overlay.html`, inside the framing section, add a hidden panel
positioned at a screen edge clear of the crop box, e.g.:

```html
<div id="teleprompter" class="teleprompter hidden" aria-hidden="true">
  <div id="teleprompterText" class="teleprompterText"></div>
</div>
```

Style it (in the same file's `<style>`): large, high-contrast, fixed to an edge (e.g. bottom band
or right rail), `overflow-y: auto`, a high `z-index`, generous line-height. It does not need to be
in the crop region — content protection keeps it out of the recording regardless.

**Step 2 — Wire it in `capture-app/overlay.js`.** Add element refs near the others
(`const teleprompterEl = $("teleprompter"); const teleprompterTextEl = $("teleprompterText");`).
In the `onSession` callback, after the existing session setup, populate from `s.script`:

```js
    // Teleprompter: present only when the slot carries a script (implied
    // needsNarration). Empty/absent ⇒ no panel, behave exactly as today.
    if (s.script && s.script.trim()) {
      teleprompterTextEl.textContent = s.script;
      teleprompterEl.classList.remove("hidden");
      teleprompterEl.setAttribute("aria-hidden", "false");
    } else {
      teleprompterEl.classList.add("hidden");
    }
```

Add global hotkeys (mirror how the existing global chords are handled — likely a `keydown`
listener; match the existing pattern in this file):

```js
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || !e.shiftKey) return;
    if (teleprompterEl.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { teleprompterEl.scrollTop += 80; e.preventDefault(); }
    else if (e.key === "ArrowUp") { teleprompterEl.scrollTop -= 80; e.preventDefault(); }
    else if (e.key.toLowerCase() === "h") {
      const hidden = teleprompterEl.classList.toggle("hidden");
      teleprompterEl.setAttribute("aria-hidden", String(hidden));
      e.preventDefault();
    }
  });
```

> Also allow scroll-wheel over the panel (a native `wheel`/overflow scroll works once the panel is
> interactive; the overlay's `setInteractive` hit-test already re-enables the window over panels —
> confirm the teleprompter is treated as a panel for the hit-test, or it can scroll by hotkey only).
> Keep the panel hidden again on `reset()` (where `phase` returns to `setup`) so a subsequent
> standalone/session run starts clean.

**Step 3 — preload comment.** In `capture-app/preload.js` line ~16, update the payload comment to
include `script`:

```js
  // Deep-link session from the lesson "+" (api/token/kind/hint/caption/script).
```

**Step 4 — Syntax gate.**
Run (PowerShell): `node --check capture-app/overlay.js` then `node --check capture-app/preload.js`
Expected: no output (exit 0) for each. (`overlay.html` has no JS gate — it's verified visually.)

**Step 5 — Commit.**

```bash
git add capture-app/overlay.html capture-app/overlay.js capture-app/preload.js
git commit -m "feat(capture): teleprompter panel with Ctrl+Shift scroll, shown for scripted clips"
```

---

## Task 6: End-to-end manual verification (Josh) + record the integration contract

Code can't self-verify the GUI or the deep-link round-trip; this task is the human gate the design
calls for. Nothing here is automated.

**Files:**
- (Optional, recommended) Create/append: a short integration note for design §4's eventual
  `INTEGRATION.md` — for now drop it in `capture-app/README.md` or a new
  `capture-app/INTEGRATION.md`.

**Step 1 — Pre-flight.** Ensure the academy is deployed/running with Task 2's route FIRST (the app
depends on it; a premature call degrades to no-teleprompter, not a crash — validation finding #10).
Locally: `Start-Process pnpm.cmd dev -WindowStyle Hidden`. Author a script on an L1.01 `video`
slot (Task 3). Start the capture app: `cd capture-app; npm start` (PowerShell).

**Step 2 — Cold-launch round-trip (the critical path).** With the capture app NOT running, click
the lesson slot's gold "+" so Windows cold-launches the app via `otd-capture://`. Confirm:
- the teleprompter panel appears in the framing phase showing the authored script;
- `~/Downloads/otd-captures/otd-capture.log` shows `session enrich ok: hasScript=true` (and never
  logs the script body).

**Step 3 — Frame-safety (belt-and-suspenders).** Record one short narrated clip with the
teleprompter visible. Open the uploaded clip and confirm the teleprompter is **absent** from the
video (content protection should exclude it — the same check the README prescribes for the box).

**Step 4 — Controls.** Confirm `Ctrl+Shift+ArrowDown/Up` scroll the script without disturbing KiCad,
and `Ctrl+Shift+H` hides/shows it. Confirm a slot with NO script shows no panel and behaves as today.

**Step 5 — App-already-running path.** With the app open, click a different scripted slot's "+"
(exercises the `second-instance` path) and confirm the new script loads.

**Step 6 — Record the contract.** Write the `GET /api/capture/session` request + response shape
(`{kind,hint,caption,aspect,script}`) next to the existing deep-link/upload contracts, so design §4's
repo split has it. Commit:

```bash
git add capture-app/INTEGRATION.md   # or README.md
git commit -m "docs(capture): record the /api/capture/session integration contract"
```

---

## Done criteria

- [ ] Task 1–2 Vitest green; `pnpm exec tsc --noEmit` clean; `pnpm build` succeeds.
- [ ] Task 4–5 pass `node --check`.
- [ ] Josh confirms (Task 6): cold-launch teleprompter shows the script; it's absent from the
      recording; Ctrl+Shift controls work; no-script slots unchanged.
- [ ] No migration ran; no new auth; no new IPC channel; mic behavior unchanged.

## Out of scope (do NOT build here)

- Writing the actual L1.01 scripts (content task — `otd-content-writing` skill, separate track).
- Teleprompter in the in-browser `MediaCapture` fallback (desktop-only in v1).
- Auto-scroll (manual only in v1).
- Studio-audio WAV (§2), editable audio timeline (§3), captions/STT (§5), repo split (§4).
