# Signup abuse defense — implementation plan

> **Build from `2026-07-16-signup-abuse-defense-design.md`** (validated to dry). Every "why" lives
> there; this file is the "how", one task per commit. The `VALIDATION-FINDINGS` doc is the audit
> trail. **Do not build from the v1 `rate-limiting-design.md`** (refuted) or the pre-rewrite plans.
>
> **REQUIRED SUB-SKILL:** work this with `superpowers:executing-plans` — batch the tasks, review
> between batches. TDD each pure module (`superpowers:test-driven-development`).
>
> **Tech basis (verified against installed source):** `next-auth@5.0.0-beta.31` → `@auth/core@0.41.2`
> · `@upstash/ratelimit@2.0.8` / `@upstash/redis@1.38.0` (to install) · `@vercel/edge-config` (to
> install) · Next 16. Upstash `otd-academy-ratelimit` + Cloudflare Turnstile keys are **provisioned
> and inert** (design §12.3). An **Edge Config store is NOT yet provisioned** (Task 8) — until it is,
> `defenseEnabled` reads absent → **enabled** (fail-safe-on), so the build works without it; the
> store only lets you flip defense OFF at runtime.

## Order, and why

**Turnstile (Layer 0) ships before the limiter** (design §3, §9): it is the primary control and the
only one that survives an Upstash outage. `/privacy` ships **before** the Turnstile widget (a
pre-consent third party needs the disclosure live first, design §11). The "surfacing foundation"
(T3) is shared machinery both Turnstile *and* limiter denials ride on, so it precedes T4.

| Task | Deliverable | Gate |
| --- | --- | --- |
| 1 | Env + deps + `superRefine` cross-field validation | `tsc`, build green with all vars unset |
| 2 | `/privacy` disclosure page + links (sign-in, modal, footer) | renders, linked; live before T4 |
| 3 | Surfacing foundation: modal→server actions, redirect-mode split, `pages.error`, 404 raw endpoint | preview: page/modal/OAuth resolve; raw POST 404s |
| 4 | **Turnstile Layer 0** — verifier + widget ×3 + honeypot + dwell | preview: bot/token-less rejected; browser + OAuth pass |
| 5 | Pure policy module (keys, rules) + tests | `vitest` |
| 6 | Limiter shell `enforce(checks, failMode)` + tests | `vitest` (mocked failure modes) |
| 7 | Wire the locus + IP pre-check + `defenseEnabled` (+ provision Edge Config store) | preview: 6th bounces, IP-rotation capped, OAuth works, no false "sent", kill-switch flip |
| 8 | Observability layer + `turnstileInteractive` flag | preview: denial → event; breaker → alert |
| 9 | Tier 2: `joinWaitlist` + guest `createTipCheckout` | `vitest` + click-through |
| 10 | Tier 3 deferral note (corrected 5-surface inventory) | — (doc) |
| 11 | Docs + memory + CLAUDE.md traps + retention/DPA + final numbers | — |

Indicative parameter values are in the design's **Parameters** table; final tuning happens as each
task lands.

---

## Task 1 — env + deps + cross-field validation

**Files:** `src/env.ts`, `.env.local.example`, `package.json`

```bash
pnpm add @upstash/redis @upstash/ratelimit @marsidev/react-turnstile @vercel/edge-config
```

`src/env.ts` — **all OPTIONAL** (the `STRIPE_SECRET_KEY` / `R2_*` precedent — a keyless build/CI must
pass), but with a **`superRefine`** enforcing each pair both-set-or-both-unset:

```ts
// server block
KV_REST_API_URL: z.url().optional(),
KV_REST_API_TOKEN: z.string().min(1).optional(),          // the WRITE token — READ_ONLY cannot INCR
TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
MAGIC_GLOBAL_DAILY_CAP: z.coerce.number().int().positive().optional(),  // hard cap; default in policy
EDGE_CONFIG: z.string().min(1).optional(),                // Vercel-injected when a store is connected
// client block
NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
```

`superRefine`: `KV_REST_API_URL` ⇔ `KV_REST_API_TOKEN`; `TURNSTILE_SECRET_KEY` ⇔
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Each pair both-or-neither, else **fail the build** (design §12.2,
R2-3). Add all keys to `runtimeEnv` (the file lists every key explicitly) and to
`.env.local.example` with the design's comments (UNSET IN PROD = UNPROTECTED; Layer 0 is what keeps
that non-fatal). **Also add a production boot-warn:** when `process.env.VERCEL_ENV === "production"`
and neither defense pair is configured, `console.warn` once at startup — WARN, not throw (a keyless
preview/CI must pass). Design §12.2's safety net.

**Gate:** `pnpm exec tsc --noEmit` clean; `pnpm exec next build` green with all vars unset; the
`superRefine` rejects a half-set pair (a throwaway test or a manual check).

---

## Task 2 — `/privacy` disclosure page + links

**Files:** `src/app/(bare)/privacy/page.tsx` (new — `(bare)` has no auth gate),
`src/components/chrome/AppFooter.tsx`, `src/app/(bare)/sign-in/page.tsx`,
`src/components/library/FieldGuideDownload.tsx`

Art. 13 **disclosure, NOT a consent banner** (design §11). Cover: controller; **legitimate-interest**
basis (fraud prevention, "strictly necessary"); data categories (IP/UA/TLS via Turnstile; HMAC'd
email+IP counters via Upstash); recipients (**Cloudflare, Upstash**); retention (= the rule TTLs,
§7); US-transfer basis. **Do NOT** add a consent banner or enable Turnstile Pre-Clearance (sets a
cookie). Link `/privacy` from **sign-in, the lead-magnet modal, and the footer**.

Use `otd-content-writing` (voice) + `otd-frontend-design` (pixels). This must be **live before Task
4** ships the Turnstile widget.

**Gate:** page renders in both themes; the three surfaces link to it. Retention wording is
placeholder-OK here (finalized in Task 11).

---

## Task 3 — surfacing foundation (shared denial plumbing)

**Files:** `src/auth.ts` (`pages.error`), `src/lib/actions/magic-link.ts` (new — the modal's server
actions), `src/app/(bare)/sign-in/page.tsx`, `src/components/library/FieldGuideDownload.tsx`,
`src/components/auth/SignInForms.tsx`, `src/app/api/auth/[...nextauth]/route.ts`

No abuse checks yet — this lands the machinery both Turnstile (T4) and the limiter (T7) denials
surface through (design §5, §6, §4.4).

1. **`pages.error = "/sign-in"`** in `auth.ts` (currently unset — [`src/auth.ts:259`](../../src/auth.ts#L259)).
2. **Sign-in page: `Configuration` + `rate_limited` error branches** → **generic, identical** copy
   (no enumeration): *"Too many sign-in requests. Wait a few minutes, or use Google/GitHub."* Add an
   unknown-code → generic default so any denial maps safely. No collision with `verifyRequest`
   (Auth.js appends `?provider=…&type=email`).
3. **Modal off `next-auth/react`.** `FieldGuideDownload.tsx` is `"use client"` and calls
   `signIn("resend"/"google"/"github", …)` from `next-auth/react` ([:140/:248/:255]). Replace with
   **server actions in a new `"use server"` module** — `src/lib/actions/magic-link.ts` (a client
   component cannot define server actions inline) — that call server `signIn`; the client imports
   and invokes them:
   - `resend` (magic-link): **`redirect: false`**, set **`redirectTo: fieldGuideWelcomePath(guide)`**
     (client `callbackUrl` → server `redirectTo`, P2), then **inspect the returned URL string for
     `?error=`** — key off the parsed `?error=`, **never** `res.ok`/truthiness (status is 200 on
     denial — D3, verified). No `?error=` → "sent".
   - `google`/`github` (OAuth): **`redirect: true`** (transfer the browser; under `redirect:false` an
     OAuth `signIn` returns the provider URL and inspection dead-ends — design §5).
4. **B1 Resend button** (`SignInForms.tsx:191-196`) stays a `redirect:true` server-action form.
5. **404 the raw endpoint.** In `route.ts`, `POST /api/auth/signin/*` carries no legitimate traffic
   once the modal is off the client transport → return 404 before delegating. Keep `GET
   /api/auth/callback/*`, `csrf`, `session`, `signout` open.

**Field-forwarding seam (the D1/D3 fix, extended in Task 4):** the modal + page + B1 server actions
pass their fields as **extra `signIn("resend", { … })` options** — `email` + `redirectTo` now, and
(Task 4) `cf-turnstile-response` + honeypot + dwell. `@auth/core` spreads those options into the
request body (`toRequest`), so the locus reads them via `request.json()`. This is the only path the
token takes to the locus — name it now so Task 4 has a seam to fill.

**Gate — preview:** modal `resend` still sends on the happy path and lands the field-guide welcome;
modal `google`/`github` transfer to the provider; page + B1 unaffected; **raw `POST
/api/auth/signin/resend` → 404** (curl); a forced `?error=Configuration` shows generic copy on the
page. (Full denial surfacing is exercised in T4/T7.)

---

## Task 4 — Turnstile (Layer 0). SHIP THIS FIRST of the controls.

**Files:** `src/lib/turnstile.ts` (new) + tests, `src/components/auth/SignInForms.tsx`,
`src/components/library/FieldGuideDownload.tsx`, `src/lib/actions/magic-link.ts` +
`src/app/(bare)/sign-in/page.tsx` (add `cf-turnstile-response` + honeypot + dwell to the forwarded
`signIn` options — the Task-3 seam), `src/auth.ts` (`sendVerificationRequest`)

`src/lib/turnstile.ts` — plain module, one async verifier:

```ts
// Layer 0 (design §9). FAIL CLOSED on any error, deliberately. Google/GitHub never reach this.
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean>
```

- No `TURNSTILE_SECRET_KEY` → return `true` + log once (keyless CI/local must pass).
- POST `token` + `remoteip` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- **Explicit ~2 s timeout** (`AbortController`): a *hang* is not a "verification error", so without a
  timeout a slow Cloudflare blocks unboundedly and never fails closed. On timeout **or** throw →
  return `false`. This 2 s is separate from the §8.1 Upstash budget.

**In `sendVerificationRequest`** (the single locus, [`src/auth.ts:93`](../../src/auth.ts#L93)) —
destructure `request`, then in order (design §4.1):

```ts
const body = await request.json();          // NOT formData() — stale content-type
// honeypot + dwell → throw plain Error on trip (Layer-0 denials; NEVER early-return → silent "sent")
// verifyTurnstile(body["cf-turnstile-response"], null) → false → throw new Error("...")  (→ ?error=Configuration)
//   pass null for ip until Task 5 provides clientIp() (Cloudflare remoteip is optional)
// (enforce() step is added in Task 7)
// else: existing branded-email send, unchanged
```

**Widgets + honeypot/dwell** on all three send surfaces (design §9, D2):
- Page magic-link form + **B1 Resend** (its own widget — tokens are single-use, 300 s TTL;
  `refreshExpired: "auto"`, fresh token per resend) + **lead-magnet modal** (fresh token per reopen).
- **Honeypot**: hidden field a human never fills. **Dwell**: minimum form-dwell **from first
  interaction, not mount**; **exempt the fast paths** (C1 welcome-back, B1, reopened modal), which a
  mount timer wrongly rejects (N3). Both fields ride the request body to the locus (forwarded by the
  thin server actions — design §4.4).

**Tests (`turnstile.test.ts`):** missing secret → true + logs once; valid → true; invalid → false;
network throw → false; **timeout → false**; honeypot filled → reject; dwell < threshold → reject.

**Gate — preview:** token-less / JS-disabled POST → rejected (throws → generic copy, not "sent");
raw `POST signin` still 404; real browser submit passes; **OAuth transfers throughout**; widget on
all three surfaces; a Turnstile-failed **modal** send does **not** say "on the way".

---

## Task 5 — pure policy module

**Files:** `src/lib/abuse-policy.ts` (new) + `src/lib/__tests__/abuse-policy.test.ts` (new)

Mirrors `resolveSignIn` / `resolveRouteGate`: **pure, no I/O, fully unit-tested.**

```ts
export const RULES = {
  "magic:email:burst": { limit: 1,  window: "60 s" },   // Supabase cooldown
  "magic:email:hour":  { limit: 5,  window: "1 h" },    // Cognito ResendConfirmationCode
  "magic:email:day":   { limit: 15, window: "24 h" },
  "magic:ip:hour":     { limit: 50, window: "1 h" },    // Auth0 /passwordless/start (callback pre-check)
  "magic:global:day":  { limit: () => env.MAGIC_GLOBAL_DAILY_CAP ?? 2000, window: "24 h" }, // ORDERED LAST
  "waitlist:ip:hour":  { limit: 20, window: "1 h" },
  "tip:ip:hour":       { limit: 10, window: "1 h" },
} as const;

// Key transform order is LOAD-BEARING (design §7.1–7.2): normalize-alias → IPv6 /64 → HMAC-last.
export function emailKey(email: string): string;   // strip +suffix (all); strip dots (gmail); provider table
export function clientIp(h: Headers): string | null; // x-vercel-forwarded-for → x-forwarded-for, first hop; IPv6 → /64
export function hmacKey(normalized: string): string; // HMAC-SHA256 pinned to env.AUTH_SECRET (reuse capture-token.ts)
export function nsPrefix(rule: RuleName): string;    // `otd:${process.env.VERCEL_ENV}:${rule}` (N1)

export type Check = { rule: RuleName; identity: string };  // identity already HMAC'd
export function magicLinkChecks(rawEmail: string): Check[]; // RAW email in; applies emailKey→hmacKey internally. email burst/hour/day + global (NOT ip — that's the callback pre-check)
export function ipOnlyCheck(ip: string | null): Check | null; // magic:ip:hour; null when ip unknown (local dev)
```

- `emailKey`: strip `+…` for all domains; strip `.` for gmail/googlemail; extend to
  outlook/hotmail/icloud/fastmail (`+`), yahoo (`-`) (D5). Canonicalizes the **key only**.
- `clientIp`: IPv6 → **/64** (N2); trusted on Vercel only (design §13).
- `hmacKey`: HMAC (not plain SHA — reversible), key = `env.AUTH_SECRET` (deterministic, no per-instance
  salt — hmac-key-unprovisioned). **Applied last**, after alias/IPv6 normalization.
- `nsPrefix`: namespace by `VERCEL_ENV` so Preview cannot drain Prod's counters (N1).

**Tests:** aliases collapse (`v+1@gmail`, `v.i.p@gmail` → one key); a non-Gmail dotted address does
**not** collapse; IPv6 /64 (two addresses in one /64 → one key); `hmacKey` deterministic + differs
across secrets + never equals plaintext; `nsPrefix` carries `VERCEL_ENV`; `RULES` numbers match the
design table (guard against silent "tidying"); `magicLinkChecks` omits the IP rule; `magic:global`
resolves the env override but the test asserts the **default**.

---

## Task 6 — the limiter shell + tests

**Files:** `src/lib/abuse-limit.ts` (new) + `src/lib/__tests__/abuse-limit.test.ts` (new)

**A PLAIN module — never `"use server"`** (a `"use server"` file may export only async functions;
`export const ratelimit = …` there crashes at runtime, **tsc silent** — use-server-export rule).

```ts
const redis = new Redis({
  url: env.KV_REST_API_URL!, token: env.KV_REST_API_TOKEN!,   // WRITE token
  retry: { retries: 1, backoff: () => 200 },                  // default 5 retries ≈ 4290ms would beat the timer
});
// module-scope: real in-process counter (degradation), rolling-rate breaker state, half-open state
const coarse = new Map<string, { count: number; resetAt: number }>();
const breaker = /* rolling window of {ts, ok} — failure RATE, min-sample (design §8.1 + Parameters) */;

export type Verdict = { ok: true } | { ok: false; rule: RuleName | "degraded" };
export type FailMode = "escalate-closed" | "open";

/** Runs each check SEQUENTIALLY (ordered — global consumed last, design §7.3), first denial wins.
 *  On infra failure OR res.reason==="timeout": DEGRADE per failMode. NEVER throws, NEVER silently
 *  allows on Tier 1. The CALLER decides how to surface a Verdict (locus throws; IP pre-check returns
 *  a string) — this returns data. */
export async function enforce(checks: Check[], failMode: FailMode): Promise<Verdict>;
```

Ladder in the catch / on `reason:"timeout"` (design §8.1):
1. `reason:"timeout"` is a **degrade signal, not a verdict** — route it in **before** reading
   `res.success` (D4).
2. **Rolling failure-RATE breaker** over a window with a **minimum in-window sample size** (not a
   consecutive count; not 50%-of-2). Past threshold → open → fast-fail (skip Redis for a cooldown).
3. `failMode==="open"` → `{ok:true}` (Tier 2/guest-tip). `failMode==="escalate-closed"` → brief
   bounded **allow-grace** (in-process `coarse`), then `{ok:false, rule:"degraded"}` (Tier 1).
   **State plainly: no per-instance count bounds aggregate sends** (D6, coarse-counter-unbounded).
4. **Explicit half-open probe** with a wall-clock bound → success closes, failure re-opens.
5. `capture()` + `console.error` every degradation and trip (Task 8 owns the events).

`timeout: 1000`, `analytics: false` (design §10). Each rule = a `Ratelimit` with its `nsPrefix`,
sharing one `redis` + one `coarse` + one `breaker`. **`magic:global:day`'s `limit` is a `() => number`**
(env-overridable) — resolve it when constructing that rule's `Ratelimit` (`typeof l === "function" ? l() : l`).

**Tests (mock `@upstash/ratelimit`):** first-denial-wins + `rule` named; **`limit()` throws →
degrades, does NOT throw**; **`reason:"timeout"` → degrades, does NOT allow**; env unset → `{ok:true}`
+ logs once; breaker opens after the rate threshold **with min-sample** (not on 1-of-2); half-open
probe closes on recovery; **`failMode:"open"` allows on failure, `escalate-closed` denies after the
grace**; an earlier denial leaves `magic:global` **unincremented** (consumption order).

---

## Task 7 — wire the locus + IP pre-check + the kill switch

**Files:** `src/auth.ts` (locus `enforce` step; callback IP pre-check), `src/lib/abuse-defense-flag.ts`
(new — `defenseEnabled`), `src/lib/auth-link-guard.ts` + its tests

**`abuse-defense-flag.ts`:** `defenseEnabled()` reads the **Edge Config** `defenseEnabled` key
(`@vercel/edge-config`, short timeout); **absent / read failure → `true`** (fail-safe-on). This is the
**one predicate** gating **every** denial point (design §12.1). The literal per-layer rule:
**`deny iff defenseEnabled() && layerConfigured && layerDeny`** — `layerConfigured` = the relevant
env pair present (honeypot/dwell have no pair → implicitly true).

**Provision the Edge Config store HERE** (not Task 8), so gate #8 below is runnable: create it,
connect to `project-foundry` (injects `EDGE_CONFIG`), set `defenseEnabled=true` default. (The
`turnstileInteractive` key + observability wiring stay in Task 8.)

**Locus (`sendVerificationRequest`), after Turnstile (T4).** First **retrofit the Task-4 Layer-0
throws** under the switch — wrap the Turnstile / honeypot / dwell throws in
`if (defenseEnabled() && turnstileConfigured)`; the one predicate must gate EVERY denial point, or
flipping it off leaves Layer 0 denying (design §12.1, gate #8). Then the `enforce` step:

```ts
if (defenseEnabled() && kvConfigured) {
  const v = await enforce(magicLinkChecks(to), "escalate-closed"); // RAW email; email + global (4 checks)
  if (!v.ok) throw new Error("rate_limited");   // plain Error → ?error=Configuration (surfaces under redirect:false)
}
```

**Callback IP pre-check (`signIn`, [`src/auth.ts:136`](../../src/auth.ts#L136)) — gated to the SEND
step so OAuth is untouched:**

```ts
if (account?.provider === "resend" && email?.verificationRequest === true
    && defenseEnabled() && kvConfigured) {
  const { headers } = await import("next/headers");           // dynamic — middleware-bundle rule
  const ip = clientIp(await headers());
  const chk = ipOnlyCheck(ip);
  if (chk) {
    const v = await enforce([chk], "escalate-closed");
    if (!v.ok) return RATE_LIMITED_REDIRECT;                   // = "/sign-in?error=rate_limited" — RETURN, NEVER throw
  }
}
// … existing resolveSignIn …
```

**Load-bearing (verified against `@auth/core@0.41.2` / `next-auth@5.0.0-beta.31`):** the callback IP
denial **returns a string**, never throws — a callback throw → `AccessDenied` → `index.js:124`
**re-throws to a server-action 500** under `raw`. A returned string surfaces as an inspectable
`?error=rate_limited` URL under `redirect:false` (`actions.js:48-54`). The locus, by contrast,
**throws a plain `Error`** → `?error=Configuration`. Both map to the same generic banner (T3).

`auth-link-guard.ts` exports **`RATE_LIMITED_REDIRECT = "/sign-in?error=rate_limited"`** (matching the
existing `SESSION_CONFLICT_REDIRECT` constant). The callback returns that constant directly (the
snippet above) — the IP verdict is resolved in the callback, so no `SignInInput` change is needed.

**Tests:** extend `auth-link-guard.test.ts` — IP-blocked send → `RATE_LIMITED_REDIRECT`; an OAuth
sign-in never runs the IP pre-check; `defenseEnabled` false → never blocks.

**Gate — a PREVIEW DEPLOY (the IP path only exists on a real Vercel edge):**
1. 6 magic links for one address → the 6th bounces (generic copy).
2. Two sends inside 60 s → the 2nd bounces (cooldown).
3. A 7th from a **different IP, same email** → still bounces (proves the email key, not IP).
4. An **IP-rotation flood** (many sends, one IP) → capped by the callback IP check.
5. **Google sign-in works throughout** (proves OAuth is untouched — the CRITICAL fix).
6. Banner copy identical for a real vs non-existent address (no enumeration).
7. A **modal** IP-blocked / rate-limited send does **not** say "on the way" (D3).
8. Flip Edge Config `defenseEnabled=false` → all denials allow, sign-in works with defense off (the
   kill switch covers every denial point).

---

## Task 8 — observability + the Turnstile-interactive flag

**Files:** `src/lib/abuse-observability.ts` (new), the push-alert wiring, the widget's `turnstileInteractive` read

- **Events** (design §10): `capture("magic_link_denied", { rule })`; `turnstile_failed`;
  `honeypot_tripped`; distinct-email-vs-IP ratio. `analytics:false` on the limiter — app `capture()`
  is the source of truth.
- **Push alert:** reuse the `sendSourcingDigest` admin-email-on-threshold pattern; fire on a
  **breaker trip** and the **`magic:global` soft threshold** (80%). Delete any "Upstash spend alert =
  intrusion alarm" notion.
- **Edge Config** (store provisioned in Task 7): add the `turnstileInteractive=false` key and wire
  it into the widget render (**read failure / absent → non-interactive**, the managed default — never
  escalate a legit user on a blip). The soft-breach detector writes it; if unbuilt, the soft cap is
  **alert-only**.

**Gate — preview:** trip a denial → the `capture` event is emitted; force a breaker trip → the alert
fires (or a dry-run logs it); flip `turnstileInteractive` in Edge Config → the widget escalates
without a redeploy (the `defenseEnabled` runtime-flip is proven in Task 7's gate #8).

---

## Task 9 — Tier 2: `joinWaitlist` + guest `createTipCheckout`

**Files:** `src/lib/actions/waitlist.ts` + its form (`WaitlistForm.tsx`), `src/lib/actions/tips.ts`,
`src/lib/__tests__/waitlist-actions.test.ts`

- **`joinWaitlist`:** IP check at the top, **`enforce([...], "open")`** (Tier 2 **fails open** —
  reversible, design §8). **Return shape becomes a union** `{ ok: true } | { ok: false; error: string }`;
  the calling form must render the denial (`WaitlistForm.tsx:41` currently discards the return —
  D3-style false-success risk). IPv6 /64 via the shared `clientIp` helper.
- **`createTipCheckout`** (`tips.ts` — **GUEST-capable**, reclassified Tier-2, design §2): add a
  `tip:ip:hour` check, `failMode:"open"` (a Stripe session is reversible). Anonymous → IP-keyed.

**Gate:** `vitest` with a mocked `next/headers` (specify the mock so the IP rule doesn't silently
no-op); click-through the waitlist denial; a **preview probe** confirms the tip endpoint is reachable
from a public route (server-action dispatch is by global action-ID POST).

---

## Task 10 — Tier 3 deferral note (corrected inventory)

**Files:** a short section in this plan / a follow-up-PR stub. **No enforcement wired** (deferred).

Record the decision + the **corrected five** authenticated (`requireUser`) checkout/portal actions a
single `checkout:user` rule will wrap in the follow-up PR: `createPassCheckoutSession`,
`createUpgradeCheckoutSession`, `createSubscriptionCheckoutSession` (`pass.ts`), `createCheckoutSession`
(`checkout.ts`), `createBillingPortalSession` (`billing.ts`). (`createTipCheckout` is guest → handled
in Task 9, not here.) Rationale for deferral: user-keyed cuid, reversible sessions, no silent-success;
app-limiting is complementary to Stripe's 100 req/s, not this PR's scope.

---

## Task 11 — docs + memory + finalize

- **CLAUDE.md** — add the load-bearing traps: the IP pre-check **returns a string, never throws**
  (`AccessDenied` → 500); the locus **throws a plain `Error`** (never `AuthError`/never early-return);
  `sendVerificationRequest` reads the body with **`request.json()`**; the `Ratelimit`/`Redis`
  instances live in a **plain** module; the `defenseEnabled` **one-predicate** rule; the dynamic
  `next/headers` import. ("use server export" trap already documented.)
- **Memory** — update the `signup-abuse-defense` RESUME-STATE to BUILT.
- **Finalize the deferred numbers** (design "Parameters" + "Still genuinely open"): `/privacy`
  retention wording; confirm the **Cloudflare + Upstash DPAs (Art. 28)**; the final hard-cap + alert
  arithmetic against the real forecast campaign volume.
- **README** — abuse-defense layers in "Notable engineering" only if they earn it.

---

## Verification summary

| Claim | Proven by |
| --- | --- |
| Env pairs both-or-neither | `superRefine` + Task 1 gate |
| Policy numbers match the design | unit test asserts the `RULES` table |
| Aliases/IPv6 collapse; keys HMAC'd | `abuse-policy.test.ts` |
| Limiter never throws / never silently allows | unit: mocked throw + `reason:"timeout"` → degrade |
| `failMode` open vs escalate-closed | unit: fail-open allows, Tier 1 denies after grace |
| Consumption order (global last) | unit: earlier denial leaves global unincremented |
| Turnstile fail-closed incl. hang | unit: timeout → false |
| The email limit binds | **preview**: 6th send bounces from a different IP |
| OAuth untouched (the CRITICAL fix) | **preview**: Google works through a magic-link lockout |
| No false "sent" on the modal | **preview**: modal denial does not say "on the way" |
| No enumeration | **preview**: identical copy for real vs fake address |
| Kill switch covers every denial | **preview**: flip `defenseEnabled` → sign-in works |
| Keyless build passes | `next build` with all vars unset |

**vitest cannot prove the edge-only parts** (real Upstash semantics, the IP header, Edge Config).
Only the **preview-deploy gates** cover those — do not mark Task 4 or 7 done on green unit tests
alone.
