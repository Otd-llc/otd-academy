# Signup abuse defense — design (v2)

> **STATUS 2026-07-16: design VALIDATED by five adversarial research agents, code NOT built.**
> Upstash provisioned (§9). Supersedes `2026-07-16-rate-limiting-design.md`, whose central
> calls were **refuted** — see §11 for what was wrong and why, kept because the reasoning is
> instructive.
>
> Renamed from "rate limiting" deliberately. The v1 title encoded the v1 mistake: rate
> limiting is **one layer of the floor**, not the defense.

## 1. Why — and the correct framing

The app has **no abuse protection of any kind**. Survivable at ~4 requests/day; not survivable
once money points strangers at the sign-up funnel.

`/sign-in`'s `resendAction` is an **unauthenticated** server action that emails a magic link to
**any address supplied**, unlimited, on our Resend account.

**The primary harm is not to us.** M3AAWG and Proofpoint frame form abuse entirely as *your
form becoming infrastructure for someone else's attack* — subscription bombing buries a
victim's fraud alerts and password-reset notices while an account takeover proceeds. Black
Basta ransomware uses exactly this. We are the weapon, not the target.

**The secondary harm is to us, and it is severe and slow to undo.** Resend requires a spam rate
**< 0.08%** (8 complaints per 10,000 sends) and a bounce rate **< 4%**, and states accounts
"may be shutdown **without warning**" — with **no carve-out for third-party abuse of your own
forms**. Bombing real addresses generates complaints at percent-level rates: 10–100× over
threshold. A Resend pause is **account-wide** — it also kills `subscription-dunning-email.ts`
(direct revenue loss on failed payments), `lifecycle-send.ts`, `field-guide-email.ts`, and
`sourcing-digest-email.ts`. Recovery is a manual support case; deliverability repair runs
2–12+ weeks and some domains never fully recover.

Order the justification this way round. "It hurts our reputation" is true but self-interested
and invites under-investment the moment someone notes our volume is low.

### Two different attacks — v1 conflated them

| | Shape | Does rate limiting stop it? |
| --- | --- | --- |
| **Subscription bombing** (canonical) | Our form is **one of thousands**; each sends 1–2 emails to one victim. Every submission looks like a single legitimate signup. | **No.** Nothing about it is rate-anomalous. |
| **Amplification** | One attacker hammers **our** form at one victim. | **Yes.** This is what rate limiting is for. |

Both matter. Rate limiting alone stops us being the *amplifier*; only bot detection stops us
being one of the *thousand bombers*.

### The strongest mitigation is unavailable to us

Double opt-in is the #1 industry answer to form abuse. **A magic link *is* the confirmation
email** — there is no second email to withhold. That removes the best lever entirely and
shifts weight onto bot detection. Any plan that assumes magic links are self-limiting because
they are "transactional" is wrong.

## 2. The surface

| Endpoint | Auth | What abuse costs | Reversible? | Tier |
| --- | --- | --- | --- | --- |
| magic-link send → `signIn` callback (§4) | **none** | email to any address → third-party harm, reputation, account-wide suspension | **NO — delivered is delivered** | **1** |
| `joinWaitlist` (`src/lib/actions/waitlist.ts`) | **none** (anonymous capture is the point) | DB write per submit; garbage floods the campaign's own capture table | yes (delete rows) | **2** |
| `requestFieldGuide` (`src/lib/actions/field-guide-download.ts`) | session | sends email; bounded by needing an account | no | **2** |
| `createCheckoutSession` · `createSubscriptionCheckoutSession` · `createBillingPortalSession` | `requireUser` | a Stripe API call each | yes (sessions expire) | **3** |

Out of scope (already gated): Stripe webhook (signature), `/api/capture` + `/api/cron/*`
(token/secret), `/email/unsubscribe/[token]` (signed token).

**Reversibility is the axis that drives §6**, not "abuse vs auth". A failed-open checkout mints
a cancellable Stripe session. A failed-open email cannot be recalled: delivered, complaint
filed, reputation booked.

## 3. The layers

Rate limiting is the floor, not the roof. Every authority surveyed (M3AAWG, Spam Resource,
Suped, OWASP) ranks bot detection **first**; one names rate limiting "insufficient alone — bots
adapt around single checks"; another's mitigation list omits it entirely.

| # | Layer | Stops | Survives Upstash down? |
| --- | --- | --- | --- |
| **0** | **Bot detection on the magic-link form** (§7) | both attack shapes, pre-send | **YES** |
| **1** | **Rate limiting** (§5, §6) | amplification | no (degrades — §6) |
| **2** | **Degradation + circuit breaker** (§6) | amplification, coarsely | yes (in-process) |
| **3** | **Monitoring** (§8) | nothing — it tells you | yes |

Layer 0 is the one that matters most and the only one that holds when Upstash is unavailable.
v1 dismissed it as "out of scope."

## 4. The choke point — VALIDATED against shipped `@auth/core@0.41.2`

The **`signIn` callback in `src/auth.ts`**, at the `email?.verificationRequest === true` step.
Not `resendAction`; not `sendVerificationRequest`. Verified, not assumed:

- **It fires before the email is sent** *and* before `createVerificationToken`
  (`send-token.js` calls the callback at line 23, `sendVerificationRequest` at line 48).
- **`headers()` works inside it — already proven in this repo.** `src/auth.ts:159` calls
  `await auth()` in this very callback, and `auth()` *is* a `next/headers` call. The
  session-conflict guard depends on its result and works today.
- **Return a STRING, never `false`.** `false` → `AccessDenied` → routes to `pages.error`, which
  **we do not set** (`src/auth.ts:259` sets only `signIn` + `verifyRequest`) — so `false` dumps
  the user on the raw `/api/auth/error` page. A string redirect is the only way to land on
  `/sign-in`. (An empty string is falsy and becomes `AccessDenied` — never return one.)
- **`sendVerificationRequest` is worse**, despite having a real `Request` object: a throw there
  is unwrapped → surfaces as `Configuration` ("problem with the server configuration"), and it
  fires *after* token generation racing `Promise.all`, so throwing still writes a token row.
  Also `EmailSignInError` is defined but **never thrown** in v5 — `?error=EmailSignin` is a v4
  code that cannot occur here.
- **Auth.js ships no built-in rate limiting** (#12288 closed with no maintainer solution). The
  community workaround forks the token flow; this doesn't.

`src/proxy.ts` cannot be a fallback: it excludes both `sign-in` and `api/auth`, and server
actions POST to their own route. Vercel Firewall cannot either — the abuse rotates IPs and
needs a per-**email** decision, which the firewall cannot see in the POST body. So this is
inherently application-level, which is also why it is portable (§10).

### Two mandatory implementation details

**1. `try/catch` is not optional — without it a limiter blip bricks email sign-in.**
`send-token.js` wraps the callback in `catch (e) { throw new AccessDenied(e) }`. And
`ratelimit.limit()` **does throw** (§5). So an Upstash hiccup → `AccessDenied` → every email
sign-in dies. The catch degrades (§6); it does not wave traffic through.

**2. `next/headers` must be a DYNAMIC `import()`.** `src/proxy.ts` imports `src/auth.ts`, and
`next/headers` has no business in a middleware bundle — a static import would likely break the
middleware build. Match the existing pattern at `src/auth.ts:236` (`events.signIn`); that
comment is load-bearing.

## 5. The limits — v1's numbers were wrong

Published limits for this exact endpoint class:

| Provider | Limit | Key |
| --- | --- | --- |
| Auth0 `/passwordless/start` | **50/hr** | per IP |
| Auth0 `change_password` (sends email) | 1/min sustained, burst 10 | **email + IP** |
| Supabase magic-link resend | **1 per 60s** | per user |
| Supabase send-OTP | 30/hr | **project-wide** |
| Cognito `ResendConfirmationCode` | **5/hr** | per user |
| Cognito email MFA | 5–20/hr | **email × requester IP** |
| Firebase email-link sends | 5/day (Spark) | **per project** |
| Clerk `POST /v1/sign_ins` | 5 per 10s | per IP |
| GitLab protected paths (incl. confirmation) | 10 POST/min = 600/hr | per IP |

**Adopted:**

| Rule | Limit | Basis |
| --- | --- | --- |
| `magic:email` cooldown | **1 per 60s** | Supabase's exact pattern |
| `magic:email` hourly | **5/hr** | Cognito `ResendConfirmationCode` |
| `magic:email` daily | **15/day** | bounds a slow-drip bomb the hourly misses |
| `magic:ip` hourly | **50/hr** | Auth0's published number for this endpoint |
| **`magic:global` daily** | **a fixed daily ceiling** | see below |
| `waitlist:ip` | 20/hr | it is a form |
| `field-guide:user` | 10/hr | authenticated |
| `checkout:user` | 15/hr | authenticated |

**Why v1's numbers were wrong:**

- **`10/IP/hr` was the outlier** — 5× tighter than Auth0, 60× tighter than GitLab. It encodes
  "one IP ≈ one person," which is false. It **fails asymmetrically**: an attacker rotates IPs
  for pennies (and is caught by the per-email rule anyway), while the entire cost lands on
  legitimate users behind office/university/CGNAT egress. Firebase documents raising this quota
  because it misfires; Auth0 tells you to call passwordless client-side specifically so you
  don't collapse every user onto one IP.
- **Per-email and per-IP are not two quotas of the same shape.** Per-email protects the
  *victim's inbox* → small, cooldown-shaped. Per-IP protects *our* quota → must be generous.
  The mature providers use a **composite** (Auth0: "User Email, IP Address"; Cognito: "per
  email address hourly per requester IP").
- **The missing global cap was the real gap.** Every provider surveyed has one. It is the only
  limit that actually bounds cost and blast radius; the per-IP limit v1 leaned on does not.

### User enumeration — a security bug v1 would have introduced

A per-email denial that says "too many requests **for this address**" **confirms the address
exists**. Clerk documents this as a distinct threat. The `?error=rate_limited` banner must be
**generic** and identical whether or not the account exists. Note we cannot set a 429 or a
`Retry-After` header — a server action returns a value, not a status — so the industry-standard
UX is unavailable at this choke point. Generic copy on `/sign-in` is what we have.

## 6. Failure behaviour — DEGRADE, don't disable

v1 said fail-open. **That was refuted** (§11). This is the corrected policy:

| Tier | On Upstash failure |
| --- | --- |
| **1** (magic link) | **Degrade** to the in-process `ephemeralCache` coarse limit. Circuit-breaker after N consecutive failures (fast-fail rather than pay ~1s/request — a slow Redis on the sign-in path is worse than a dead one). If degradation persists past a threshold, **escalate to fail-CLOSED** via the `rate_limited` banner. |
| **2–3** | Fail open. Reversible, cheap; v1's reasoning holds here. |

**Why fail-closed on Tier 1 is not the catastrophe v1 claimed:** the check runs *only* on the
magic-link step. **Google and GitHub sign-in never touch Redis.** Fail-closed degrades one of
three sign-in paths — not "a total sign-up outage." v1's own §3 said so; its §6 forgot.

**Why fail-open is worse than it looks:** it trades a minutes-long, self-healing Upstash outage
for a potentially weeks-long, human-gated Resend suspension. Strictly negative. And
"attack the limiter first" is a published, measured technique — **Stalloris (USENIX Security
'22)** induces a security dependency's unavailability to force fail-open, downgrading RPKI
validation across 60% of protected IPv4 space, and triggers it *by weaponizing rate limiting
itself*.

The industry "consensus" v1 invoked does not exist — defaults split evenly, and the split
tracks **blast radius**, not abuse-vs-auth: edge layers in front of *all* traffic fail open
(Cloudflare, CloudFront+WAF); **app-level limiters with an external store guarding one costly
action fail closed** (express-rate-limit `passOnStoreError: false`, nginx `limit_req`, AWS ALB
`waf.fail_open.enabled: false`). Ours is the second kind.

**"Log loudly" is detection, not prevention** — it makes fail-open observable, not safe. Hence
the bounded window above.

## 7. Layer 0 — bot detection

**Cloudflare Turnstile** on the magic-link form, verified server-side in the same `signIn`
callback branch before the limiter runs.

- **Portable.** Works on any host — consistent with §10 and the reason Upstash beat Vercel
  Firewall. **Vercel BotID would be lock-in** for the one control we least want to re-buy on a
  migration.
- **Free**, and has an invisible/managed mode, so the honest-user cost is ~zero.
- **It is the only layer that survives an Upstash outage** (§3) — which is what makes the
  degrade-don't-disable policy tolerable.
- OWASP's Forgot Password guidance names CAPTCHA in the same breath as rate limiting for this
  endpoint class; M3AAWG recommends "all public subscription and web forms install one of the
  various types of CAPTCHA."

Cheap additions worth taking with it: a honeypot field and a minimum form-dwell time. Both are
free, catch naive bots, and cost an honest user nothing.

## 8. Monitoring

- **Resend complaint + bounce rate** is the metric that actually matters (0.08% / 4%). Watch it.
- **Upstash spend alert (70%/90%) doubles as an intrusion alarm** — a spend spike on a rate
  limiter has one cause. Treat it as "go look," never as "raise the cap."
- Log every degradation and every circuit-breaker trip.

## 9. Provisioning — DONE, and the env vars are not what v1 assumed

Resource **`otd-academy-ratelimit`** — Upstash for Redis via Vercel Marketplace, `● Available`,
connected to `project-foundry` (Production + Preview only).

- **iad1** (matches Vercel prod — this sits in the sign-in path).  No read regions: every op is
  a counter write.
- **Eviction OFF.** Eviction suits a cache; rate-limit counters are not disposable — evicting
  one resets a limit *under load*, exactly when it must hold. Keys are tiny and TTL out.
- **Pay As You Go** + budget cap. PAYG over Free is a **security** call: Free's 500K
  commands/month is a ceiling an attacker drains with ~50K requests, after which the limiter
  degrades. Real cost is cents/month. **Note the honest limit of this reasoning** — the budget
  cap re-creates a ceiling, so the same class of attack survives. §6's bounded degradation is
  what actually answers it; the plan choice only raises the bar.

### Env vars — verified with `vercel env ls`

Injected: **`KV_REST_API_URL`**, **`KV_REST_API_TOKEN`** (+ `KV_REST_API_READ_ONLY_TOKEN`,
`KV_URL`, `REDIS_URL`). Preview + Production, Sensitive.

`Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL || KV_REST_API_URL` and
`UPSTASH_REDIS_REST_TOKEN || KV_REST_API_TOKEN` — **four names, and our names are the
fallbacks, so it would work.** Construct explicitly anyway: on missing vars `fromEnv()` does
**not** throw — it `console.warn`s and returns a client with `url: undefined`, which fails at
*request* time as a fast rejection. Explicit + validated env (§ below) fails at boot instead.

Declare both **OPTIONAL** in `src/env.ts` (matching the `STRIPE_SECRET_KEY` / `R2_*`
precedent — a keyless build/CI must pass). When unset the limiter no-ops and logs once at
startup. State it plainly: **an unconfigured production deploy is an unprotected one.** Layer 0
(§7) is what keeps that from being fatal.

Development is deliberately not connected: local dev must not share a security control's
counters with production, and the IP path only exists on a real Vercel edge.

New deps: `@upstash/redis`, `@upstash/ratelimit`, `@marsidev/react-turnstile` (or equivalent).

## 10. Portability

Deliberately host-agnostic. Upstash is HTTP-based (no pooling, runs anywhere); Turnstile runs
anywhere; the whole design is application-level. Moving off Vercel needs **one** change: the
client-IP header list (§ below), flagged with its reason. This is why Upstash beat Vercel
Firewall and why Turnstile beats BotID, even though both Vercel options are cheaper/easier.

**Client IP:** prefer `x-vercel-forwarded-for`, fall back to `x-forwarded-for`, take the first
hop. Trustworthy **on Vercel only** — Vercel "overwrite[s] the X-Forwarded-For header and do[es]
not forward external IPs… to prevent IP spoofing." **On any other host this is spoofable and
the IP limit becomes worthless — re-verify before migrating.**

## 11. What v1 got wrong (kept — the reasoning is the lesson)

Five adversarial agents; three of v1's load-bearing calls were refuted.

1. **Framing.** v1 made rate limiting *the* defense. It is the floor. Bot detection is primary,
   double opt-in is unavailable, and v1's own §10 dismissed CAPTCHA as "out of scope" — the one
   control that survives an Upstash outage.
2. **Attack model.** v1 conflated subscription bombing (thousands of sites × 1–2 emails —
   invisible to rate limiting) with amplification (one form hammered — caught). It claimed to
   defend a problem it only half-addressed.
3. **Limits.** `10/IP/hr` was 5–60× tighter than every published provider and would block real
   users behind NAT; `3/email/hr` was tighter than anyone publishes; the shape should be
   cooldown+cap, not a bare hourly quota; and the **global cap — the only limit that bounds
   blast radius — was missing entirely**.
4. **Enumeration.** v1's per-email denial banner would have been an account-existence oracle.
5. **Fail-open — refuted by v1's own text**, three ways:
   - §6's premise ("a total sign-up outage") is false by §3's scoping — Google/GitHub are
     untouched.
   - §6 ("a window of abuse is recoverable") contradicts §1 ("silent until conversion craters").
     §1 was right; reputation is the least recoverable asset in the system.
   - §8 states the principle — *"a control whose quota the attacker can exhaust is not a
     control"* — and §6 breaks it. The generalization is the refutation: **a control whose
     failure the attacker can induce is not a control.**
6. **Mechanism.** v1 believed `timeout` delivers fail-open. It does not — `limit()` races the
   timer against the call inside `try/finally` with **no catch**, so a *rejection* propagates
   and only a *hang* is rescued. Worse, the defaults are a coin-flip: 5 retries backing off
   ~4290ms against a 5000ms default timer, so the error lands ~700ms *under* the timeout and
   `limit()` **throws** — measured, not inferred. Combined with `send-token.js`'s
   `catch → AccessDenied`, v1 would have bricked email sign-in on the first Upstash blip.
7. **`ephemeralCache` is ON by default** and is **per-instance** — effective limit is
   `N_instances × limit`. v1 treated a cost optimization as enforcement. (It is still the right
   degradation substrate — §6 — just not a limit.)
8. **`use server` export rule.** The `Ratelimit` instance must live in a **plain** module: a
   `"use server"` file may export only async functions, and `export const ratelimit = …` there
   crashes at runtime with **tsc silent**. (Also what the module-scope `ephemeralCache` needs.)

Honest gaps the research did **not** close: no ESP postmortem explicitly says "we suspended X
because their form was abused" — the causal chain rests on policy language with no third-party
carve-out plus one primary account (an SES excessive-complaint warning within a single day of
disabling CAPTCHA). OWASP names the mitigation but is silent on failure mode; ASVS has no
explicit requirement for this endpoint class (open issue #1760).
