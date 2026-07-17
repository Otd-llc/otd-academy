# Signup abuse defense — validation findings (round 2)

> **Two validation passes, 2026-07-16 → 07-17. This doc now carries BOTH the confirmed defects
> AND the converged architecture they force.**
>
> - **Part 1 (D1–D7 below):** the first pass — a multi-agent run that hit a session limit
>   mid-way; 7 distinct critical/major defects confirmed against installed source.
> - **Part 2 (§ "Second pass" near the end):** a bounded single-agent loop run TO DRY (6 rounds,
>   one agent each, convergence confirmed on round 6). 13 further defects (N1–N3, R2-1…R2-4,
>   F1–F2, P1–P3, enforce-before-turnstile), several of which found that the Part-1 *fixes
>   contradicted each other*. **It resolves into a single coherent architecture — see
>   "§ Converged architecture".**
>
> **DO NOT BUILD from the design/implementation plans as written.** Build from **§ Converged
> architecture** — it supersedes the piecemeal fixes in D1–D7 and the plan docs. Every claim
> here is against installed source (`@auth/core@0.41.2`, `next-auth@5.0.0-beta.31`;
> `@upstash/ratelimit`/`@upstash/redis` are not installed yet, so their internals are verified
> only where a prior round had them).

---

## D1 — Turnstile is unimplementable in the `signIn` callback, AND the endpoint is bypassable · CRITICAL

The plan puts Layer 0 (Turnstile) in the `signIn` callback (design §7, Task 5). **The callback
never receives the request or body** — `@auth/core@0.41.2 send-token.js:23-27` invokes it as
`callbacks.signIn({ user, account, email: { verificationRequest: true } })`. The Turnstile token
(`cf-turnstile-response`) is a form field; `headers()` reads headers, not the POST body. So the
check **cannot** run where the design puts it.

The only place the token exists is `resendAction`. But that's bypassable too: `POST
/api/auth/signin/resend` reaches Auth.js's `sendToken` **directly**, skipping the server action —
`proxy.ts:65` excludes `api/auth` from the matcher, and CSRF is no barrier (`GET /api/auth/csrf`
hands out a valid token + cookie). Two curl calls send a magic link with no Turnstile, honeypot,
or dwell check. Task 2's gate only exercises the form path, so it goes green while the raw
endpoint stays open.

**Fix:** verify Turnstile in the Resend provider's **`sendVerificationRequest`** (`src/auth.ts:93`)
— per `web.js:44-52`, `toRequest` hands it the serialized body, so it's the one point inside
`@auth/core` that sees the token *and* is reached by every entry path. Return early (don't throw —
a throw surfaces as `Configuration`). Accept the residual that a `VerificationToken` row is still
written. Then **close the raw endpoint**: the server-side `signIn()` calls `Auth(req, …)`
in-process (`next-auth/lib/actions.js:43`), so `POST /api/auth/signin/*` over HTTP carries no
legitimate traffic — 404 it in `src/app/api/auth/[...nextauth]/route.ts` before delegating. Add a
gate: curl the raw endpoint, assert no email sent.

## D2 — There are THREE anonymous magic-link send call sites, not one · CRITICAL

Task 2 scopes the widget to "the magic-link form" (one form). There are three callers of the
send path:
1. `SignInForms.tsx` `emailForm()` (lines 147-167) — the R11/C1 form Task 2 assumes.
2. `SignInForms.tsx:191-196` — the **B1 "Resend" button**, a *separate hand-rolled* `<form
   action={resendAction}>`, not produced by `emailForm()`.
3. `FieldGuideDownload.tsx:140` — the **/library lead-magnet modal**, which calls
   `signIn("resend", …)` from `next-auth/react`, POSTing straight to `/api/auth/signin/resend` —
   a different transport that never touches `resendAction` at all.

With Layer 0 fail-closed, sites 2 and 3 ship tokenless → **denied 100% of the time**. That kills
the Resend affordance and the **entire signed-out Field Guide capture** — which memory records as
the per-cluster conversion path the campaign points at. No gate in the plan exercises either.

**Fix:** enumerate all three call sites in Task 2; place a widget on each (Cloudflare tokens are
single-use, 300s TTL, so the B1 button needs its own widget with `refreshExpired: "auto"`, not a
carried-over token). For the modal, the widget lives in `LeadMagnetModal` and the token passes
through `signIn("resend", { email, "cf-turnstile-response": token, … })` (react.js:159 spreads
params into the body → reaches `sendVerificationRequest`). Add a per-call-site preview gate.

## D3 — The lead magnet reports "sent" on a denial (silent failure on the money path) · CRITICAL

`FieldGuideDownload.tsx:140-141` is `await signIn("resend", { …, redirect: false }); setState("sent")`
— the return value is discarded and `"sent"` is unconditional. With `redirect: false`, `signIn`
**does not throw** on a callback-redirect denial: it returns `{ error, ok: true, url }` (react.js:174-185),
because `@auth/core` serves a string-return redirect as **HTTP 200** (`init.js` default redirect
makes the URL absolute so `new URL()` succeeds). So the plan's `RATE_LIMITED_REDIRECT` →
`{ error: "rate_limited", ok: true }` → the modal renders **"Your guide is on the way / we emailed
a link"** for an email that was never sent. Latent today (the only send-step denial,
`SESSION_CONFLICT_REDIRECT`, is unreachable from the signed-out modal); **the plan makes it live.**

**Fix:** capture the result — `const res = await signIn(…); if (res?.error) { setState("error"); return; }`.
Do **not** branch on `res.ok` (200 on denial → `ok` is true); `error` is the only truthy signal.
Add distinct denial copy. Gate: trip the limiter, submit the modal, assert it does **not** say "on
the way."

## D4 — `timeout: 1000` silently ALLOWS on a slow Redis; the degradation ladder never runs · CRITICAL

`@upstash/ratelimit@2.0.8`'s timeout (`dist/index.mjs` `applyTimeout`) **resolves**
`{ success: true, limit: 0, remaining: 0, reset: 0, reason: "timeout" }` — it never throws or
rejects. So a genuinely slow/hanging Upstash returns `success: true` → `enforce` returns `{ok:true}`
→ **ALLOW**. The mandatory try/catch and the whole 4-step degradation ladder never execute. This is
the *complementary* hazard to the already-known rejection path (which the plan handles correctly via
`retry: {retries:1, backoff:()=>200}`): a rejection lands ~200ms and is caught; a **hang** hits the
1000ms timer and fails open. This is exactly the Stalloris "make the limiter slow" technique the
design cites in §6 to justify *not* failing open. Task 4's test ("hang → degrades") asserts behavior
the library cannot produce, so it passes while production allows.

Related minor (`timeout-vs-retry-rule-inverted`): the Task 4 comment "`timeout` must stay below
total retry backoff" is **inverted** — the config correctly has timeout (1000) *above* the retry
budget (~200), and the comment tells you to break it.

**Fix:** treat `res.reason === "timeout"` as an infrastructure failure, not a verdict — after every
`await rl.limit(key)`, `if (res.reason === "timeout")` route it into the same degradation ladder as
a thrown error, *before* reading `res.success`. Rewrite the Task 4 test: a `reason:"timeout"`
response must degrade, never yield `{ok:true}` on Tier 1. Fix the inverted comment.

## D5 — Gmail sub-addressing defeats the entire per-email layer · CRITICAL

Task 3's `emailKey` **deliberately** refuses to normalize `+suffix`/dots, on a rationale that is
factually wrong for bombing: `victim+1@gmail.com … victim+9999@gmail.com` and
`v.i.c.t.i.m@gmail.com` all deliver to one inbox (Google docs confirm), and `@auth/core`'s
`defaultNormalizer` preserves `+` and `.`. So they are thousands of **distinct** `emailKey` values,
each with its own 1/60s + 5/hr + 15/day budget → the per-email cap (the primary victim protection)
is bypassed up to the global cap, ~**33×**, against the harm the design names as primary. My own
dismissal comment was the bug.

**Fix:** canonicalize the **key only** (not the delivered address — Auth.js normalized that, and the
send must keep the raw address). Strip `+…` for all domains; additionally strip `.` for
gmail/googlemail; extend to documented providers (outlook/hotmail/icloud/fastmail `+`, yahoo `-`).
The "false-positive rabbit hole" objection doesn't apply to a counter key — worst case is one extra
60s wait. Tests: the aliases collapse; a non-Gmail dotted address does not.

## D6 — `ephemeralCache` cannot be the degradation substrate (the whole degrade-don't-disable policy rests on a Map that's empty during an outage) · MAJOR

Design §6 / Task 4 step 1 degrade to "the in-process `ephemeralCache` coarse limit." But
`ephemeralCache` is **not a counter** — it's a block-list memo (`identifier → reset`) written
**only after a successful Redis round-trip returned `success:false`** (`dist/index.mjs`
slidingWindow l.1571-1584: the `blockUntil` call is after `await safeEval`). When Upstash is
unreachable, `safeEval` rejects, no cache write ever happens, the Map is **empty**, and ladder step
1 is a no-op. The "coarse per-instance limit" that makes degradation tolerable **does not exist.**

**Fix:** either implement a real in-process counter in `abuse-limit.ts` (module-scope
`Map<string,{count,resetAt}>` incremented in the catch/timeout branch) and make *that* the coarse
limit, or drop the claim and restate the ladder honestly ("honour prior confirmed blocks →
circuit-break → escalate to deny"), accepting that nothing bounds sends between outage-start and
escalation.

## D7 — `magic:global:day: 500` is an unsourced, attacker-triggerable, un-raisable kill switch · CRITICAL/MAJOR

Three problems in one rule:
- **Unsourced.** Every other rule cites a provider; this one cites nothing — invented by the impl
  plan four lines under its own comment "Limits are SOURCED, not invented." Design §5 says only "a
  fixed daily ceiling"; the survey it draws on spans 5/day → 720/day (144× range), so 500 has no
  basis. **500 sends/day during a paid campaign is a success condition, not an attack.**
- **A free DoS button.** One shared hard-deny counter: exhaust it (500 POSTs from one IPv6 /64 to
  the bypassable raw endpoint, D1) → *every* legitimate magic-link signup gets `?error=rate_limited`
  for a 24h sliding window — including the lead magnet.
- **Un-raisable at 3am.** Hardcoded + asserted by a test, so lifting it needs a code edit, a test
  edit, and a deploy. And the Task 5 banner ("wait a few minutes") is false for a 24h window.
- **Consumption order is load-bearing (undocumented).** `limit()` burns each counter as called, so
  if `global:day` runs before `ip:hour`, about-to-be-denied requests still spend global quota —
  dropping attack cost from ~10 hosts to 1.

**Fix:** make it env-overridable (`MAGIC_GLOBAL_DAILY_CAP`, following the `REACTIVATION_DAYS` /
`LAUNCH_WINDOW_DAYS` precedent), test the default not the resolved value. Split soft (alert +
escalate Turnstile to interactive, don't deny) from hard (deny, set well above forecast campaign
volume with the arithmetic shown). Order `global:day` **last** and document the consumption
semantics; test that an earlier denial leaves the global counter unincremented. Alert at 80%.

---

## Cross-cutting lesson

D1–D3 all trace to one root the v2 design got wrong: it treated **the `signIn` callback as the
single choke point**, but (a) the callback can't see the token, and (b) there are **three send
call sites on two transports** (`resendAction` server action + `next-auth/react` client POST), one
of which is the campaign's own conversion path. The choke point is correct for the *rate limiter*
(which keys on `user.email`, which the callback does get) but **wrong for Turnstile** (which needs
the body) and **blind to the lead-magnet modal**. Any correction has to map all three call sites
first.

---

# Second pass — single-agent loop to dry (2026-07-17)

Six rounds, one agent per round, sequential, run until a round returned zero new material
findings. Round 6 confirmed convergence. 13 further defects; the important ones showed the
Part-1 *fixes* were mutually contradictory, and the loop derived the architecture that
reconciles them (§ Converged architecture, below).

## N1 — Preview and Production share one Upstash DB / static prefixes · MAJOR
`otd-academy-ratelimit` is connected to Production **and** Preview with the same
`KV_REST_API_*`, and Task 4's prefixes (`otd:magic:email:hour`, …) carry **no env component**
→ Preview and Prod share every counter, including the 24h `magic:global:day`. The Task 5
correctness gate *deliberately trips limits on a preview deploy* → pollutes prod; any preview
URL can drain prod's global cap. **Contradicts design §9's own reason for excluding
Development** ("must not share a security control's counters with production"). **Fix:**
namespace prefixes by `process.env.VERCEL_ENV`.

## N2 — `clientIp` keys on the full IPv6 address → free /64 rotation · MAJOR
The per-IP rule keys on the full address; an IPv6 host controls a **/64 (2⁶⁴ addrs)** and
rotates for free, so `magic:ip:hour` protects nothing against IPv6. With D5 (email alias
bypass) this collapses the composite onto `magic:global:day` (itself D7). No gate catches it —
Task 5 tests the *email* key "from a different IP," never IP rotation. **Fix:** normalize IPv6
to /64 (or /56) before keying; `waitlist:ip` uses the same helper and gets fixed with it.

## N3 — dwell-timer rejects the app's own fast paths · MINOR
"reject a submit < ~2s after mount … costs an honest user nothing" is false for the C1
one-click welcome-back (`SignInForms.tsx:211-254`), the B1 Resend button (`:191-196`), and the
reopened lead-magnet modal. **Fix:** measure dwell from first interaction, exempt pre-filled
fast paths, or drop dwell and rely on Turnstile + honeypot.

## R2-1 / F1 — D1's "404 the raw endpoint" breaks the lead-magnet modal (all 3 buttons) · CRITICAL
D1 justified 404-ing `POST /api/auth/signin/*` by "carries no legitimate traffic" — true only
for the *page* (server actions, in-process `Auth(req)`). The **modal uses the `next-auth/react`
client transport**: `FieldGuideDownload.tsx:140/248/255` POST resend **and** google/github to
`/api/auth/signin/{provider}` over HTTP. A blanket 404 kills all three modal buttons — the
campaign's conversion path — and **contradicts D2**, whose fix routes the modal token *through*
that endpoint. The Task 5 "Google still works" gate tests the *page* button (immune by
construction), so the breakage ships green. **Fix:** see § Converged architecture (the modal
moves off the client transport entirely).

## R2-2 — D1's "return early, don't throw" reproduces D3's silent-"sent" · MAJOR
A clean early return from `sendVerificationRequest` yields the normal verify-request redirect
with **no `?error=`**, indistinguishable from a real send → the modal says "your guide is on the
way." D3's `res.error` check can't see it. Fails on every Cloudflare hiccup (Turnstile is
fail-closed). **Fix:** throw a **plain `Error`** (→ `?error=Configuration`), never return early
— see § Converged architecture, which proves this is the *only* signal that surfaces.

## R2-3 — four new env vars, no cross-field validation · MAJOR
`KV_REST_API_URL`/`_TOKEN` + `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are each
independently `.optional()`; `src/env.ts` has no `superRefine`. Unsafe partial states: SITE set +
SECRET unset → widget renders but the verifier waves everyone through (silent-off); SECRET set +
SITE unset → no widget → everyone denied; half-set KV → 401 every call → constant degradation.
**Fix:** `superRefine` — each pair both-set-or-both-unset, fail the build otherwise. Or resolve
one `turnstileEnabled` boolean gating both widget and verify.

## R2-4 / enforce-before-turnstile — ordering inverts §7 · MAJOR
Design §7 requires "Turnstile before the limiter, pre-send." But `enforce` in the callback runs
**before** `sendVerificationRequest` (Turnstile) — `send-token.js:23` then `:48`. A bot with a
garbage token still burns the victim's `magic:email:*` counters *before* Turnstile blocks the
send → **targeted lockout that weaponizes the per-email limit against the victim it protects**
(design §11.5's own principle). **Fix:** run Turnstile **then** enforce, in one locus — see
below.

## P1 — the F2 pivot double-runs both checks · CRITICAL
Putting Turnstile + `enforce` in the modal's server action, on top of D1 (Turnstile in
`sendVerificationRequest`) and Task 5 (`enforce` in callback), runs both **twice** per modal
send: the single-use Turnstile token's 2nd verify fails, and the 2nd `enforce` increments
`burst:1/60s` to 2 → denies. **Every modal send dies.** **Fix:** exactly one locus; server
actions are thin pass-throughs that verify nothing themselves.

## P2 — `callbackUrl` → `redirectTo` on the server-`signIn` port · MEDIUM
Client `signIn` uses `callbackUrl`; server `signIn` uses `redirectTo` and *overwrites* a stray
`callbackUrl`. Porting the modal without the rename discards `/welcome?fg=<guide>` → the reader
gets the **generic** email and wrong landing (`guideFromWelcomeUrl`, `src/auth.ts:99-103` sees
nothing). tsc-clean, vitest-blind. **Fix:** `redirectTo: fieldGuideWelcomePath(guide)`.

## P3 — honeypot server-read location unspecified · LOW
The honeypot + dwell fields are named with tests, but no doc says *where* the server reads them.
**Fix:** pin the read to the single locus (below) when the call sites are enumerated.

---

# Converged architecture (build from THIS)

The loop's decisive result. The rate limiter and Turnstile were split across two `@auth/core`
callbacks that run in a fixed order, which is the root of D1/R2-4/P1/F2/enforce-before-turnstile.
**Both belong in one place**: the Resend provider's **`sendVerificationRequest`** (`src/auth.ts:93`)
is the single locus that has *both* the normalized email (`identifier`, `send-token.js:49`) *and*
the token body (via `toRequest`, `web.js:44-52`). Verified coherent against installed source on
round 6.

**1. One locus — `sendVerificationRequest` — does, in order:**
   a. read the Turnstile token via `await request.json()` (NOT `request.formData()` — `toRequest`
      JSON-stringifies the body but leaves a stale `x-www-form-urlencoded` content-type);
   b. verify Turnstile → on fail, **throw a plain `Error`**;
   c. run `enforce()` (Turnstile-first, so a bot never drains the counters) → on deny, **throw a
      plain `Error`**;
   d. else send the Resend email.

**2. Why "plain `Error`" is load-bearing (proved round 5-6):** under a server-action send
   (`Auth(req, { raw, skipCSRFCheck })`, `redirect:false`), a plain `Error` is NOT an `AuthError`,
   so `index.js:124`'s re-throw is skipped; it becomes `?error=Configuration` on the returned URL,
   which the thin pass-through reads. An `AuthError` subclass would re-throw → 500. An early return
   → silent "sent" (R2-2). A success returns `/verify-request?...` with no `error` — a clean
   discriminator. `Configuration` is overloaded with genuine config faults (unavoidable — it's the
   only code a plain throw yields); the page maps it to generic copy.

**3. The `signIn` callback does NO abuse work** — only the existing `resolveSignIn`
   session-conflict logic. Its string-return short-circuits *before* `sendVerificationRequest`
   (`send-token.js:34`), so the two are sequential and non-interacting. OAuth (Google/GitHub)
   never reaches `sendVerificationRequest` and is fully untouched.

**4. Modal + page send ONLY via server actions** (thin pass-throughs forwarding
   `email` + `cf-turnstile-response` + honeypot + `redirectTo`). The modal **abandons
   `next-auth/react` `signIn`** for `resend`/`google`/`github` — all three become server actions
   (in-process `Auth(req)`, never HTTP). That collapses the modal onto the page's transport, at
   which point 404-ing the raw `POST /api/auth/signin/*` genuinely breaks nothing (OAuth
   *callbacks* `GET /api/auth/callback/*`, `csrf`, `session`, `signout` stay open). Denials are
   surfaced by inspecting the returned URL for `?error=`; generic copy (no enumeration).

**5. The rest of the corrected knobs (unchanged by the consolidation):** env cross-validation
   (R2-3); `emailKey` alias/dot normalization (D5); `clientIp` IPv6 /64 (N2); env-namespaced
   prefixes (N1); `magic:global:day` env-overridable + soft/hard split, ordered last with
   documented consumption semantics (D7); Upstash `reason:"timeout"` treated as degrade not allow
   (D4); a real module-scope in-process counter for degradation, since `ephemeralCache` is empty
   during an outage (D6).

**Build note (not a defect):** `sendVerificationRequest` reads the body with `await request.json()`.

## Still genuinely uncovered (cheap manual look, NOT another agent run)
Denial instrumentation / alerting; a runtime kill switch; Turnstile privacy-policy disclosure
(GDPR/CCPA — Cloudflare third party); IP-as-PII retention in Redis; whether Tier 2/3 earn their
complexity. None block the architecture above.
