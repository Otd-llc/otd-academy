# Signup abuse defense — implementation plan

> ## ⚑ DO NOT BUILD YET — 5 CRITICAL defects confirmed 2026-07-16.
> See `2026-07-16-signup-abuse-defense-VALIDATION-FINDINGS.md` (D1–D7). Most touch THIS file:
> Task 2 covers only 1 of 3 send call sites (D2); Task 4's `timeout` config silently allows and
> its hang-test is impossible (D4); Task 3's `emailKey` is Gmail-alias-bypassable (D5) and its
> `magic:global:day` is unsourced + un-raisable (D7); Task 5's callback choke point can't read
> the Turnstile token (D1) and its denial path lies to the lead-magnet modal (D3). Correct those
> before executing any task.


> Design: **`2026-07-16-signup-abuse-defense-design.md`** — read it first. Every "why" lives
> there; this file is the "how", one task per commit.
>
> **REQUIRED SUB-SKILL:** use `superpowers:executing-plans` to work this task-by-table.
>
> **Do not build from `2026-07-16-rate-limiting-design.md` (v1).** It is superseded and its
> central calls were refuted.

**Tech basis (verified, not assumed):** `next-auth@5.0.0-beta.31` → `@auth/core@0.41.2` ·
`@upstash/ratelimit@2.0.8` · `@upstash/redis@1.38.0` · Next 16.2.6 · Upstash resource
`otd-academy-ratelimit` live, env `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Preview+Production).

## Order, and why this order

**Task 2 (Turnstile) ships before Task 5 (the limiter).** Layer 0 is the primary control and
the only one that survives an Upstash outage (design §3, §7). If we run out of time, the thing
that must be live before the campaign is bot detection — not rate limiting.

| Task | Deliverable | Gate |
| --- | --- | --- |
| 1 | Env vars + deps | `tsc`, build green with vars unset |
| 2 | **Turnstile on the magic-link form** (Layer 0) | preview deploy: bot-less POST rejected |
| 3 | Pure policy module + tests | `vitest` |
| 4 | Redis client + limiter shell + tests | `vitest` (mocked failure modes) |
| 5 | Wire the `signIn` callback + banner | preview deploy: 6th send bounces |
| 6 | Tier 2 (`joinWaitlist`) | `vitest` + click-through |
| 7 | Docs + memory | — |

Tier 3 (Stripe) is **deferred** to a follow-up PR: authenticated, reversible, and it would
dilute a PR that must be reviewable.

---

## Task 1 — env + deps

**Files:** `src/env.ts`, `.env.local.example`, `package.json`

```bash
pnpm add @upstash/redis @upstash/ratelimit @marsidev/react-turnstile
```

`src/env.ts` — server block. **All OPTIONAL**, matching the `STRIPE_SECRET_KEY` / `R2_*`
precedent: a keyless build/CI must pass.

```ts
// Upstash Redis for the signup-abuse rate limiter (docs/plans/2026-07-16-signup-abuse-defense-design.md).
// Names come from the Vercel Marketplace integration (`otd-academy-ratelimit`) — NOT the
// UPSTASH_REDIS_REST_* names Redis.fromEnv() prefers; we construct the client explicitly.
// OPTIONAL so a keyless build/CI passes. UNSET IN PRODUCTION = NO RATE LIMITING (the limiter
// no-ops and logs once at boot). Turnstile (Layer 0) is what keeps that from being fatal.
KV_REST_API_URL: z.url().optional(),
KV_REST_API_TOKEN: z.string().min(1).optional(),
// Cloudflare Turnstile — Layer 0 bot detection on the magic-link form. The PRIMARY control:
// it is the only layer that still works when Upstash is down, and the only one that defends
// the canonical subscription-bombing shape (design §1, §3, §7).
TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
```

Client block: `NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional()`.

Add all four to `runtimeEnv` (the file lists every key explicitly) and to
`.env.local.example` with the same comments.

**Gate:** `pnpm exec tsc --noEmit` clean; `pnpm exec next build` green with all four unset.

---

## Task 2 — Turnstile (Layer 0). SHIP THIS FIRST.

**Files:** `src/components/auth/SignInForms.tsx`, `src/lib/turnstile.ts` (new),
`src/lib/__tests__/turnstile.test.ts` (new), `src/app/(bare)/sign-in/page.tsx`

Widget in the magic-link form only (not the OAuth buttons — they never send mail). Managed
mode: invisible for honest users.

`src/lib/turnstile.ts` — plain module, one exported async verifier:

```ts
// Server-side verification of a Turnstile token. Layer 0 (design §7): the PRIMARY control,
// and the only one that survives an Upstash outage.
//
// FAIL CLOSED on a verification error, deliberately — the opposite of the limiter's
// degradation (design §6). Turnstile is Cloudflare-hosted and independent of Upstash; if it
// is unreachable AND we let the send through, we have no layer left. Google/GitHub sign-in
// is unaffected either way (they never reach this branch).
export async function verifyTurnstile(token: string | undefined, ip: string | null)
  : Promise<boolean>
```

- No `TURNSTILE_SECRET_KEY` → return `true` + log once (keyless CI/local must pass).
- POST `token` + `remoteip` to `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Timeout ~2s; on timeout/throw return **false**.

Also add a **honeypot** field (hidden input a human never fills) and a **minimum dwell time**
(reject a submit < ~2s after mount). Free, catch naive bots, cost an honest user nothing.

**Tests:** missing secret → true + logs; valid token → true; invalid → false; network throw →
**false**; honeypot filled → reject; dwell < threshold → reject.

**Gate:** preview deploy — submit the form with JS disabled / no token → rejected. Real
browser submit → passes.

---

## Task 3 — pure policy + tests

**Files:** `src/lib/abuse-policy.ts` (new), `src/lib/__tests__/abuse-policy.test.ts` (new)

Mirrors `resolveSignIn` / `resolveRouteGate`: **pure, no I/O, fully unit-tested.**

```ts
export type Check = { rule: RuleName; identity: string };

// Limits are SOURCED, not invented (design §5). Do not "tidy" these numbers.
export const RULES = {
  "magic:email:burst": { limit: 1,  window: "60 s" },  // Supabase's exact cooldown
  "magic:email:hour":  { limit: 5,  window: "1 h" },   // Cognito ResendConfirmationCode
  "magic:email:day":   { limit: 15, window: "24 h" },  // bounds a slow drip the hourly misses
  "magic:ip:hour":     { limit: 50, window: "1 h" },   // Auth0 /passwordless/start
  "magic:global:day":  { limit: 500, window: "24 h" }, // the ONLY limit bounding blast radius
  "waitlist:ip:hour":  { limit: 20, window: "1 h" },
} as const;

/** Lowercase + trim. Load-bearing: without it "Josh@X.com" and "josh@x.com" are different
 *  keys and the per-email limit is bypassed by pressing shift.
 *  Deliberately does NOT normalize Gmail dots / +suffix — those matter for account farming,
 *  not for bombing (an attacker types the victim's address exactly). Provider-specific
 *  normalization is a false-positive rabbit hole; the per-IP + global rules are the backstop. */
export function emailKey(email: string): string;

/** Trusted client IP, or null. Prefers x-vercel-forwarded-for (survives a proxy layered on
 *  Vercel), falls back to x-forwarded-for, first hop.
 *  TRUSTWORTHY ON VERCEL ONLY — Vercel overwrites XFF to prevent spoofing. ON ANY OTHER HOST
 *  THIS IS SPOOFABLE AND THE IP RULES BECOME WORTHLESS. Re-verify before migrating (design §10). */
export function clientIp(h: Headers): string | null;

/** Checks a magic-link send must pass. Omits the IP rule when the IP is unknown (local dev),
 *  so dev is never accidentally unlimited nor collapsed onto one shared key. */
export function magicLinkChecks(email: string, ip: string | null): Check[];
```

**Tests:** `emailKey` case/whitespace; `clientIp` header precedence + null; `magicLinkChecks`
omits IP on null, includes all email rules + global always; `RULES` numbers match the design
table (a guard against silent "tidying").

---

## Task 4 — the limiter shell + tests

**Files:** `src/lib/abuse-limit.ts` (new), `src/lib/__tests__/abuse-limit.test.ts` (new)

**A PLAIN module — never `"use server"`.** That file may export only async functions;
`export const ratelimit = new Ratelimit(...)` there crashes at runtime with **tsc silent**
(design §11.8). The module-scope `ephemeralCache` needs this too.

```ts
const redis = new Redis({
  url: env.KV_REST_API_URL!,
  token: env.KV_REST_API_TOKEN!,          // the WRITE token — READ_ONLY cannot INCR
  retry: { retries: 1, backoff: () => 200 }, // default is 5 retries ≈ 4290ms of backoff
});

// Module scope so it outlives the handler. ON by default; we pass it explicitly because we
// USE it as the degradation substrate (design §6) — it is per-instance, so it is a coarse
// fallback and a cost optimization, NEVER enforcement (effective limit = N_instances × limit).
const cache = new Map<string, number>();
```

Each rule gets a `Ratelimit` with its own `prefix` (`otd:magic:email:hour`, …), sharing one
`redis` + one `cache` (safe: the cache is keyed by the prefixed key). `timeout: 1000` —
**must stay below total retry backoff** or errors beat the timer. `analytics: false` (+1
command/call, and in a server action the fire-and-forget `ZINCRBY` needs `await pending`).

```ts
export type Verdict = { ok: true } | { ok: false; rule: RuleName };

/** Runs every check; first denial wins. On infrastructure failure DEGRADES (design §6) —
 *  never throws, never silently allows.
 *
 *  try/catch is MANDATORY and not defensive style: @upstash/ratelimit's `timeout` only
 *  rescues a HANG — limit() races the timer inside try/finally with NO catch, so a rejection
 *  propagates. And @auth/core's send-token.js wraps any throw from the signIn callback in
 *  AccessDenied, so an uncaught throw here BRICKS EVERY EMAIL SIGN-IN. */
export async function enforce(checks: Check[]): Promise<Verdict>;
```

Degradation ladder in the catch:
1. Consult `cache` for a coarse per-instance verdict (deny if already blocked).
2. Increment a module-scope consecutive-failure counter; past N, **circuit-break** (fast-fail,
   skip Redis entirely for a cooldown — a slow Redis on the sign-in path is worse than a dead
   one).
3. `console.error` every degradation and every trip.
4. If degradation persists past the threshold, **escalate Tier 1 to deny** (design §6). Not an
   outage: Google/GitHub never reach this code.

**Tests (mock `@upstash/ratelimit`):**
- first denial wins across checks, and `Verdict.rule` names it
- **`limit()` throwing → degrades, does NOT throw** ← the one that prevents the sign-in brick
- **`limit()` hanging past `timeout` → degrades, does NOT hang**
- env unset → `{ok:true}` + logs once
- circuit breaker opens after N failures and stops calling Redis
- persistent degradation escalates to deny

**Not reachable by any test, stated so it is not assumed:** real Upstash sliding-window
semantics, real TTLs, and whether the IP header is present in production. Task 5's gate covers
those.

---

## Task 5 — wire the `signIn` callback + banner

**Files:** `src/auth.ts`, `src/lib/auth-link-guard.ts`,
`src/lib/__tests__/auth-link-guard.test.ts`, `src/app/(bare)/sign-in/page.tsx`

`auth-link-guard.ts` stays **pure** — the caller does the I/O and hands the verdict in, exactly
as it already documents for `emailVerified`:

```ts
export const RATE_LIMITED_REDIRECT = "/sign-in?error=rate_limited";

export type SignInInput = {
  /* …existing… */
  /** Verdict from the caller's abuse checks. The guard does no I/O. */
  abuseBlocked: boolean | undefined;
};

if (input.isVerificationRequest) {
  if (input.abuseBlocked) return RATE_LIMITED_REDIRECT;
  return isSessionConflict(...) ? SESSION_CONFLICT_REDIRECT : true;
}
```

In `src/auth.ts`'s `signIn` callback, **before** `resolveSignIn`, gated on
`email?.verificationRequest === true && account?.provider === "resend"` so Google/GitHub cost
no round-trip:

```ts
// DYNAMIC import: src/proxy.ts imports this module and next/headers must not land in the
// middleware bundle. Matches the events.signIn pattern below — that comment is load-bearing.
const { headers } = await import("next/headers");
```

Then Turnstile (Task 2) → `enforce(magicLinkChecks(...))` (Task 4) → pass `abuseBlocked` into
`resolveSignIn`.

**Return a STRING, never `false`.** `false` → `AccessDenied` → routes to `pages.error`, which
we do not set → the raw `/api/auth/error` page. Never return an empty string (falsy →
`AccessDenied`).

`/sign-in` renders an `error=rate_limited` banner alongside the existing `AccessDenied` /
`session_conflict` cases. **Copy must be GENERIC** — no "too many requests *for this address*",
which is an account-existence oracle (design §5). Something like: *"Too many sign-in requests.
Wait a few minutes, or use Google/GitHub."* — which also points at the two paths that still
work. No collision with `verifyRequest` (Auth.js appends `?provider=…&type=email`).

**Tests:** extend `auth-link-guard.test.ts` — `abuseBlocked: true` → `RATE_LIMITED_REDIRECT`;
a Google/GitHub sign-in is never blocked; `abuseBlocked` undefined behaves as today.

**Gate — a PREVIEW DEPLOY, not localhost.** The IP path only exists on a real Vercel edge:
1. Request 6 magic links for one address → the 6th bounces to `?error=rate_limited`.
2. Two sends inside 60s → the 2nd bounces (cooldown).
3. A 7th from a **different IP, same email** → still bounces (proves the email key, not the IP).
4. Google sign-in still works throughout (proves fail-closed is not an outage).
5. Banner copy is identical for a real and a non-existent address (no enumeration).

---

## Task 6 — Tier 2: `joinWaitlist`

**Files:** `src/lib/actions/waitlist.ts`, its caller form, `src/lib/__tests__/waitlist-actions.test.ts`

IP check at the top. **Return shape becomes a union** — `{ ok: true }` →
`{ ok: true } | { ok: false; error: string }` — so the calling form must render the denial. A
small client change; called out here so it is not a surprise. Tier 2 **fails open** (design §6).

---

## Task 7 — docs + memory

- `docs/caching.md` untouched (unrelated).
- README: the abuse-defense layers belong in **Notable engineering** only if they earn it.
- **CLAUDE.md:** add the load-bearing traps — `use server` export rule already exists; add the
  dynamic `next/headers` import in `auth.ts`, and "an unconfigured deploy is an unprotected one."
- Memory: a `signup-abuse-defense` entry with the refuted-v1 lessons.

---

## Verification summary

| Claim | How it is proven |
| --- | --- |
| Policy numbers match the design | unit test asserts the `RULES` table |
| Limiter never throws | unit test: mocked `limit()` throws → degrades |
| Limiter never hangs | unit test: mocked hang past `timeout` → degrades |
| Sign-in survives an Upstash outage | unit test + preview: Google path unaffected |
| The email limit actually binds | **preview**: 6th send bounces from a different IP |
| Bot detection binds | **preview**: token-less POST rejected |
| No enumeration | **preview**: identical copy for real vs fake address |
| Keyless build passes | `next build` with all four env vars unset |

**vitest cannot prove the caching-adjacent parts of this** (real Upstash semantics, the IP
header). Only the preview-deploy gates cover those. Do not mark Task 5 done on green unit
tests alone.
