# Tiers + Entitlements + Paywall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Turn `Project.accessTier` into a real access product — FREE needs an account, PREMIUM needs an entitlement, with a public sales page + free first lesson per premium project and an email-waitlist wall (Stripe is Phase 3).

**Architecture:** A pure `resolveLessonAccess({accessTier, cardOrdinal, hasSession, hasEntitlement, isAdmin}) -> allow|redirectSignIn|paywall` (supersedes Phase 1's `resolvePublicLessonAccess`). Middleware still only admits guide/courses paths; the guide pages load the viewer's `Entitlement` and decide allow/redirect/paywall. Anonymous email `WaitlistSignup` capture on the wall; admin-only `grantEntitlement` until the Stripe webhook lands in Phase 3.

**Tech Stack:** Next.js 16 App Router (RSC), Auth.js v5, Prisma 7 + Neon, Vitest 4, Tailwind v4.

**Design doc:** `docs/plans/2026-06-08-tiers-entitlements-paywall-design.md`.

> **PREREQUISITE: Phase 1 (PR #45) MUST be merged first.** This builds on
> `Project.accessTier`, the guide-page gate, `isPublicPath`, and the chrome.
> Create the branch off the post-#45 `main`. Honor the schema-change discipline
> (full `tsc` + full `pnpm vitest run` after the migration). Migrations are
> hand-authored + `prisma migrate deploy` to the prod Neon branch (NEVER
> `migrate dev`). One commit per task; two PRs.

---

# PR A — Access core

## Task A1: `Entitlement` + `WaitlistSignup` schema + migration

**Files:** `prisma/schema.prisma`; `prisma/migrations/<ts>_entitlements_waitlist/migration.sql`

**Step 1 — schema.** Add:
```prisma
enum EntitlementSource { GRANT PURCHASE }

model Entitlement {
  id         String            @id @default(cuid())
  userId     String
  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId  String?
  project    Project?          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  bundleId   String?           // reserved for Phase 4 (no Bundle model yet)
  source     EntitlementSource @default(GRANT)
  createdAt  DateTime          @default(now())
  @@unique([userId, projectId])
  @@index([userId])
}

model WaitlistSignup {
  id        String   @id @default(cuid())
  email     String
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([email, projectId])
}
```
Add the back-relations on `User` (`entitlements Entitlement[]`) and `Project` (`entitlements Entitlement[]`, `waitlist WaitlistSignup[]`).

**Step 2 — migration SQL:** `CREATE TYPE "EntitlementSource"...`; `CREATE TABLE "Entitlement"...` with the owner-XOR CHECK constraint (`("projectId" IS NOT NULL) <> ("bundleId" IS NOT NULL)` — mirror the artifact-owner-xor migration), FKs, unique indexes; `CREATE TABLE "WaitlistSignup"...`.

**Step 3 — apply + generate:** `pnpm prisma migrate deploy` (prod Neon) → `pnpm prisma generate`.

**Step 4 — discipline:** full `pnpm tsc --noEmit` (clean) + full `pnpm vitest run` (green).

**Step 5 — commit.** `feat(access): Entitlement + WaitlistSignup models + migration`

---

## Task A2: `resolveLessonAccess` pure helper

**Files:** `src/lib/public-access.ts` (extend); `src/lib/__tests__/public-access.test.ts` (extend)

**Step 1 — failing tests** covering every branch:
```ts
const base = { cardOrdinal: 0, hasSession: false, hasEntitlement: false, isAdmin: false };
// admin always allow
expect(resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 5, isAdmin: true })).toBe("allow");
// PUBLIC always allow
expect(resolveLessonAccess({ ...base, accessTier: "PUBLIC" })).toBe("allow");
expect(resolveLessonAccess({ ...base, accessTier: "PUBLIC", cardOrdinal: 9 })).toBe("allow");
// FREE needs a session
expect(resolveLessonAccess({ ...base, accessTier: "FREE" })).toBe("redirectSignIn");
expect(resolveLessonAccess({ ...base, accessTier: "FREE", hasSession: true })).toBe("allow");
// PREMIUM: entitled allow; card 0 free; rest paywall
expect(resolveLessonAccess({ ...base, accessTier: "PREMIUM", hasEntitlement: true, cardOrdinal: 4 })).toBe("allow");
expect(resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 0 })).toBe("allow");
expect(resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 1 })).toBe("paywall");
expect(resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 1, hasSession: true })).toBe("paywall");
```

**Step 2 — run, fail. Step 3 — implement:**
```ts
export function resolveLessonAccess(input: {
  accessTier: string; cardOrdinal: number;
  hasSession: boolean; hasEntitlement: boolean; isAdmin: boolean;
}): "allow" | "redirectSignIn" | "paywall" {
  if (input.isAdmin) return "allow";
  if (input.accessTier === "PUBLIC") return "allow";
  if (input.accessTier === "FREE") return input.hasSession ? "allow" : "redirectSignIn";
  // PREMIUM
  if (input.hasEntitlement) return "allow";
  if (input.cardOrdinal === 0) return "allow";
  return "paywall";
}
```
Keep `resolvePublicLessonAccess` or re-express it via the new helper (the hub page, which has no single card, uses `cardOrdinal: 0` semantics = treat hub as the free surface). **Step 4 — run, pass. Step 5 — commit.**

---

## Task A3: entitlement load + wire `resolveLessonAccess` into the guide pages

**Files:** `src/lib/entitlements.ts` (new: `hasProjectEntitlement(userId, projectId)`); guide card + hub pages.

- `hasProjectEntitlement(db, userId, projectId): Promise<boolean>` — `db.entitlement.findUnique({ where: { userId_projectId } })` truthy. (Test it against a seeded row if practical, else keep it a thin wrapper.)
- **Card page:** resolve `card.ordinal`; compute `hasEntitlement` (signed-in only); `const decision = resolveLessonAccess({ accessTier, cardOrdinal: card.ordinal, hasSession, hasEntitlement, isAdmin: role==="ADMIN" })`. `redirectSignIn` → `redirect("/sign-in")`; `paywall` → render `<Paywall project={...} />` (component lands in PR B; for PR A, a placeholder "Locked" panel is fine) instead of the lesson; `allow` → render normally.
- **Hub page:** for PREMIUM treat as public sales surface (allow render); mark cards 1+ as locked in the stepper/list (visual only).

**Verify:** `tsc` + the public-access tests. **Commit.**

> Note: the card-page gate from Phase 1 is REPLACED by this richer decision — make sure anonymous on FREE still redirects and on PUBLIC still renders (regression-covered by the helper tests + the existing guide tests).

---

## Task A4: enroll guard

**Files:** `src/lib/actions/enrollment.ts`; its test.

- In `enroll`, before creating the Enrollment, assert the user has access to the project: PUBLIC/FREE → ok; PREMIUM → require `hasProjectEntitlement` (the free preview card does NOT grant enrollment). Throw a clear error otherwise.
- **TDD:** a test that enrolling in a PREMIUM project without an entitlement is rejected, and with a granted entitlement succeeds. **Commit.**

---

## Task A5: admin `grantEntitlement` action

**Files:** `src/lib/actions/entitlement.ts` (new) + test.

- `grantEntitlement(input)` — Zod `{ userId: cuid, projectId: cuid }`; `await requireAdmin()`; idempotent upsert on `[userId, projectId]` with `source: "GRANT"`; `revalidatePath` the project. **TDD** (admin-gated; idempotent). **Commit.**

---

## Task A6: PR A verify + ship
Full `tsc` + full `vitest`. Manual: as admin grant yourself an entitlement on a test-PREMIUM project; confirm card 1+ renders for you and the placeholder-locked panel for a non-entitled account; FREE/PUBLIC unchanged. Push; open PR A.

---

# PR B — Paywall + waitlist + premium SEO

## Task B1: `joinWaitlist` action
**Files:** `src/lib/actions/waitlist.ts` (new) + test.
- `joinWaitlist({ email, projectId })` — Zod email + cuid; **NO auth** (anonymous capture); assert the project is PREMIUM; idempotent upsert on `[email, projectId]`; return ok. **TDD** (anonymous; idempotent; rejects non-PREMIUM). **Commit.**

## Task B2: Paywall component + waitlist form
**Files:** `src/components/learn/Paywall.tsx` (+ a client `WaitlistForm.tsx`).
- Server `Paywall` shows: "what's inside" (the project's locked lesson list / "what you'll build" from the project description) + the client `WaitlistForm` (email input → `joinWaitlist`, success state "We'll email you when it opens"). On-brand (glass-card). Rendered by the card page on a `paywall` decision (replace PR A's placeholder). **Verify tsc + manual. Commit.**

## Task B3: premium hub sales treatment
**Files:** guide hub page; the stepper/list components.
- For a PREMIUM project, the hub renders publicly as a sales page: lesson titles + descriptions, card 0 linked/open, cards 1+ shown with a lock affordance (link still goes to the card, which shows the Paywall). A "Join the waitlist" CTA near the top. **Verify tsc + manual. Commit.**

## Task B4: premium-preview SEO (sitemap)
**Files:** `src/app/sitemap.ts`.
- Extend the sitemap: for PREMIUM published projects, include the hub URL + the card-0 (REQUIREMENTS) lesson URL only (NOT cards 1+). PUBLIC projects keep all stages (Phase 1). **Verify tsc. Commit.**

## Task B5: PR B verify + ship
Full `tsc` + full `vitest`. Manual: anonymous sees a PREMIUM project's hub + card 0 + the waitlist wall on card 1; submitting the email records a `WaitlistSignup`; view-source shows the premium hub/card-0 in sitemap + metadata. Push; open PR B.

---

## Notes / risks
- `main` auto-deploys to prod — verify each PR in its (Vercel-auth-protected) preview in-browser; the definitive public/crawler checks are on prod after merge.
- A1 is the only migration (full tsc + full vitest discipline).
- No real project is PREMIUM yet; flag a throwaway/test project PREMIUM (admin) to exercise paywall + waitlist end-to-end, then revert it before/after.
- Out of scope: Stripe (P3), bundles (P4), a dedicated marketing page.
