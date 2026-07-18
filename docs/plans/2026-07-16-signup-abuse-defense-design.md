# Signup abuse defense — design

> **STATUS 2026-07-17: VALIDATED TO DRY. Build from this document.**
>
> This is the canonical design. It supersedes the v2 that carried a "NOT BUILDABLE" banner and
> the earlier `2026-07-16-rate-limiting-design.md` (v1, refuted). It was rewritten against the
> **converged architecture** proven across four validation passes (~50 confirmed defects). The
> full audit trail — every defect, refutation, and adjudication — lives in
> **`2026-07-16-signup-abuse-defense-VALIDATION-FINDINGS.md`**; this doc carries only the design
> those findings force. The task-by-task build is
> **`2026-07-16-signup-abuse-defense-implementation.md`**.
>
> Every architectural claim below is validated against installed source
> (`@auth/core@0.41.2`, `next-auth@5.0.0-beta.31`) or noted as unverified where the library is
> not yet installed (`@upstash/ratelimit`/`@upstash/redis`).

## 1. Why — and the correct framing

The app has **no abuse protection of any kind**. Survivable at ~4 requests/day; not survivable
once money points strangers at the sign-up funnel.

`/sign-in`'s magic-link send is an **unauthenticated** path that emails a link to **any address
supplied**, unlimited, on our Resend account.

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

### Two different attacks

| | Shape | Does rate limiting stop it? |
| --- | --- | --- |
| **Subscription bombing** (canonical) | Our form is **one of thousands**; each sends 1–2 emails to one victim. Every submission looks like a single legitimate signup. | **No.** Nothing about it is rate-anomalous. |
| **Amplification** | One attacker hammers **our** form at one victim. | **Yes.** This is what rate limiting is for. |

Rate limiting alone stops us being the *amplifier*; only bot detection stops us being one of the
*thousand bombers*.

### The strongest mitigation is unavailable to us

Double opt-in is the #1 industry answer to form abuse. **A magic link *is* the confirmation
email** — there is no second email to withhold. That removes the best lever entirely and shifts
weight onto bot detection. Any plan that assumes magic links are self-limiting because they are
"transactional" is wrong.

## 2. The surface

| Endpoint | Auth | What abuse costs | Reversible? | Tier |
| --- | --- | --- | --- | --- |
| magic-link send (§4 locus) | **none** | email to any address → third-party harm, reputation, account-wide suspension | **NO — delivered is delivered** | **1** |
| `joinWaitlist` (`src/lib/actions/waitlist.ts`) | **none** (anonymous capture is the point) | DB write per submit; garbage floods the campaign's own capture table | yes (delete rows) | **2** |
| `createTipCheckout` (`src/lib/actions/tips.ts`) | **none — GUEST-CAPABLE** | a Stripe `checkout.sessions.create` per call | yes (sessions expire) | **2** (see below) |
| `requestFieldGuide` (`src/lib/actions/field-guide-download.ts`) | session | sends email; bounded by needing an account | no | 2 (deferred — see below) |
| `createPassCheckoutSession` · `createUpgradeCheckoutSession` (`src/lib/actions/pass.ts`) · authenticated checkout/portal actions | `requireUser` | a Stripe API call each | yes (sessions expire) | **3** |

**Reversibility is the axis that drives §8**, not "abuse vs auth". A failed-open checkout mints
a cancellable Stripe session. A failed-open email cannot be recalled: delivered, complaint
filed, reputation booked.

**Tier-3 inventory correction (a validation finding).** The Stripe deferral rationale is
"authenticated, account-bounded, reversible" — correct for the `requireUser` actions, but the
original table mis-scoped two things:

- **`createTipCheckout` is GUEST-capable** (no `requireUser`). It is anonymous and Stripe-costly,
  so it is **Tier-2-shaped, not deferred Tier 3** — it inherits the same IPv6/global concerns as
  the waitlist and needs the same keying (§7). It is dispatched by global action-ID POST, so a
  preview probe must confirm reachability from a public route.
- The deferred set is **all five** authenticated (`requireUser`) checkout/portal actions, not
  three — confirmed against source: `createPassCheckoutSession`, `createUpgradeCheckoutSession`,
  `createSubscriptionCheckoutSession` (`src/lib/actions/pass.ts`), `createCheckoutSession`
  (`src/lib/actions/checkout.ts`, per-project purchase), and `createBillingPortalSession`
  (`src/lib/actions/billing.ts`). `pass.ts`'s first two sit on public `/pricing`. The single
  deferred `checkout:user` rule must wrap all five. (`tips.ts` exports only `createTipCheckout`,
  the guest-capable Tier-2 action above.)

Deferring the genuinely authenticated actions is correct: user-keyed cuid (no email/IP
normalization), reversible sessions, no silent-success. App-limiting them is *complementary* to
Stripe's account-wide 100 req/s limit (a flood degrades real buyers' checkout), not redundant —
but it is a follow-up PR, not this one.

**`requestFieldGuide`** is session-gated and only ever mails the **user's own** address, so it is
**not** the anonymous vector; dropping it from this PR is a recorded decision, not an oversight.

Out of scope (already gated): Stripe webhook (signature), `/api/capture` + `/api/cron/*`
(token/secret), `/email/unsubscribe/[token]` (signed token).

## 3. The layers

Rate limiting is the floor, not the roof. Every authority surveyed (M3AAWG, Spam Resource,
Suped, OWASP) ranks bot detection **first**.

| # | Layer | Stops | Survives Upstash down? |
| --- | --- | --- | --- |
| **0** | **Bot detection** (Turnstile, §9) — in the §4 locus | both attack shapes, pre-send | **YES** |
| **1** | **Rate limiting** (§7, §8) | amplification | no (degrades — §8) |
| **2** | **Degradation + circuit breaker** (§8) | amplification, coarsely | yes (in-process; aggregate sends NOT bounded mid-outage — §8.1) |
| **3** | **Observability** (§10) + **kill switch** (§12) | nothing — it tells you, and lets you turn it off | yes |

Layer 0 is the one that matters most and the only one that holds when Upstash is unavailable —
which is what makes the degrade-don't-disable policy (§8) tolerable.

## 4. The single locus — the spine of the design

**Root cause of half the validation defects:** the v2 design split the rate limiter and Turnstile
across **two `@auth/core` callbacks that run in a fixed order**, and that split *was* the bug
(D1, R2-4, P1, enforce-before-turnstile). The `signIn` callback never receives the request body,
so Turnstile cannot run there; and `enforce` in the callback runs *before* `sendVerificationRequest`,
so a bot with a garbage token drains the victim's per-email counters *before* Turnstile blocks the
send — weaponizing the per-email limit against the victim it protects.

**Both belong in one place.** The Resend provider's **`sendVerificationRequest`**
([`src/auth.ts:93`](../../src/auth.ts#L93)) is the single point inside `@auth/core` that has
*both* the normalized email (`identifier`, from `send-token.js:49`) *and* the token body (via
`toRequest`, `web.js:44-52`), and it is reached by **every** send entry path. Verified coherent
against installed source on validation round 6.

### 4.1 What the locus does, in order

Today `sendVerificationRequest` destructures `{ identifier, provider, url }`. The rewrite also
destructures **`request`** (available in the provider params) and runs:

1. **Read the request body** via `await request.json()` — **NOT `request.formData()`**.
   `toRequest` JSON-stringifies the body but leaves a stale `x-www-form-urlencoded` content-type,
   so `formData()` misparses it. This yields the Turnstile token, the honeypot field, and the
   dwell value.
2. **Check honeypot + dwell** (§9) → on trip, **throw a plain `Error`**. These are Layer-0 denials;
   like every locus denial they **throw, never early-return** (an early return is the silent-"sent"
   bug, §4.2).
3. **Verify Turnstile** → on failure, **throw a plain `Error`** (§4.2). Fail-closed (§9).
4. **Run `enforce()`** on the per-email + global checks (Turnstile-first, so a bot never drains
   the counters) → on deny, **throw a plain `Error`**.
5. Else **send** the Resend email (the existing branded-email logic, unchanged).

### 4.2 Why "plain `Error`" is load-bearing (proved rounds 5–6)

Under a server-action send (`Auth(req, { raw, skipCSRFCheck })`, `redirect:false`):

- A **plain `Error`** is *not* an `AuthError`, so `index.js:124`'s re-throw is skipped; it becomes
  **`?error=Configuration`** on the returned URL — the discriminator a caller can read.
- An **`AuthError` subclass** would re-throw → **500**.
- An **early return** yields the normal verify-request redirect with **no `?error=`** —
  indistinguishable from a real send → the modal says "your guide is on the way" for an email
  that was never sent (R2-2). Never return early.
- A **success** returns `/verify-request?...` with no `error` — a clean discriminator.

`Configuration` is overloaded with genuine config faults (unavoidable — it is the only code a
plain throw yields). The pages map it to **generic** copy (§6); observability (§10) owns
operator-side disambiguation.

### 4.3 The IP-only pre-check in the `signIn` callback

`enforce` in the locus runs *after* the `VerificationToken` INSERT is dispatched
(`Promise.all` race), so a blocked request still writes a token row — **unbounded** under a
rotating flood, not the benign single row D1 assumed. Fix: a **cheap IP-only pre-check** in the
`signIn` callback ([`src/auth.ts:136`](../../src/auth.ts#L136)), **before** `createVerificationToken`,
that caps a rotating flood before the row is written. **Gate it to the magic-link SEND step only**
(`account?.provider === "resend" && email?.verificationRequest === true`) — Google/GitHub traverse
this same callback but **skip the check entirely**, which is what keeps §4.4/§8.2's "OAuth never
touches Redis" true. An unconditional pre-check would IP-rate-limit OAuth and, under
`escalate-closed` during an outage, fail **all three** sign-in paths closed. `headers()` works
inside this callback
(the session-conflict guard already calls `auth()` there — [`src/auth.ts:159`](../../src/auth.ts#L159)),
via a **dynamic** `import("next/headers")` (matching the `events.signIn` pattern at
[`src/auth.ts:236`](../../src/auth.ts#L236) — `next/headers` must not land in the middleware
bundle that imports this module).

This two-point split is **adjudicated coherent**: it preserves the D7 consumption order with no
double-count (IP in the callback, per-email + global in the locus). The residual that the IP
pre-check runs *before* Turnstile is an **accepted NAT residual**, not the R2-4 hazard — IP is
*not* the victim-inbox protection, so an early IP check cannot be weaponized against a victim's
inbox.

The pre-check **returns a redirect string** (`/sign-in?error=rate_limited`) — the existing
`resolveSignIn` pattern — **not a throw**. A callback throw is wrapped as `AccessDenied` by
`send-token.js:29-31`, which `index.js:124` **re-throws to a server-action 500** under `raw`
(verified) — so the pre-check must NOT throw; a returned string short-circuits at
`send-token.js:34` *before* both `createVerificationToken` and the send, which is precisely what
lets the pre-check prevent the token write. It surfaces uniformly as a URL `?error=` on both the
page (browser redirect) and the modal (URL inspection); the page maps this `rate_limited` code and
the locus's `Configuration` to the **same generic banner** (§6).

**Residual (stated honestly):** the pre-check bounds a *same-source* flood (one host / one /64). A
genuinely **distributed** flood (the canonical bombing shape, §2 — many /64s, each passing the IP
check) still writes **one `VerificationToken` row per attempt**, because the row is created before
the locus's Turnstile/`enforce` run. That residual is **DB rows, not emails** — the email stays
Turnstile-gated in the locus, and the rows are short-TTL and expire. Bounding distributed
token-row growth further (e.g. a global write cap) is deferred; the harm is DB write-amplification,
not delivery.

### 4.4 The `signIn` callback does no other abuse work

Only the existing `resolveSignIn` session-conflict logic plus the IP pre-check (§4.3). Its
string-return short-circuits *before* `sendVerificationRequest` (`send-token.js:34`), so the two
loci are sequential and non-interacting. **OAuth (Google/GitHub) never reaches
`sendVerificationRequest`** and is fully untouched.

Every send reaches the locus through a **thin server action** — the page's `resendAction` and the
modal's `resend` / `google` / `github` actions, all in-process `Auth(req)`, never client HTTP. The
lead-magnet modal **abandons `next-auth/react` `signIn`** for all three buttons, which collapses it
onto the page's transport; at that point the raw `POST /api/auth/signin/*` carries no legitimate
traffic and is **404'd** (OAuth `GET /api/auth/callback/*`, `csrf`, `session`, `signout` stay open).
The server actions are **thin pass-throughs**: they forward `email` + `cf-turnstile-response` +
honeypot + dwell and **verify nothing themselves** — "thin" means no abuse checks, but the modal
action still maps the field-guide `redirectTo` (§5). Putting Turnstile or `enforce` in a
server action *on top of* the locus would double-run the single-use Turnstile token and increment
`burst:1/60s` to 2 — killing every modal send (P1). One locus; thin actions.

### 4.5 Why it must be application-level

`src/proxy.ts` cannot be a fallback: it excludes both `sign-in` and `api/auth`, and server
actions POST to their own route. Vercel Firewall cannot either — the abuse rotates IPs and needs
a per-**email** decision, which the firewall cannot see in the POST body. So this is inherently
application-level, which is also why it is portable (§13).

## 5. Redirect mode by resolution semantics

The denial signal (`?error=Configuration`) surfaces differently depending on how the caller
resolves the sign-in, and **the page and the modal need opposite mechanisms**. Assigning the
mode by *surface* is wrong; assign it by **resolution semantics**:

> **Invariant:** `redirect:false` + inspect-the-returned-URL-for-`?error=` **⟺** the surface
> stays **mounted** and renders the outcome — true for the **modal magic-link send only**.
> Everything that **transfers the browser** — OAuth (any surface) *and* the page/B1 magic-link
> forms — is `redirect:true`.

- **Page magic-link form + B1 "Resend" button** use **`redirect:true`**. A thrown `Error` lands
  on the error page — but `pages.error` is **unset** today ([`src/auth.ts:259`](../../src/auth.ts#L259)),
  so it dumps the user on the raw `/api/auth/error?error=Configuration`. **Fix:** set
  **`pages.error = "/sign-in"`** and add a `Configuration` branch **and a `rate_limited` branch**
  (or an unknown-code → generic default — the §4.3 IP pre-check lands `rate_limited` on this page
  too) → generic copy. Going
  `redirect:false` on the page would break the B1 "check your email" verify-request state, so the
  split is intentional.
- **Modal magic-link resend** uses **`redirect:false`** and inspects the returned URL for
  `?error=`. This is the only place URL inspection is correct, because the modal stays mounted.
  The server pass-through must set **`redirectTo: fieldGuideWelcomePath(guide)`** — client
  `callbackUrl` → server `redirectTo`, which *overwrites* a stray `callbackUrl`. Without the rename
  the reader gets the **generic** email and the wrong landing (`guideFromWelcomeUrl` at
  [`src/auth.ts:99-103`](../../src/auth.ts#L99-L103) sees nothing) — tsc-clean, vitest-blind (P2).
- **Modal OAuth (Google/GitHub)** stays **`redirect:true`**. Under `redirect:false` an OAuth
  `signIn` returns the *provider's auth URL* (no `?error=`), so "inspect for `?error=`" would read
  a successful Google init as a result-to-display and **never navigate to Google** — a dead-end +
  false-success on the conversion buttons. This is the semantics rule in action: OAuth transfers
  the browser, so it is `redirect:true`.

## 6. The denial contract

Denials surface as one of two codes: **`?error=Configuration`** (the locus throws — Turnstile,
per-email, global, degradation) or **`?error=rate_limited`** (the §4.3 callback IP pre-check's
returned redirect). The pages map **both** to the **same generic** banner — never "too many
requests *for this address*",
which is an account-existence oracle (§7). We cannot set a 429 or `Retry-After` (a server action
returns a value, not a status), so generic copy on `/sign-in` is the UX we have.

The full **3×4 denial matrix** — page / B1 / modal × Turnstile / IP / email-global / degradation
— was traced on the final validation pass and has **no empty and no false-success cell**. The
`Configuration` overload with a genuine config fault is acceptable under generic copy;
observability (§10) disambiguates operator-side.

## 7. The limits and the keys

Published limits for this endpoint class (Auth0 `/passwordless/start` 50/hr per IP; Supabase
magic-link resend 1/60s per user; Cognito `ResendConfirmationCode` 5/hr per user; Firebase
email-link 5/day per project; the mature providers all use a **composite** of email × IP plus a
project-wide ceiling).

**Adopted rules:**

| Rule | Limit | Basis |
| --- | --- | --- |
| `magic:email:burst` | **1 / 60 s** | Supabase's exact cooldown |
| `magic:email:hour` | **5 / hr** | Cognito `ResendConfirmationCode` |
| `magic:email:day` | **15 / day** | bounds a slow-drip bomb the hourly misses |
| `magic:ip:hour` | **50 / hr** | Auth0 `/passwordless/start` |
| `magic:global:day` (soft / hard) | **env-overridable** | see §7.3 |
| `waitlist:ip:hour` | 20 / hr | it is a form |
| `tip:ip:hour` | (set at build) | anonymous Stripe endpoint (§2) |

Per-email protects the *victim's inbox* → small, cooldown-shaped. Per-IP protects *our* quota →
generous (a tight per-IP limit fails asymmetrically: an attacker rotates IPs for pennies while
the cost lands on office/university/CGNAT users).

### 7.1 Key normalization — the per-email layer is only as good as its key

`emailKey` canonicalizes the **counter key only** (never the delivered address — `@auth/core`
already normalized that, and the send must keep the raw address):

- **Strip `+suffix` for all domains**, and **strip dots for gmail/googlemail** — `victim+1@gmail.com`
  … `victim+9999@gmail.com` and `v.i.c.t.i.m@gmail.com` all deliver to one inbox, and
  `@auth/core`'s `defaultNormalizer` preserves `+` and `.`. Without this they are thousands of
  distinct keys, each with its own budget → the per-email cap (the primary victim protection) is
  bypassed up to the global cap (~33×), against the harm the design names as primary (D5).
- Extend to documented providers (outlook/hotmail/icloud/fastmail `+`, yahoo `-`).
- The "false-positive rabbit hole" objection does not apply to a *counter* key — worst case is one
  extra 60 s wait.

`clientIp` normalizes **IPv6 to /64** before keying — an IPv6 host controls a /64
(2⁶⁴ addresses) and rotates for free, so keying on the full address protects nothing (N2). The
same helper backs `waitlist:ip` and `tip:ip`.

### 7.2 Keys are HMAC'd at rest, pinned to `AUTH_SECRET`

Upstash stores the keys, so a raw-email/raw-IP key set is **a list of exactly the victims being
bombed** at rest. HMAC-hash after normalization, before keying — the limiter needs only equality,
so it is transparent. **Plain SHA is reversible for IPv4/emails** — it must be **HMAC-with-secret**.

Pin the HMAC key to **`env.AUTH_SECRET`** (reuse the `capture-token.ts` / `certificate-token.ts`
pattern) — deterministic, no new env var. A per-instance random salt would **fragment the
per-email counter** across instances (`N_instances × limit`) on the *healthy* path
(hmac-key-unprovisioned). **Transform order is load-bearing:** normalize-alias (§7.1) → IPv6 /64
(§7.1) → **HMAC last**.

### 7.3 `magic:global:day` — a ceiling, not a kill switch

The v2 hardcoded `500/day` — unsourced, attacker-triggerable, and un-raisable at 3am (D7).
Corrected:

- **Env-overridable** (`MAGIC_GLOBAL_DAILY_CAP`, following the `REACTIVATION_DAYS` /
  `LAUNCH_WINDOW_DAYS` precedent). Test the **default**, not the resolved value.
- **Soft / hard split.** Soft threshold (e.g. 80%): **alert** (§10), and *optionally* flip the
  widget to interactive. That escalation needs a server→client channel (the counter is server-side,
  the widget mode is render-time) — reuse the **Edge Config** infra (§12.1): a `turnstileInteractive`
  flag the soft-breach detector (§10) writes and the widget reads at render (**read failure / absent
  → the managed default, non-interactive** — never escalate a legitimate user on an Edge Config
  blip). If that flag is not built, **the soft cap is alert-only** — a server counter does not
  change the widget by itself. It does **not** deny.
  Hard cap: deny, set **well above** forecast campaign volume with the arithmetic shown at build.
- **Ordered LAST**, with documented consumption semantics: `limit()` burns each counter as called,
  so an earlier denial must leave `global:day` unincremented (else the attack cost drops from ~10
  hosts to 1). Test that an earlier denial leaves the global counter untouched.

### 7.4 Env-namespaced prefixes

Prefix every rule by `process.env.VERCEL_ENV` (N1). `otd-academy-ratelimit` is connected to
**Production and Preview with the same credentials**; static prefixes make Preview and Prod share
every counter — including the 24h global cap — so any preview URL can drain prod's ceiling, and
the preview correctness gates (which deliberately trip limits) would pollute prod. Namespacing is
what makes Development's exclusion (§12) consistent with the rest.

## 8. Failure behaviour — DEGRADE, don't disable, and know which way

v1 said fail-open; that was refuted (§13). The corrected policy has a **`failMode` parameter on
`enforce()`** — the signature the whole plan uses:

| Tier | `failMode` | On Upstash failure |
| --- | --- | --- |
| **1** (magic link) | `escalate-closed` | degrade (below), then escalate to deny |
| **2** (waitlist, guest tip) | `open` | fail open — reversible, cheap |
| **3** (deferred) | n/a | (follow-up PR) |

"Tier 2 fails open" is **unimplementable without this param** — a single ladder that escalates to
deny would fail the waitlist **closed** during an outage (tier2-fail-open-unwired).

### 8.1 The degradation ladder (reworked)

The v2 ladder was internally broken in four ways; the corrected ladder:

- **Rolling failure-RATE breaker over a window, NOT a consecutive count.** A *consecutive*-failure
  counter never opens against a slow-but-intermittent Upstash (each just-under-timeout success
  resets it) — the exact Stalloris regime the breaker exists for. **Requires a minimum in-window
  sample size** (Parameters) so the rate is not "50%-of-2" on low traffic.
- **`reason:"timeout"` is a degrade signal, not a verdict.** `@upstash/ratelimit`'s timeout
  **resolves** `{ success: true, …, reason: "timeout" }` — it never throws. So a genuinely
  hanging Upstash returns `success: true` → ALLOW, and the whole ladder is skipped (D4). After
  every `await rl.limit(key)`, route `res.reason === "timeout"` into the ladder **before** reading
  `res.success`.
- **No per-instance count is claimed to bound aggregate sends.** `ephemeralCache` is a block-list
  memo written only *after* a successful Redis round-trip returned `success:false` — during an
  outage the Map is **empty** (D6), and a real in-process counter still enforces per-instance, so
  the effective cap is `N_instances × limit` and `N_instances` grows with the attack. Adjudicated
  to **option B**: a brief, bounded **allow-grace** then deny, stated plainly — *nothing bounds
  aggregate sends between outage-start and escalation*; that is the accepted cost, and Layer 0
  (§9, Upstash-independent) is what keeps it tolerable.
- **Explicit half-open recovery with a wall-clock bound.** The escalate-to-deny state must define
  a reset/half-open probe, or a warm instance keeps denying real sign-ins after Upstash heals (and
  per-instance state means some instances deny while siblings allow — nondeterministic UX).
- **Deadlines reconciled with the two-point split (§4.3).** Enforcement runs at *two* points on a
  magic-link request: the callback IP pre-check (**1** check) and the locus `enforce()` (**4**
  checks — email burst/hour/day + global). D7's ordered consumption forces the locus's four to run
  *sequentially* (an earlier denial must not increment `global`), so the locus carries **one
  `enforce()` deadline** bounding those four (≈ 4 × `timeout:1000` = ~4 s worst case); the callback
  IP check is a single `limit()` with its own ~1 s timeout. Worst case on a slow Upstash is the sum
  across the two points (~5 s), *not* one bounded call — state it, do not pretend it is ~1s.
  `Promise.all` within the locus would break the ordering. The breaker / half-open state is
  **module-scope and shared** across both enforcement points on an instance. When escalate-closed
  fires, the locus `enforce()` **throws** (→ `Configuration`) and the IP pre-check **returns its
  `rate_limited` deny string** (§4.3) — same shared state, each surfacing via its own path.

### 8.2 Why fail-closed on Tier 1 is not a catastrophe

The check runs *only* on the magic-link step. **Google and GitHub sign-in never touch Redis**, so
fail-closed degrades one of three sign-in paths, not "a total sign-up outage." And "attack the
limiter first" is a published, measured technique — **Stalloris (USENIX Security '22)** induces a
security dependency's unavailability to force fail-open. Fail-open trades a minutes-long,
self-healing Upstash outage for a potentially weeks-long, human-gated Resend suspension: strictly
negative. The blast-radius split is real — edge layers in front of *all* traffic fail open;
**app-level limiters with an external store guarding one costly action fail closed**
(express-rate-limit `passOnStoreError:false`, nginx `limit_req`, AWS ALB `waf.fail_open.enabled:false`).
Ours is the second kind.

## 9. Layer 0 — bot detection

**Cloudflare Turnstile** on every magic-link send surface, verified server-side **in the §4
locus** before `enforce` runs.

- **Portable** (works on any host — consistent with §13; **Vercel BotID would be lock-in** for the
  one control we least want to re-buy on a migration).
- **Managed / cookieless mode**: invisible for honest users, ~zero cost, and — because it is
  cookieless — a **disclosure** obligation, not a consent banner (§11). **Do not enable
  Pre-Clearance** (it sets a cookie).
- **The only layer that survives an Upstash outage** (§3) — which is what makes §8 tolerable.
- **Fail-closed** on a verification error, deliberately — the opposite of the limiter's
  degradation. Turnstile is Cloudflare-hosted and independent of Upstash; if it is unreachable and
  we let the send through, we have no layer left. **Give `siteverify` an explicit timeout (~2 s):**
  a *hang* is not a "verification error", so without a timeout a slow Cloudflare blocks the request
  unboundedly and never trips fail-closed — on timeout **or** throw, treat as failed (throw plain
  `Error`). This ~2 s is separate from the §8.1 Upstash budget.

**Env pairing is validated cross-field.** `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
must be **both-set-or-both-unset** (a `superRefine` in `src/env.ts`, §12). Site-set-secret-unset →
widget renders but the verifier waves everyone through (silent-off); secret-set-site-unset → no
widget → everyone denied (R2-3).

**Honeypot + dwell**, with the corrections: a hidden field a human never fills, and a minimum
form-dwell **measured from first interaction, not mount** — and **exempt the pre-filled fast
paths** (C1 one-click welcome-back, B1 Resend, the reopened lead-magnet modal), which a
mount-based timer wrongly rejects (N3). The honeypot read is pinned to the §4 locus (P3). Honeypot
and dwell are **Layer-0 denials**, so the §12.1 kill switch suppresses them along with Turnstile.

**Fresh token per send.** Turnstile tokens are single-use (P1 relies on this). The B1 Resend button
and a reopened modal must **mint a new token** (`refreshExpired: "auto"`, a per-widget instance),
never reuse a consumed one — a stale token fails closed and false-denies a legitimate resend (D2).

## 10. Observability — a first-class layer, not a footnote

Pull-only logs cannot detect "under attack now" — a bombing run finishes in **minutes**, and the
crons run daily. The design adds:

- **Per-rule denial metric.** `capture("magic_link_denied", { rule })` on every denial; alert on
  the `magic:global` share (a global-cap DoS is otherwise invisible until conversions crater).
- **Turnstile-outcome + separator events.** `turnstile_failed`, `honeypot_tripped`, and a
  distinct-email-vs-IP ratio — a paid campaign *is* a signup spike, and Turnstile's managed
  pass/fail rate is the only thing that separates a viral spike from a bot flood.
- **One real push alert.** Reuse the existing `sendSourcingDigest` admin-email-on-threshold
  pattern; fire on a **breaker trip** and the **`magic:global` soft threshold**.
- **`analytics` — pick one source of truth.** `@upstash/ratelimit`'s `analytics:true` powers the
  Upstash dashboard but costs +1 command/call; `analytics:false` blinds that dashboard. Do not do
  both. **Recommendation: `analytics:false` and make app-level `capture()` the source of truth**
  (portable, host-agnostic, and the events above are richer than the dashboard).
- **Delete the "Upstash spend alert = intrusion alarm" claim** — a monthly-budget email can't
  track a burst, a *working* defense looks like a spend spike (false positive), and a fail-open
  flood bills **zero** commands (silent exactly when it matters). Alarm on Resend send-rate +
  denial-rate instead.

## 11. Privacy and compliance

The repo has **no privacy policy** (only `/license`, a software license). Turnstile is a
**pre-consent third party** (it sends IP/UA/TLS signals before the user agrees to anything), and
the lead-magnet modal collects no consent at all.

- **Publish `/privacy`.** The obligation is **disclosure (Art. 13), not a consent banner** —
  Turnstile is cookieless in managed mode and fraud-prevention is "strictly necessary." Cover:
  controller, legitimate-interest basis, data categories, recipients (**Cloudflare + Upstash**),
  retention (= the rule TTLs, §7), and US-transfer basis. Link it from **sign-in, the lead-magnet
  modal, and the footer**.
- **Do NOT add a consent banner** and **do NOT enable Turnstile Pre-Clearance** (which sets a
  cookie and flips this from disclosure to consent).
- **HMAC at rest** (§7.2) is also a privacy control — it keeps Upstash from holding a plaintext
  victim list.
- **Confirm the Cloudflare + Upstash DPAs (Art. 28)** are in force before ship; document the TTLs
  as the retention policy.
- **CAN-SPAM is clean** — the gate touches only the transactional send path, never the
  `emailConsent` marketing path.

## 12. Kill switch, env, provisioning

### 12.1 Runtime kill switch — one unified predicate

Both Layer 0 and the limiter are Tier-1 **fail-closed**, so a runtime off-switch is mandatory.
**Vercel env changes require a redeploy** (verified) — so an env flag is *not* runtime. Gate both
on a **Vercel Edge Config** flag (request-time read, no redeploy).

Resolve **one `defenseEnabled` boolean = the Edge Config flag alone**, and let it gate **every
denial point**: **all Layer-0 denials** (Turnstile verify, honeypot, dwell), the locus `enforce`
throw, *and* the §4.3 callback IP pre-check (each returns `allow` when disabled). Honeypot and dwell
have no env pair, so their `layerConfigured` is implicitly true — they are gated by `defenseEnabled`
alone. **Env-pair presence is an orthogonal per-layer
guard, not folded into `defenseEnabled`** — folding `turnstileEnabled` / KV-presence into the one
predicate would make an unset Turnstile pair disable the *working* Upstash limiter (and vice
versa). The literal rule per layer is **`deny iff defenseEnabled && layerConfigured && layerDeny`**.
That closes the `killswitch-no-unified-defense-predicate` trap (flip the flag → every denial point
allows) with no cross-layer collision. An **Edge Config read failure → treat as enabled**, with a
short timeout.

### 12.2 Env vars — all OPTIONAL, cross-validated

`KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash) and `TURNSTILE_SECRET_KEY` /
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Turnstile) are declared **OPTIONAL** in `src/env.ts` (matching
the `STRIPE_SECRET_KEY` / `R2_*` precedent — a keyless build/CI must pass), but with a
**`superRefine`** enforcing **each pair both-set-or-both-unset** (§9). When a pair is unset the
corresponding layer no-ops and logs once at boot. State the states precisely: with **Upstash unset
but Turnstile configured**, the rate-limit floor is gone but **Layer 0 still holds** — the tolerable
degraded mode. With **both pairs unset the deploy has no protection at all** (Layer 0 is off too) —
an unconfigured production deploy is an unprotected one. (**Turnstile-unset-but-Upstash-set** is the
inverse partial: the floor holds but Layer 0 — "the one that matters most" — is off; worse than
Upstash-unset.) `superRefine` allows both-unset so keyless CI passes, so add a **boot warn when
`VERCEL_ENV=production` and defense is unconfigured** (warn, not fail — a hard fail would break a
keyless preview). Only Upstash-unset is a safe partial state.

Construct the Upstash client **explicitly** (`new Redis({ url, token })`), not `Redis.fromEnv()`:
`fromEnv()` reads `UPSTASH_REDIS_REST_*` (our names are only its fallbacks) and, on missing vars,
`console.warn`s and returns a client with `url: undefined` that fails at *request* time. Explicit
+ validated env fails at boot instead. Use the **write** token — `KV_REST_API_READ_ONLY_TOKEN`
cannot `INCR`.

### 12.3 Provisioning — DONE (both inert until code ships)

- **Upstash `otd-academy-ratelimit`** — Redis via Vercel Marketplace, iad1 (matches prod, this
  sits in the sign-in path), eviction OFF (rate-limit counters are not disposable), PAYG + budget
  cap. Env injected on **Production + Preview** (Sensitive); **not** connected to Development
  (local dev must not share a security control's counters, and the IP path only exists on a real
  Vercel edge).
- **Cloudflare Turnstile** — **Production has real keys** (managed, cookieless); **Preview has
  Cloudflare test keys** (always-pass; the real widget's hostname won't match `*.vercel.app`). For
  a reject-path preview gate, swap Preview to the always-block test key.
- New deps: `@upstash/redis`, `@upstash/ratelimit`, and a Turnstile widget lib
  (`@marsidev/react-turnstile` or equivalent).

## 13. Portability

Deliberately host-agnostic. Upstash is HTTP-based (runs anywhere); Turnstile runs anywhere; the
whole design is application-level. Moving off Vercel needs **one** change: the client-IP header
list — prefer `x-vercel-forwarded-for`, fall back to `x-forwarded-for`, first hop, **trustworthy
on Vercel only** (Vercel overwrites XFF to prevent spoofing; **on any other host this is spoofable
and the IP limit becomes worthless — re-verify before migrating**). This is why Upstash beat
Vercel Firewall and Turnstile beats BotID.

## 14. What the earlier designs got wrong (the audit trail)

Full detail in `2026-07-16-signup-abuse-defense-VALIDATION-FINDINGS.md`. In brief:

- **v1 (`rate-limiting-design.md`)** made rate limiting *the* defense, conflated bombing with
  amplification, used numbers 5–60× tighter than any published provider, would have built an
  enumeration oracle, believed `timeout` delivers fail-open (it does not), and would have bricked
  email sign-in on the first Upstash blip. Refuted by five adversarial agents.
- **v2 (this file's predecessor)** put Turnstile in the `signIn` callback where it cannot read the
  token (D1), covered 1 of 3 send call sites (D2), let the lead-magnet modal report "sent" on a
  denial (D3), silently allowed on a slow Redis (D4), was Gmail-alias-bypassable (D5), rested
  degradation on an empty Map (D6), and shipped an unsourced attacker-triggerable global cap (D7).
- **The convergence** (four passes, ~50 findings): several v2 *fixes contradicted each other*, and
  the single-locus architecture in §4 is what reconciles them. The whole accumulated fix set was
  traced together on the final pass — **no fix breaks another**.

### Load-bearing traps to carry into CLAUDE.md / the build

- `sendVerificationRequest` reads the body with **`await request.json()`**, not `formData()`
  (stale content-type).
- The denial signal is a **plain `Error`** → `?error=Configuration`; never an `AuthError` (500),
  never an early return (silent "sent").
- The `Ratelimit`/`Redis` instances live in a **plain** module — a `"use server"` file may export
  only async functions; `export const ratelimit = …` there crashes at runtime with **tsc silent**.
- `next/headers` in `auth.ts` must be a **dynamic** import (middleware-bundle rule).
- Redirect mode is assigned by **resolution semantics** (§5), not surface.
- **VERIFIED (against `@auth/core@0.41.2` / `next-auth@5.0.0-beta.31`):** a `signIn`-callback
  **string return** (`/sign-in?error=rate_limited`) DOES surface as an inspectable URL under a
  `redirect:false` server-action call — server `signIn` returns the URL *string* (`actions.js:48-54`
  reads the raw `{ redirect }` object from `index.js:109-113`, not a `Response`/302). Success returns
  a `/verify-request…` URL with no `?error=`; same code path, discriminated by the query. **The IP
  pre-check must therefore RETURN the string, never throw:** a callback throw → `AccessDenied`, which
  `index.js:124` **re-throws to a server-action 500** under `raw`; a plain-`Error` throw surfaces but
  collapses to `?error=Configuration` (loses the `rate_limited` code). Callers key off the parsed
  **`?error=`, never `ok`/truthiness** (status is 200 on denial — the D3 trap). No custom `redirect`
  callback exists in `auth.ts`; if one is ever added it MUST preserve the path + error query (the
  default `init.js:13-19` does).

## Parameters — indicative values (final tuning in the build PR)

The knobs the build needs. Indicative starting values so a builder can write the code today; the
**final** values are set in the build PR — caps against forecast campaign volume, breaker values
against a preview soak. None are load-bearing for the architecture.

| Knob | Indicative | Notes |
| --- | --- | --- |
| `MAGIC_GLOBAL_DAILY_CAP` default (hard) | e.g. **2000/day** | set well above forecast volume; test the default, not the resolved value (§7.3) |
| `magic:global` soft threshold | **80%** of cap | alert + optional interactive (§7.3) |
| `tip:ip:hour` | e.g. **10/hr** | anonymous Stripe endpoint (§2) |
| min form-dwell | e.g. **1500 ms** from first interaction | exempt fast paths (§9) |
| breaker window | e.g. **30 s** rolling | failure-RATE, not consecutive (§8.1) |
| breaker trip threshold | e.g. **≥50%** failures in-window | opens the circuit |
| breaker min in-window sample | e.g. **≥20** calls | rate ignored below this — no "50%-of-2" false trip (§8.1) |
| allow-grace | e.g. first **~2 s** after trip | then deny (§8.1, option B) |
| half-open probe interval | e.g. **30 s** | one probe; success closes, failure re-opens (§8.1) |
| Edge Config read timeout | e.g. **200 ms** | read failure → treat as enabled (§12.1) |
| IPv6 prefix | **/64** | §7.1 |

**Still genuinely open** (not numbers a builder can guess): exact `/privacy` retention wording; the
Cloudflare + Upstash DPA (Art. 28) confirmation; the final hard-cap + alert arithmetic against the
real forecast. Checklist items for the build PR, not architecture.
