# Tiers + Entitlements + Paywall — Design (Phase 2 of the GTM roadmap)

_2026-06-08. Validated design. Phase 2 turns the `accessTier` flag (added in
Phase 1) into a real per-project access product: FREE needs an account, PREMIUM
needs an entitlement — with a public sales page + a free first lesson per premium
project (SEO + taste), and an email **waitlist** wall until Stripe (Phase 3)._

> **Depends on Phase 1 (PR #45) being merged** — it builds on `Project.accessTier`,
> the guide-page access gate (`resolvePublicLessonAccess`), `isPublicPath`, and
> the chrome. Execute on a fresh branch off `main` after #45 lands.

## Decisions baked in (validated)

- **Premium teaser = public sales page + first lesson free.** A PREMIUM project's
  guide **hub** and its **first card (ordinal 0 / REQUIREMENTS)** are PUBLIC
  (anonymous-crawlable, for SEO + a real taste); cards 1+ are walled.
- **Paywall CTA = email-capture / waitlist** (no payments yet; Phase 3 swaps it
  for Stripe checkout).
- Entitlements are **per-project** now (owner-XOR reserves `bundleId` for Phase 4).
- FREE = any signed-in user. Entitlements in Phase 2 come only from an **admin
  grant** (comp/testing) until the Stripe webhook (Phase 3).

## Access model (the heart)

A pure, unit-tested decision over (project tier, card position, viewer):

```
resolveLessonAccess({ accessTier, cardOrdinal, hasSession, hasEntitlement, isAdmin })
  -> "allow" | "redirectSignIn" | "paywall"
```

- `isAdmin` → `allow` (always).
- **PUBLIC** → `allow` (any viewer, signed-out included) — Phase 1 behavior.
- **FREE** → `hasSession ? allow : redirectSignIn`.
- **PREMIUM**:
  - `hasEntitlement` → `allow`.
  - else `cardOrdinal === 0` → `allow` (the public free first lesson + crawlable).
  - else `paywall`.

This **supersedes** Phase 1's `resolvePublicLessonAccess` (a strict generalization;
the guide pages switch to it). The hub page treats a PREMIUM project as public
(the sales surface).

Middleware still only admits guide/courses paths (it can't DB-resolve entitlement);
the **page** loads the viewer's entitlement and decides allow / redirect / paywall.

## Schema (migration to prod Neon, AFTER #45 merges)

- **`Entitlement`** `{ id, userId, projectId?, bundleId?, source: EntitlementSource, createdAt }`
  - owner-XOR check (`projectId` XOR `bundleId`) mirroring the artifact-owner-XOR pattern.
  - `@@unique([userId, projectId])` (and `[userId, bundleId]`).
  - `enum EntitlementSource { GRANT PURCHASE }` (PURCHASE used in Phase 3).
- **`WaitlistSignup`** `{ id, email, projectId, createdAt, @@unique([email, projectId]) }`
  — anonymous email capture (no `userId`; it's for signed-out SEO traffic).

## Server actions

- `joinWaitlist({ email, projectId })` — `requireUser`? NO — accepts **anonymous**
  email (the point is signed-out funnel capture); validate email + that the project
  is PREMIUM; idempotent upsert on `[email, projectId]`.
- `grantEntitlement({ userId, projectId })` — **`requireAdmin`**; creates a
  `GRANT` entitlement. (Phase 3 adds the Stripe-webhook PURCHASE path.)
- Access reads: a helper that loads `Entitlement` for (viewer, project) — used by
  the guide pages + the enroll guard.

## Gating + UI

- **Guide card page**: resolve `card.ordinal` + viewer entitlement, call
  `resolveLessonAccess`; on `redirectSignIn` → `/sign-in`; on `paywall` → render
  the **Paywall** instead of the lesson.
- **Guide hub**: public for PREMIUM (the sales page) — lesson list + descriptions,
  card 0 open, cards 1+ shown locked.
- **Paywall component**: "what's inside / what you'll build" + an **email waitlist
  form** (`joinWaitlist`). Anonymous-friendly. (Phase 3 replaces the form with a
  Buy button.)
- **Enroll guard**: `enroll` requires access — PUBLIC/FREE ok; PREMIUM requires an
  entitlement (the free-preview card doesn't grant enrollment).

## SEO for premium previews

- `isPublicPath` already admits all guide routes; the **page gate** is what makes
  cards 1+ non-public. So premium hub + card 0 are already crawlable. ADD: the
  **sitemap** includes each PREMIUM project's hub + card-0 URL (not cards 1+);
  `generateMetadata` + JSON-LD already apply. robots unchanged.

## Testing

- Pure `resolveLessonAccess` — every (tier × ordinal-0-or-not × entitlement ×
  session × admin) combination.
- Entitlement owner-XOR (a check test, mirroring artifact-owner-xor).
- `joinWaitlist` (anonymous, idempotent, premium-only) + `grantEntitlement`
  (admin-only) action tests.
- Schema change → full tsc + full vitest.

## Delivery — two PRs

- **PR A — access core:** `Entitlement` + `WaitlistSignup` schema/migration;
  `resolveLessonAccess` (supersede `resolvePublicLessonAccess`) + wire into both
  guide pages; entitlement load; enroll guard; admin `grantEntitlement`.
- **PR B — paywall + waitlist + premium SEO:** `joinWaitlist`; the Paywall
  component + waitlist form; premium hub sales treatment; sitemap includes
  premium hub + card 0.

## Out of scope (later phases)

Stripe / real purchase (Phase 3); bundles + credit (Phase 4); a dedicated
marketing/landing page distinct from the guide hub; turning any real project
PREMIUM (we'll flag a test project to exercise the machinery).
