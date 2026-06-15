# OTD Academy — Multi-provider sign-in (GitHub + Email magic-link)

_2026-06-15. Design for extending academy sign-in beyond Google-only, per the
`[DECIDED]` in `2026-06-09-public-narrative-skill-tree.md` §6/§7: add **GitHub OAuth**
+ **Email magic-link** (Resend), defer Apple/Microsoft. Validated against the installed
`@auth/core@0.41.2` / `next-auth@5.0.0-beta.31` source — citations below are line refs
in `@auth/core/lib/actions/callback/handle-login.js` unless noted._

> **Status:** brainstormed + validated 2026-06-15. The central security call
> (account-linking policy) is **locked**; the rest follows established patterns.

---

## 1. The decision: auto-link by verified email

When Google, GitHub, and magic-link present the **same verified email**, they resolve to
**one account** (one set of `Entitlement`s). This is the locked policy.

**Why:** it's the payoff of the future guest-checkout claim flow — *pay with email X,
later sign in / claim with email X via any provider, land on the same account*. Keeping
accounts separate would silently fork a buyer's identity and lose their entitlement.

**How it's made safe:** linking only ever fires on a **verified** email. The `signIn`
callback computes per-provider verification and the pure guard **rejects any sign-in
whose email isn't provider-verified** — and that callback runs *before* Auth.js does any
create/link (`handleAuthorized` → guard precedes `handleLoginOrRegister`; reject →
`AccessDenied`, string → redirect). So `allowDangerousEmailAccountLinking` only ever sees
a verified address. The residual trust is "each provider verified the email," which the
guard enforces explicitly (including GitHub, which doesn't self-report verification).

### How the linking actually resolves (validated)
- **OAuth ↔ OAuth** (Google ↔ GitHub, same email, not signed in): requires
  `allowDangerousEmailAccountLinking: true` on each OAuth provider, else core throws
  `OAuthAccountNotLinked` (line 236/250). With the flag, the new account links to the
  existing user-by-email.
- **Magic-link → any same-email user**: automatic by construction (line 55–90). The
  `type:"email"` branch resolves via `getUserByEmail`, signs into that existing user
  (whether Google- or GitHub-created), and stamps `emailVerified`. No flag needed — this
  is what enables a clean guest-claim.
- **Active-session protection** stays: never absorb a *different* identity into a live
  session → bounce to `SESSION_CONFLICT_REDIRECT`. With JWT sessions, core's own
  "switch user on email sign-in" is a no-op (it only deletes sessions when
  `!useJwtSession`), so **our guard is the protection layer** for that case.

---

## 2. The generalized guard (`auth-link-guard.ts`)

`resolveGoogleSignIn` → **`resolveSignIn`**, provider-aware but still a **pure function**
(no I/O), so it stays unit-testable. Contract:

```ts
resolveSignIn({
  provider,              // "google" | "github" | "resend" | undefined
  emailVerified,         // boolean | undefined — computed by the caller per provider
  profileEmail,          // string | undefined
  activeUserEmail,       // string | undefined — read via auth()
  isVerificationRequest, // true on the magic-link SEND step
}): true | false | SESSION_CONFLICT_REDIRECT
```

Decision order:
1. **Magic-link send step** (`isVerificationRequest === true`): allow — no identity to
   verify yet; Auth.js is only emailing a token. (Still subject to the conflict check
   below so we don't email a link while signed in as someone else.)
2. Reject if `profileEmail` missing.
3. Reject if `emailVerified !== true`.
4. **Session conflict**: `activeUserEmail` present and `!== profileEmail`
   (case-insensitive) → `SESSION_CONFLICT_REDIRECT`.
5. Allow.

The provider-specific *knowledge* lives in the caller (`auth.ts`), not the guard.

---

## 3. `auth.ts` wiring

```ts
providers: [
  Google({ clientId, clientSecret,
    authorization: { params: { prompt: "select_account" } },
    allowDangerousEmailAccountLinking: true }),
  GitHub({ clientId, clientSecret,
    allowDangerousEmailAccountLinking: true,
    userinfo: { /* override: always fetch /user/emails, attach email_verified */ } }),
  Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.AUTH_RESEND_FROM }),
]
```

- **GitHub verification.** The default provider requests `read:user user:email` already,
  but only fetches `/user/emails` when the public email is absent and picks the primary
  **without checking `verified`**; its `profile()` carries no verified flag. So we
  override `userinfo.request` to **always** fetch `/user/emails`, select the
  `{ primary: true, verified: true }` entry, set `profile.email` to it, and attach
  `profile.email_verified = true|false`. The `signIn` callback then reads
  `profile.email_verified` **uniformly** for Google and GitHub. Fail closed (no verified
  primary, or fetch error → unverified → reject).
- **`signIn` callback** computes:
  - `isVerificationRequest = email?.verificationRequest === true`
  - `profileEmail = profile?.email ?? user?.email` (magic-link click has `user.email`, no
    `profile`)
  - `emailVerified`: send-step → n/a; `resend` click → `true`; `google`/`github` →
    `profile.email_verified`
  - then delegates to `resolveSignIn`, with `activeUserEmail` read via `auth()`
    (try/catch → fail-open, unchanged).
- **`jwt` / `session` callbacks unchanged** — role already resolves from the lowercased
  `user.email ?? token.email` against the admin roster, provider-agnostic.

---

## 4. Env (`env.ts`)

Three required server vars (Resend gets a sensible default `from`):
```ts
AUTH_GITHUB_ID: z.string().min(1),
AUTH_GITHUB_SECRET: z.string().min(1),
AUTH_RESEND_KEY: z.string().min(1),
AUTH_RESEND_FROM: z.string().min(1).default("OTD Academy <login@onethousanddrones.com>"),
```
Required (not optional) so a misconfigured prod deploy fails loud at build rather than
silently dropping a provider.

---

## 5. Sign-in UI (`sign-in/page.tsx`)

Keep the deep-space / command-gold chrome. CTA cluster becomes: **Continue with Google →
Continue with GitHub → "or" divider → email field + "Email me a link"**. The magic-link
path is a server action calling `signIn("resend", { email, redirectTo: "/" })`; Auth.js
redirects to its `verify-request` page. Generalize the `AccessDenied` banner copy from
"verified **Google** account" → "a verified account"; keep the `session_conflict` banner
+ inline sign-out.

---

## 6. Testing + verification

- **TDD the guard** (`auth-link-guard.test.ts`): rename to `resolveSignIn`, keep the
  Google regression cases, add — github verified→allow, github unverified→reject, resend
  send-step→allow, resend click→allow, cross-provider conflict→`SESSION_CONFLICT_REDIRECT`.
  RED → GREEN.
- **CI is the gate.** `tsc` + full `vitest` + `next build`; verify `build | pass`
  explicitly (memory: the GitHub `build` check can merge red on otd-academy).
- **Manual E2E** (needs live credentials): Google still works → GitHub → magic-link incl.
  the email landing.

---

## 7. External setup — the credential handoff (Josh only)

The code compiles + the guard is fully unit-tested **without** these. Live GitHub +
magic-link verification needs:
1. **GitHub OAuth app** → callback
   `https://academy.onethousanddrones.com/api/auth/callback/github` (+ a `localhost:3000`
   one for local). → `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
2. **Resend** → `AUTH_RESEND_KEY` + verify the `onethousanddrones.com` sending domain so
   `login@…` delivers.
3. Add all four vars to **`.env.local`** *and* the **Vercel `project-foundry`** project
   (Production + Preview).

⚠️ Local magic-link testing writes a `VerificationToken` row to the **prod** DB
(`.env.local` `DATABASE_URL` is prod) — harmless, but noted.

---

## 8. Out of scope
- Guest-checkout / `PendingEntitlement` / claim-on-login (the magic-link-*enabled*
  follow-up; gated behind L1 completion per the plan).
- Apple / Microsoft providers (deferred).
