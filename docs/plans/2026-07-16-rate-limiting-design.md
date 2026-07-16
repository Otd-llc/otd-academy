# Rate limiting — design

> **STATUS 2026-07-16: Upstash PROVISIONED (§8). Code NOT built yet.** Written ahead of the
> paid ad campaigns, which are what turn the gaps below from theoretical into billable.
>
> Open decisions in §11 are proposals, not settled — the limits especially.

## 1. Why

The app has **no rate limiting of any kind** today. That is survivable at ~4 requests/day. It
stops being survivable the moment money is spent pointing strangers at the sign-up funnel:
paid traffic means the public endpoints get found, and a public endpoint that sends email is
found fast.

The load-bearing one is not a DoS risk. It is **deliverability**:

`/sign-in`'s `resendAction` is an **unauthenticated** server action that sends a magic-link
email to **any address supplied**, unlimited. Anyone can make our server email anyone, on our
Resend account. Consequences, worst first:

1. **Sender reputation collapse.** Magic links are how paid sign-ups get in. An abuser
   bombing arbitrary victims from our domain gets `onethousanddrones.com` marked as a spam
   source — and then the links our *paying* traffic needs land in spam. We would be buying
   clicks that cannot convert, and the failure is silent until conversion craters.
2. **Resend suspends the account** for abuse. Sign-in stops entirely.
3. The bill.

(1) is the whole reason this is scheduled before the campaign rather than after.

## 2. The surface

| Endpoint | Auth | What abuse costs | Tier |
| --- | --- | --- | --- |
| `resendAction` → magic link (`src/app/(bare)/sign-in/page.tsx`) | **none** | email to any address → reputation, suspension, bill | **1** |
| `joinWaitlist` (`src/lib/actions/waitlist.ts`) | **none** (deliberate — anonymous capture is the point) | DB write per submit; garbage floods the campaign's own capture table | **2** |
| `requestFieldGuide` (`src/lib/actions/field-guide-download.ts`) | session | sends email; bounded by needing an account, but one account can spam | **2** |
| `createCheckoutSession` (`actions/checkout.ts`), `createSubscriptionCheckoutSession` (`actions/pass.ts`), `createBillingPortalSession` (`actions/billing.ts`) | `requireUser` | a Stripe API call each | **3** |

Out of scope (already gated): the Stripe webhook (signature-verified), `/api/capture` +
`/api/cron/*` (token/secret-gated), `/email/unsubscribe/[token]` (signed token).

## 3. Where the check goes — and why not the proxy

**`src/proxy.ts` cannot do this.** `/sign-in` is excluded from the middleware matcher
(`proxy.ts` config, the `sign-in` term in the negative lookahead), and server actions POST to
their own route — so the magic-link send never passes through middleware. Edge-level limiting
cannot cover the one endpoint that most needs it.

**Vercel Firewall cannot do it either**, for a more interesting reason: the abuse is
"email-bomb this victim," which rotates IPs. Stopping it needs a per-**email** limit, and the
firewall cannot see the email in the POST body. This is inherently application-level. It is
also why this is portable-by-construction (§7).

### The choke point: the `signIn` callback

Not `resendAction`. The true choke point is the **`signIn` callback in `src/auth.ts`**, at the
`isVerificationRequest` step — the moment before Auth.js sends. Any future entry point (a
"resend link" button, a second form) funnels through it and inherits the limit for free.
`resendAction` is merely today's only caller.

This fits the existing architecture exactly. `resolveSignIn` (`src/lib/auth-link-guard.ts`) is
already the pure, unit-tested guard for this step, and it already returns a redirect string to
bounce a rejected send (`SESSION_CONFLICT_REDIRECT`). It stays pure: the **caller** does the
async I/O and hands the verdict in — precisely the pattern already documented there for
`emailVerified` ("the caller computes `emailVerified` per provider and hands it in — the guard
only knows the rules").

```ts
// src/lib/auth-link-guard.ts — extend the existing guard
export const RATE_LIMITED_REDIRECT = "/sign-in?error=rate_limited";

export type SignInInput = {
  /* …existing fields… */
  /** Verdict from the caller's rate-limit check. The guard does no I/O. */
  rateLimited: boolean | undefined;
};

if (input.isVerificationRequest) {
  if (input.rateLimited) return RATE_LIMITED_REDIRECT;
  return isSessionConflict(...) ? SESSION_CONFLICT_REDIRECT : true;
}
```

`src/auth.ts` performs the check **only** on the resend verification-request step, so a
Google/GitHub sign-in costs no Redis round-trip.

`/sign-in` already renders banners off `?error=` (`AccessDenied`, `session_conflict`), so
`rate_limited` slots into that existing switch — a real user who trips the limit gets "you've
requested a few links already; try again in a bit," not a crash.

## 4. Module layout

Mirrors `resolveSignIn` / `resolveRouteGate`: **pure policy, unit-tested; a thin I/O shell.**

| File | Purity | Owns |
| --- | --- | --- |
| `src/lib/rate-limit-policy.ts` | **pure** | the rules table, key derivation, which checks apply |
| `src/lib/rate-limit.ts` | I/O | the Upstash client + limiter, fail-open, timeout |
| `src/lib/auth-link-guard.ts` | **pure** | gains the `rateLimited` branch (above) |

```ts
// src/lib/rate-limit-policy.ts — PURE
export type Check = { rule: RuleName; identity: string };

export const RULES = {
  "magic-link:email": { limit: 3,  window: "1 h" },
  "magic-link:ip":    { limit: 10, window: "1 h" },
  "waitlist:ip":      { limit: 20, window: "1 h" },
  "field-guide:user": { limit: 10, window: "1 h" },
  "checkout:user":    { limit: 15, window: "1 h" },
} as const;

/** Lowercase + trim. Load-bearing: without it "Josh@X.com" and "josh@x.com" are
 *  different keys and the per-email limit is bypassed by pressing shift. */
export function emailKey(email: string): string;

/** The trusted client IP, or null when it cannot be established. */
export function clientIp(h: Headers): string | null;

/** Which checks a magic-link send must pass. Omits the IP check when the IP is
 *  unknown — see §5. */
export function magicLinkChecks(email: string, ip: string | null): Check[];
```

```ts
// src/lib/rate-limit.ts — I/O shell
export type Verdict = { ok: true } | { ok: false; retryAfterSec: number };

/** Runs every check; the first denial wins. Fail-OPEN on infrastructure error. */
export async function enforce(checks: Check[]): Promise<Verdict>;
```

## 5. Identity

**Email** — `emailKey()`: lowercase + trim.

*Residual, accepted:* this does not normalize Gmail's dot-trick or `+suffix`. Those matter for
*account-farming* (one person minting many identities), not for *bombing* (an attacker types
the victim's address exactly as it is). The per-IP ceiling is the backstop for farming.
Provider-specific normalization is a rabbit hole with false-positive risk (`user.name@` is a
distinct mailbox at most providers) and is deliberately not attempted.

**IP** — from the request headers, and **which header is a security decision**:

- Prefer **`x-vercel-forwarded-for`**. Identical to `x-forwarded-for`, but cannot be clobbered
  by a proxy layered on top of Vercel.
- Fall back to `x-forwarded-for`.

Both are **trustworthy on Vercel**: per Vercel's request-headers doc, *"we currently overwrite
the X-Forwarded-For header and do not forward external IPs. This restriction is in place to
prevent IP spoofing."* A naive parse of a client-supplied `x-forwarded-for` on a *non*-Vercel
host would be spoofable and the IP limit worthless — so if we ever move hosts, **re-verify this
first** (§7).

Locally (`next dev` / `next start`) no edge sets these, so `clientIp()` returns `null`.
`magicLinkChecks` then omits the IP check and the per-email limit still applies — local dev is
never accidentally unlimited, and never accidentally limits every developer to one shared key.

## 6. Limits, and the fail-open call

| Rule | Limit | Reasoning |
| --- | --- | --- |
| magic link / email | **3 per hour** | a real user needs 1–2. Three absorbs a typo + retry. A bombing run needs hundreds. |
| magic link / IP | **10 per hour** | catches one host spraying many different victim addresses. Well above a shared office NAT's honest use. |
| waitlist / IP | 20 per hour | it is a form; nobody fills it 20× honestly. |
| field guide / user | 10 per hour | authenticated; generous. |
| checkout / user | 15 per hour | authenticated; a real buyer retries a handful of times at most. |

**On infrastructure failure, FAIL OPEN.** If Upstash is unreachable or slow, allow the request.

This is the **opposite** call from the proxy auth gate (#312), deliberately, and the difference
is the point: that gate is a **security boundary**, where the cost of failing open is
unauthorized access. This is **abuse protection**, where the cost of failing *closed* is that an
Upstash blip becomes a total sign-up outage — mid-campaign, while paying for clicks that then
cannot convert. A window of abuse is recoverable. A funnel that silently rejects paid traffic is
not.

Two mechanics make fail-open real rather than aspirational:

- **A timeout, not just a catch.** A *hanging* Redis on the sign-up path is as damaging as a
  down one. `@upstash/ratelimit`'s `timeout` option allows the request through when the check
  outruns it (~1s).
- **Log loudly.** A silent fail-open is indistinguishable from having no limiter — the exact
  "write-only tag" failure shape from `docs/caching.md` Law 2. Every fail-open emits an error
  log so it is greppable and alertable.

Also enable `ephemeralCache` (an in-memory Map): a client already being denied is short-circuited
without a Redis round-trip, which cuts both cost and the flood's own amplification.

## 7. Portability

Deliberately host-agnostic. Upstash is HTTP-based (no connection pooling, works from any
runtime), and the whole design is application-level. Moving off Vercel needs **one** change:
`clientIp()`'s header list, flagged in §5 with the reason. Nothing else here knows where it runs.

This is why Upstash beat Vercel Firewall for this job even though the firewall is cheaper and
needs no code: the firewall cannot see the email (§3), *and* it would not survive a migration.

## 8. Provisioning — DONE (2026-07-16)

Provisioned through the Vercel Marketplace (env vars injected automatically, billing via the
existing Vercel account):

- Resource: **`otd-academy-ratelimit`** — Upstash for Redis, `● Available`, connected to
  `project-foundry`.
- Primary region **iad1** (matches the Vercel prod region — this sits in the sign-in path, so
  colocation is real latency). No read regions: every operation here is a counter write.
- **Eviction OFF.** Eviction is right for a cache; rate-limit counters are not disposable —
  evicting one resets a limit *under load*, which is exactly when it must hold. The keys are
  tiny and TTL out on their own.
- **Pay As You Go**, not Free. This is a security argument, not a cost one: Free's 500K
  commands/month is a fixed ceiling an attacker drains with ~50K requests, after which the
  limiter errors → fails open (§6) → unlimited bombing for the rest of the month. A control
  whose quota the attacker can exhaust is not a control. Real cost here is cents/month
  ($0.20/100K commands); a serious attack is single-digit dollars.
- **Budget cap** set in the Upstash console (PAYG-only feature). Upstash emails at 70% and 90%
  automatically — not configurable, and nothing more is needed. **Treat that alert as an
  intrusion alarm, not a prompt to raise the cap**: a spend spike on a rate limiter has one
  cause. Note the cap re-creates a ceiling (exceed it → the DB is rate limited → the limiter
  degrades → fail-open), so set it well clear of honest traffic.

### Env vars — READ THIS BEFORE WRITING THE CLIENT

The injected names are **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** (plus
`KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`), Preview + Production, marked Sensitive.

**`Redis.fromEnv()` DOES NOT WORK HERE and cannot be made to.** It reads only
`UPSTASH_REDIS_REST_URL` / `_TOKEN`. The Vercel integration's names are the `KV_REST_API_*` set,
and a custom prefix does not rename them — it *prepends* (prefix `UPSTASH_REDIS_REST` yields
`UPSTASH_REDIS_REST_KV_REST_API_URL`, which helps nobody). There is no default named plain
`URL`, so no prefix value can produce what `fromEnv()` wants. Construct explicitly:

```ts
new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN, // the WRITE token — READ_ONLY cannot INCR
})
```

This matters more than it looks: `fromEnv()` finding nothing throws/no-ops, and under
fail-open (§6) that is **silent** — a limiter that looks installed and limits nothing. Verified
against the live resource with `vercel env ls`, not assumed.

Declare both in `src/env.ts` as **OPTIONAL**, matching the established `STRIPE_SECRET_KEY` /
`R2_*` precedent: a build or CI run with no keys must still pass. When unset, `enforce()`
no-ops to `{ ok: true }` and logs once at startup. State the consequence plainly:
**an unconfigured production deploy is an unlimited one.** The startup log is what makes that
loud instead of silent.

```
KV_REST_API_URL:   z.url().optional(),
KV_REST_API_TOKEN: z.string().min(1).optional(),
```

Development is deliberately **not** connected: local dev must not share a security control's
counters with production, and the IP path can only be verified on a real Vercel edge anyway
(§5). Locally both vars are unset → the limiter no-ops. If local testing is ever wanted, that
is a **separate** dev database, not this one.

New deps: `@upstash/redis`, `@upstash/ratelimit`.

## 9. Testing

Honest about what a test can and cannot reach:

**Unit (pure, real coverage)** — `src/lib/__tests__/rate-limit-policy.test.ts`
- `emailKey` normalizes case + whitespace (the bypass-by-shift-key case)
- `clientIp` prefers `x-vercel-forwarded-for`, falls back, returns `null` when absent
- `magicLinkChecks` omits the IP check on a null IP, includes both otherwise
- `resolveSignIn` returns `RATE_LIMITED_REDIRECT` when `rateLimited` is true, and does **not**
  rate-limit a Google/GitHub sign-in — extends the existing `auth-link-guard.test.ts`

**Unit (mocked I/O)** — `src/lib/__tests__/rate-limit.test.ts`
- first denial wins across multiple checks
- **fails OPEN when the limiter throws** — the assertion that keeps §6 true
- **fails OPEN when the limiter hangs** past the timeout
- no-ops when the env vars are unset

**Not covered by any test, and stated so it is not assumed:** real Upstash semantics (sliding
window accuracy, TTL) and whether the header is actually present in production. Those need a
deployed check — hit `/sign-in` 4× against a preview deployment and confirm the 4th bounces to
`?error=rate_limited`, then confirm a 5th from a different IP with the same email *also*
bounces (proves the email key, not just the IP one).

## 10. What this does NOT solve

- **Distributed bombing** — many IPs, many victim addresses, few requests each. The per-email
  limit still caps each victim at 3/hr, which is the part that matters for reputation.
- **Bot sign-ups** with real, disposable addresses. That is BotID/CAPTCHA territory, not rate
  limiting. Out of scope; revisit if the campaign draws it.
- **Cost control on Stripe/DigiKey**. Tier 3 limits blunt it; they are not a budget.
- **The caching layer.** Unrelated. See `docs/caching.md` — and note Redis is deliberately
  *not* used for cache: the portable layer there is already Next's `use cache` API, and the
  storage backend is a one-line `cacheHandlers` swap.

## 11. Open decisions

1. **Limits** (§6) — 3/email/hr + 10/IP/hr is the proposal. Tighter stops bombing harder and
   risks blocking a real retry; looser is the inverse.
2. **`joinWaitlist` return shape.** It returns `{ ok: true }` today. Adding a denial makes it a
   union, and the calling form must render it — a small client change, called out so it is not
   a surprise mid-implementation.
3. **Tier 3 (Stripe) — now or later?** They are authenticated and low-risk. Deferring keeps the
   first PR small and focused on the endpoint that actually threatens the campaign.
