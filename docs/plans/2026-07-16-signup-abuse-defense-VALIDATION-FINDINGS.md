# Signup abuse defense — validation findings (round 2)

> **Salvaged from a multi-agent validation run, 2026-07-16.** The run raised 54 findings over
> 3 rounds and **did not reach a dry pass** — it hit a session rate limit mid-round-3, so ~36
> findings lost their verifiers and the synthesis step never ran. The **18 below are the
> confirmed floor** (≥2 of 3 independent refuters voted them real AND material before the
> cutoff), deduplicated here into **7 distinct defects**. There are almost certainly more in
> the unverified remainder; treat this as necessary, not complete.
>
> **DO NOT BUILD the plan until D1–D5 (critical) are corrected.** Layer 0 — the plan's stated
> primary control — is both unimplementable at the chosen location and bypassable, and the plan
> would break the two conversion paths the ad campaign depends on while silently reporting
> success. Every claim here is against installed source (`@auth/core@0.41.2`,
> `next-auth@5.0.0-beta.31`, `@upstash/ratelimit@2.0.8`).

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

## What is NOT covered here

The run died before verifying ~36 further findings and never synthesized. Unverified topics that
were raised but not confirmed (worth a cheap manual look, not another agent run): denial
instrumentation / alerting, a runtime kill switch, Turnstile privacy-policy disclosure (GDPR/CCPA
— Cloudflare third party), IP-as-PII retention in Redis, preview/prod sharing limiter counters,
the burst rule making Gate 1 unobservable, and whether Tier 2/3 earn their complexity.
