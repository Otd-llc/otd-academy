# Stripe Phase 3 (Ops Layer) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the human + ops layer on the (complete) Stripe recording/access system:
a Stripe-hosted customer portal, dunning (email + banner), an admin per-learner billing
view, a revenue-reporting page, and a hidden subscribe test-harness — all
program-agnostic (serve today's Pass buyers AND the future academy-projects subscription).

**Architecture:** Server actions call Stripe inside their bodies (never at import). The
signature-verified webhook stays the only writer of Stripe-originated rows; the portal is
Stripe-hosted (self-service round-trips back through the webhook). Dunning fires from the
webhook post-commit, guarded by the existing `ProcessedStripeEvent` claim. Reporting math
lives in a pure, DB-free helper. **Zero schema changes** (every table/column already on
PROD).

**Tech Stack:** Next.js App Router (RSC + server actions), Prisma + Neon (WebSocket Pool),
Stripe SDK (`apiVersion 2026-05-27.dahlia`), Resend (email), Vitest. `pnpm` runs via
**PowerShell**, not the Bash tool.

**Design doc:** `docs/plans/2026-07-09-stripe-phase-3-ops-layer-design.md` (validated to dry).

---

## Conventions (read once)

- **Run pnpm via the PowerShell tool.** Full suite: `pnpm test` (leases per-file Neon
  branches, ~80s). One file: `pnpm test src/lib/__tests__/<file>`. Typecheck+build:
  `pnpm build`. Do NOT run vitest concurrently with prod-writing scripts.
- **No migration.** If any task seems to need one, STOP — the design says schema is
  untouched; a PROD migration needs Josh's explicit go.
- **House voice on every rendered/emailed string:** no em-dash, answer-first, concrete
  (otd-content-writing). **Token-only color, hairlines, no filled boxes / big radius**
  (otd-frontend-design). Numerals in `font-mono`/`font-numeral`.
- **Commit after each task.** Branch is `feat/stripe-phase-3` (already created off main).
- **Do NOT merge.** Open the PR at the end; wait for Josh's explicit go.
- The two untracked docs (`docs/fundamentals-critique-additions.md`,
  `docs/l101-youtube-narration-scripts.md`) are unrelated WIP — **never `git add` them**.
  Stage files explicitly by path, never `git add -A`.

---

## Batch 1 — Customer billing portal

### Task 1.1: Portal server action (+ test)

**Files:**
- Create: `src/lib/actions/billing.ts`
- Create test: `src/lib/__tests__/billing-action.test.ts`

**Step 1 — Write the failing test** (`billing-action.test.ts`), mirroring the
`pass-action.test.ts` mock pattern:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const { requireUser, portalCreate, siteUrl } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  portalCreate: vi.fn(),
  siteUrl: vi.fn(() => "https://academy.test"),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    billingPortal: { sessions: { create: (...a: unknown[]) => portalCreate(...a) } },
  }),
}));

import { createBillingPortalSession } from "@/lib/actions/billing";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user_1", stripeCustomerId: "cus_1" });
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/session" });
});

describe("createBillingPortalSession", () => {
  test("opens a portal session for the user's own customer id, returns the url", async () => {
    const result = await createBillingPortalSession();
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://academy.test/account",
    });
    expect(result).toEqual({ url: "https://billing.stripe.test/session" });
  });

  test("throws when the user has no Stripe customer id (no billing account yet)", async () => {
    requireUser.mockResolvedValue({ id: "user_2", stripeCustomerId: null });
    await expect(createBillingPortalSession()).rejects.toThrow(/billing/i);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  test("throws when Stripe returns no url", async () => {
    portalCreate.mockResolvedValue({ url: null });
    await expect(createBillingPortalSession()).rejects.toThrow(/portal url/i);
  });
});
```

**Step 2 — Run it, expect FAIL** (`createBillingPortalSession` not defined):
`pnpm test src/lib/__tests__/billing-action.test.ts`

**Step 3 — Implement** `src/lib/actions/billing.ts`:

```ts
"use server";

// Customer billing portal (Stripe Phase 3). Opens a Stripe-hosted Customer Portal
// session so a customer can view invoices, update their card, and self-cancel a
// subscription. The portal is DISPLAY + self-service only: any change round-trips back
// through the webhook (customer.subscription.* / invoice.*), which stays the sole writer
// of Stripe-originated rows — this action never writes our DB.
//
// "use server" rule: this file exports ONLY async functions. BUILD-SAFETY: getStripe()
// is called only inside the body, never at import, so importing this module without keys
// is safe.
import { requireUser } from "@/lib/auth-helpers";
import { getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";

/**
 * Create a Stripe Customer Portal session for the signed-in user and return its URL.
 * The customer id is read from the authenticated user's OWN row (never client input),
 * so there is no IDOR surface. Requires the user to have transacted at least once
 * (a stripeCustomerId); the UI only renders the button when one exists. Throws a clear
 * error if the Stripe Portal is not configured in the dashboard (surfaced inline).
 */
export async function createBillingPortalSession(): Promise<{ url: string }> {
  const user = await requireUser();
  if (!user.stripeCustomerId) {
    throw new Error("You do not have a billing account yet.");
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${siteUrl()}/account`,
  });
  if (!session.url) {
    throw new Error("Stripe did not return a portal URL.");
  }
  return { url: session.url };
}
```

**Step 4 — Run test, expect PASS.** **Step 5 — Commit:**
`git add src/lib/actions/billing.ts src/lib/__tests__/billing-action.test.ts`
`git commit -m "feat(billing): customer portal server action"`

### Task 1.2: ManageBillingButton client island

**Files:** Create `src/components/account/ManageBillingButton.tsx`

Mirror `PassButtons.tsx` exactly (same `BTN` class string, `useTransition`, inline error):

```tsx
"use client";

// Opens the Stripe Customer Portal (bills, card, cancel). Mirrors PassButtons: gold
// command button, pending state, inline error. Calls the server action directly.
import { useState, useTransition } from "react";
import { createBillingPortalSession } from "@/lib/actions/billing";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded border border-command-gold bg-navy-dark px-6 py-3 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50";

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open() {
    start(async () => {
      setError(null);
      try {
        const { url } = await createBillingPortalSession();
        window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open billing.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={open} className={BTN}>
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

**Commit:** `git add src/components/account/ManageBillingButton.tsx`
`git commit -m "feat(billing): manage-billing button island"`

### Task 1.3: Billing section on /account

**Files:** Modify `src/app/account/page.tsx`

- Add `stripeCustomerId: true` to the `db.user.findUnique` `select`.
- Add a new `<section>` (copy the existing Email/Identity section markup: a
  `▸ Billing` mono label) between the Email and Identity sections. Inside:
  - If `user.stripeCustomerId`: a one-line serif description ("View invoices, update your
    payment method, or cancel a subscription.") + `<ManageBillingButton />`.
  - Else: nothing (omit the section entirely when no customer id).
- (The `<DunningBanner />` is added to this page in Task 2.5 — leave a note.)
- Import `ManageBillingButton` from `@/components/account/ManageBillingButton`.

**Verify:** `pnpm build` passes. **Commit:**
`git add src/app/account/page.tsx`
`git commit -m "feat(billing): billing section on /account"`

---

## Batch 2 — Dunning (email + banner)

### Task 2.1: Dunning email builder (pure) (+ test)

**Files:**
- Create: `src/lib/subscription-dunning-email.ts`
- Create test: `src/lib/__tests__/subscription-dunning-email.test.ts`

**Step 1 — Test** (mirror `auth-magic-link-email.test.ts`: assert subject, that html/text
contain the account URL + key copy, and that **no em-dash** appears):

```ts
import { describe, expect, test } from "vitest";
import { subscriptionPaymentFailedEmail } from "@/lib/subscription-dunning-email";

describe("subscriptionPaymentFailedEmail", () => {
  const out = subscriptionPaymentFailedEmail({
    accountUrl: "https://academy.test/account",
    host: "academy.test",
  });

  test("subject names the payment problem", () => {
    expect(out.subject).toMatch(/payment/i);
  });

  test("html + text link to the account/billing page", () => {
    expect(out.html).toContain("https://academy.test/account");
    expect(out.text).toContain("https://academy.test/account");
  });

  test("no em-dash anywhere (house voice)", () => {
    expect(out.html).not.toContain("—");
    expect(out.text).not.toContain("—");
  });
});
```

**Step 3 — Implement.** Copy the dark table-email shell from `field-guide-email.ts`
(same `esc`, colors, `SANS`/`MONO`, bulletproof gold button, text/plain alt). Signature:

```ts
export function subscriptionPaymentFailedEmail({
  accountUrl,
  host,
}: {
  accountUrl: string;
  host: string;
}): { subject: string; html: string; text: string }
```

Copy (house voice, no em-dash):
- **subject:** `Your subscription payment did not go through`
- **lead (html/text):** "We could not process the latest payment for your One Thousand
  Drones Academy subscription. Update your payment method to keep your access. Your card
  will be retried automatically over the next few days."
- **CTA button:** `Manage billing` → `accountUrl`
- footer: reuse the field-guide footer ("OTD Academy · {host}").

**Step 4 — test PASS. Step 5 — Commit:**
`git add src/lib/subscription-dunning-email.ts src/lib/__tests__/subscription-dunning-email.test.ts`
`git commit -m "feat(billing): dunning email builder"`

### Task 2.2: Dunning sender (Resend, never throws) (+ test)

**Files:**
- Create: `src/lib/subscription-dunning.ts`
- Create test: `src/lib/__tests__/subscription-dunning.test.ts`

Design: `sendPaymentFailedEmail({ toEmail }, resendFetch = fetch)` — resolves the account
URL + host from `siteUrl()`, builds the email, POSTs to Resend with `AUTH_RESEND_KEY` /
`AUTH_RESEND_FROM` (transactional, NOT consent-gated). **On failure it LOGS and returns**
(never throws): the webhook event claim has already committed, so a thrown 500 would make
Stripe retry → hit the claim's P2002 → no-op → no resend anyway.

```ts
// Send ONE subscription dunning email. Transactional (a billing-failure notice), so it is
// NOT emailConsent-gated. Fired by the webhook AFTER the event claim commits; on Resend
// failure it LOGS and returns (never throws) because the claim already guards against a
// duplicate send. resendFetch is injectable so tests never touch the network.
import { env } from "@/env";
import { siteUrl } from "@/lib/seo/jsonld";
import { subscriptionPaymentFailedEmail } from "@/lib/subscription-dunning-email";

export async function sendPaymentFailedEmail(
  args: { toEmail: string },
  resendFetch: typeof fetch = fetch,
): Promise<void> {
  const base = siteUrl();
  const accountUrl = `${base}/account`;
  const host = new URL(base).host;
  const { subject, html, text } = subscriptionPaymentFailedEmail({ accountUrl, host });
  try {
    const res = await resendFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.AUTH_RESEND_FROM, to: args.toEmail, subject, html, text }),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = JSON.stringify(await res.json()); } catch { /* non-JSON */ }
      console.error(`[dunning] Resend error for ${args.toEmail}: ${detail}`);
    }
  } catch (e) {
    console.error(`[dunning] send failed for ${args.toEmail}:`, e instanceof Error ? e.message : e);
  }
}
```

**Test** (mock `@/env` + `@/lib/seo/jsonld`; inject a fake fetch): assert it POSTs to
`api.resend.com/emails` with the right `to`; assert a non-ok response does NOT throw;
assert a thrown fetch does NOT propagate.

**Commit:** `git add src/lib/subscription-dunning.ts src/lib/__tests__/subscription-dunning.test.ts`
`git commit -m "feat(billing): dunning sender (best-effort, never throws)"`

### Task 2.3: Wire dunning into the webhook (+ update the phase-2 test)

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts` (the grouped
  `invoice.payment_failed || payment_action_required || payment_attempt_required` block,
  currently log-only ~line 490).
- Modify: `src/lib/__tests__/stripe-webhook-phase2.test.ts` (the existing
  "invoice.payment_failed is logged only" test at ~line 542 — **rewrite it**).

**Split the branch.** Replace the grouped block with:

```ts
} else if (event.type === "invoice.payment_failed") {
  // Dunning. ACCESS already follows Subscription.status (past_due → revoke via
  // customer.subscription.updated), so there is no new DB state to record — the event
  // CLAIM is the idempotency point: a redelivery hits P2002 → 200 no-op → no duplicate
  // email. Send the email AFTER the claim commits (post-commit, like capture()); the
  // sender never throws (see subscription-dunning.ts).
  const inv = event.data.object;
  const early = await claimAndWrite(event.id, event.type, async () => {
    // no writes; the claim alone guards the single send
  });
  if (early) return early;
  const customerId =
    typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
  if (customerId) {
    const user = await db.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { email: true },
    });
    if (user?.email) {
      await sendPaymentFailedEmail({ toEmail: user.email });
    } else {
      console.warn(
        `[stripe-webhook] payment_failed for customer ${customerId}: no user/email to notify`,
      );
    }
  }
} else if (
  event.type === "invoice.payment_action_required" ||
  event.type === "invoice.payment_attempt_required"
) {
  // SCA / retry-needed — a DIFFERENT message than a hard failure (the portal does not
  // resolve an authentication requirement), and rare for our card flow. Log-only.
  const inv = event.data.object;
  const cust =
    typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "?";
  console.warn(
    `[stripe-webhook] ${event.type} for invoice ${inv.id} (customer ${cust}) — access follows the subscription status`,
  );
}
```

Add the import at the top: `import { sendPaymentFailedEmail } from "@/lib/subscription-dunning";`

**Update the phase-2 test** — replace the old log-only test with three:

```ts
// Add to the vi.hoisted() spies + vi.mock:
//   sendDunning: vi.fn()   → vi.mock("@/lib/subscription-dunning", () => ({ sendPaymentFailedEmail: sendDunning }))
// Add db.user.findUnique to the TOP-LEVEL db mock (not just tx):
//   db: { $transaction: ..., user: { findUnique: (...a) => userFindUniqueTop(...a) } }
// In beforeEach: userFindUniqueTop.mockResolvedValue({ email: "learner@test" });

describe("POST webhook — invoice.payment_failed (dunning)", () => {
  const FAIL = (id = "evt_fail") => ({
    id, type: "invoice.payment_failed",
    data: { object: { id: "in_fail", customer: "cus_1" } },
  });

  test("claims the event and sends exactly one dunning email to the customer's user", async () => {
    constructEvent.mockReturnValue(FAIL());
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(processedCreate).toHaveBeenCalledTimes(1);       // now claimed
    expect(sendDunning).toHaveBeenCalledWith({ toEmail: "learner@test" });
  });

  test("a REDELIVERED payment_failed (claim P2002) sends NO second email", async () => {
    constructEvent.mockReturnValue(FAIL());
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendDunning).not.toHaveBeenCalled();
  });

  test("no user for the customer → no email, still 200", async () => {
    userFindUniqueTop.mockResolvedValue(null);
    constructEvent.mockReturnValue(FAIL("evt_fail2"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(sendDunning).not.toHaveBeenCalled();
  });
});
```

Also confirm `payment_action_required` stays log-only (keep a small test if the harness
makes it easy).

**Run:** `pnpm test src/lib/__tests__/stripe-webhook-phase2.test.ts` → PASS.
**Commit:** `git add src/app/api/stripe/webhook/route.ts src/lib/__tests__/stripe-webhook-phase2.test.ts`
`git commit -m "feat(billing): dunning email on invoice.payment_failed (claim-guarded, one per attempt)"`

### Task 2.4: past-due helper + DunningBanner

**Files:**
- Create: `src/lib/past-due-subscription.ts`
- Create: `src/components/billing/DunningBanner.tsx`

Helper (thin, reused by both surfaces):

```ts
import { db } from "@/lib/db";

// The user's subscription that needs the learner's attention (payment failed / lapsed),
// or null. Derived live from the mirror — no new state. Access itself already follows
// this status (webhook), so this is purely for the in-app nudge.
const NEEDS_ATTENTION = ["past_due", "unpaid", "incomplete"];

export async function pastDueSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId, status: { in: NEEDS_ATTENTION } },
    select: { id: true, status: true },
  });
}
```

`DunningBanner` (server component; alert-red hairline panel, token-only, no filled box, no
em-dash; embeds `ManageBillingButton` OR a plain link to `/account`). Since it renders on
`/account` too (where the button already is), make the banner's CTA a **link** to
`/account` when used off-account, and just the message on `/account`. Simplest: the banner
takes an optional `withAction` — but YAGNI; render a compact panel with a link to
`/account#billing`. Keep it one small component:

```tsx
import Link from "next/link";

export function DunningBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-alert-red/50 bg-alert-red/[0.06] px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
        Your last subscription payment did not go through. Update your card to keep access.
      </p>
      <Link
        href="/account"
        className="font-mono text-xs uppercase tracking-wider text-command-gold underline-offset-4 hover:underline"
      >
        Manage billing →
      </Link>
    </div>
  );
}
```

(Confirm `alert-red` is a token in `globals.css`; PassButtons uses `text-alert-red`, so it
exists.)

**Commit:** `git add src/lib/past-due-subscription.ts src/components/billing/DunningBanner.tsx`
`git commit -m "feat(billing): past-due helper + dunning banner"`

### Task 2.5: Render the banner on /account + learner home

**Files:** Modify `src/app/account/page.tsx` and `src/app/learn/page.tsx`.

- `/account`: after resolving `user`, call `pastDueSubscription(user.id)`; if truthy,
  render `<DunningBanner />` at the top of `<main>` (above `PageHeader`).
- `/learn`: `currentUserOrRedirect()` gives `user`; call `pastDueSubscription(user.id)`;
  if truthy, render `<DunningBanner />` at the top of `<main>`.

**Verify:** `pnpm build`. **Commit:**
`git add src/app/account/page.tsx src/app/learn/page.tsx`
`git commit -m "feat(billing): show dunning banner on account + learner home"`

---

## Batch 3 — Admin per-learner billing view

### Task 3.1: Billing section on the student detail page

**Files:** Modify `src/app/admin/students/[id]/page.tsx`.

- Extend the `db.user.findUnique` select (or add scoped queries) to load, for this user:
  - `subscriptions` (order by createdAt desc): `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `stripePriceId`
  - `invoices` (desc, take ~10): `amountPaidCents`, `paidAt`
  - `purchases` (desc, take ~10): `amountTotalCents`, `refundedCents`, `createdAt`, `projectId`, `bundleId`
  - Refunds + Disputes: first collect the user's Purchase ids + their `stripeChargeId`s,
    then `db.refund.findMany({ where: { OR: [{ purchaseId: { in } }, { stripeChargeId: { in } }] } })`
    and the same for `db.dispute.findMany`. (Neither model has userId; correlate by the
    soft `purchaseId`, fallback `stripeChargeId`. Do NOT use paymentIntentId.)
- Render a new `<Section label="Billing">` (reuse the file's `Section`/`Field` primitives)
  with compact sub-lists: Subscriptions, Invoices, Purchases, Refunds, Disputes. Money via
  `formatUsd`. Empty sub-lists show a quiet "none".
- Pure read; no new actions.

**Verify:** `pnpm build`. **Commit:**
`git add src/app/admin/students/[id]/page.tsx`
`git commit -m "feat(billing): per-learner billing view in the student manager"`

---

## Batch 4 — Revenue reporting

### Task 4.1: Pure metrics helper (+ test)

**Files:**
- Create: `src/lib/billing-metrics.ts`
- Create test: `src/lib/__tests__/billing-metrics.test.ts`

Pure functions (rows in, numbers out — no DB), so they unit-test with plain arrays:

```ts
// Pure billing aggregation (Stripe Phase 3 reporting). Rows in, numbers out — DB-free so
// it is trivially unit-testable, mirroring pass-pricing / pass-upgrade.

export type SubRow = { status: string };
export type PurchaseRow = { amountTotalCents: number; refundedCents: number };
export type InvoiceRow = { amountPaidCents: number };

const ACTIVE = new Set(["active", "trialing"]);

/** Active/trialing subs × the monthly recurring price. Assumes a MONTHLY interval
 *  (set-subscription-price.ts default); the interval is not stored in our DB. */
export function mrrCents(subs: SubRow[], monthlyPriceCents: number | null): number {
  if (!monthlyPriceCents) return 0;
  return subs.filter((s) => ACTIVE.has(s.status)).length * monthlyPriceCents;
}

export function activeSubCount(subs: SubRow[]): number {
  return subs.filter((s) => ACTIVE.has(s.status)).length;
}

/** Gross = one-time purchases (net refunds) + paid subscription invoices. Disjoint:
 *  a subscription payment is an Invoice, never also a Purchase (mode gate in the webhook). */
export function grossRevenueCents(purchases: PurchaseRow[], invoices: InvoiceRow[]): number {
  const p = purchases.reduce((n, r) => n + r.amountTotalCents - r.refundedCents, 0);
  const i = invoices.reduce((n, r) => n + r.amountPaidCents, 0);
  return p + i;
}

/** Refunded cents / gross purchase cents, in [0,1]. 0 when no purchase volume. */
export function refundRate(purchases: PurchaseRow[]): number {
  const gross = purchases.reduce((n, r) => n + r.amountTotalCents, 0);
  if (gross <= 0) return 0;
  const refunded = purchases.reduce((n, r) => n + r.refundedCents, 0);
  return refunded / gross;
}

/** Disputes / purchases, in [0,1]. 0 when no purchases. */
export function disputeRate(disputeCount: number, purchaseCount: number): number {
  if (purchaseCount <= 0) return 0;
  return disputeCount / purchaseCount;
}
```

**Test:** cover mrr (assumes monthly; null price → 0), gross (disjoint sum), refund/dispute
rate (incl. **divide-by-zero → 0** empty-state cases), activeSubCount.

**Commit:** `git add src/lib/billing-metrics.ts src/lib/__tests__/billing-metrics.test.ts`
`git commit -m "feat(billing): pure revenue-metrics helper"`

### Task 4.2: /admin/billing reporting page

**Files:** Create `src/app/admin/billing/page.tsx`.

- `requireAdmin()`, `export const dynamic = "force-dynamic"`, `robots: noindex` (admin).
- Query: `db.bundle.findUnique({ key: "all-access" })` (for `subscriptionPriceCents`),
  `db.subscription.findMany`, `db.purchase.findMany`, `db.invoice.findMany`,
  `db.dispute.count()`, `db.purchase.count()`; plus a small recent-activity pull
  (last ~15 across Purchases/Invoices/Refunds/Disputes, normalized to
  `{ type, amountCents, at }` and sorted desc).
- Feed the rows into `billing-metrics.ts`. Render **stat tiles** (MRR, gross revenue,
  active subs, refund rate, dispute rate) following the `dataviz` stat-tile convention
  (mono numerals, hairline panels, deep-space, no gradient), then the recent-activity
  table. **Every tile renders 0 / — cleanly and the table shows "No activity yet" when
  empty** (the default reality). MRR tile label: "Recurring / mo" with a code comment on
  the monthly-interval assumption.
- Use `PageHeader` for the header (eyebrow "OPERATOR · BILLING").

**Verify:** `pnpm build`. **Commit:**
`git add src/app/admin/billing/page.tsx`
`git commit -m "feat(billing): revenue reporting page (/admin/billing)"`

### Task 4.3: Admin nav link

**Files:** Modify `src/components/UserMenu.tsx` — append to `ADMIN_LINKS`:
`{ href: "/admin/billing", label: "Billing" }`.

**Commit:** `git add src/components/UserMenu.tsx`
`git commit -m "feat(billing): admin nav link to /admin/billing"`

---

## Batch 5 — Subscribe test harness + docs

### Task 5.1: Hidden admin "Start test subscription" trigger

**Files:**
- Create: `src/components/admin/StartTestSubscriptionButton.tsx` (client island calling
  `createSubscriptionCheckoutSession` from `@/lib/actions/pass`, same pattern as
  `PassButtons`; inline error surfaces "isn't available yet" until the sub price is
  provisioned).
- Modify: `src/app/admin/billing/page.tsx` — render it in a small "Test harness" section
  at the bottom, with a one-line caveat ("Subscribes THIS admin account. Use Stripe test
  mode only.").

**Verify:** `pnpm build`. **Commit:**
`git add src/components/admin/StartTestSubscriptionButton.tsx src/app/admin/billing/page.tsx`
`git commit -m "feat(billing): admin test-subscription trigger"`

### Task 5.2: Update state-of-stripe.md (on this branch)

**Files:** `docs/state-of-stripe.md` currently lives only on the `docs/state-of-stripe`
branch (PR #271). **Bring it onto this branch first** (so the phase-3 changes land with
it), then update it:
- `git checkout docs/state-of-stripe -- docs/state-of-stripe.md`
- Tick the phase-3 roadmap items now done (portal, dunning, admin views, reporting).
- Add change-log rows for this PR.
- Add runbook entries: (a) one-time **Stripe Dashboard → Customer Portal** config is a
  prerequisite for the portal; (b) subscribe test-harness E2E steps; (c) reminder that
  MRR assumes a monthly interval.
- Move the two subscribe pieces to "built (test-harness) / no public button".

**Commit:** `git add docs/state-of-stripe.md`
`git commit -m "docs(billing): reconcile state-of-stripe for phase 3"`

---

## Final — verify, push, PR (NO merge)

1. **Full typecheck + build:** `pnpm build` → green.
2. **Full test suite:** `pnpm test` → green (expect ~1500 passing; note the count).
3. **Drive it (verify skill):** start the dev server (`Start-Process pnpm.cmd dev
   -WindowStyle Hidden`, use `localhost` not 127.0.0.1), sign in, confirm: `/account`
   shows "Manage billing" only with a customer id; `/admin/billing` renders tiles + empty
   state cleanly; the admin test-subscription button renders. (Full live sub → dunning →
   cancel E2E is a manual co-step with Josh in test mode — document, do not force.)
4. **Push + open PR:** `git push -u origin feat/stripe-phase-3`; open a PR to `main`
   summarizing the five pieces, the "no public subscribe button / sub is for the future
   program" framing, zero schema changes, and the two manual activation steps (portal
   config + live sub-price provisioning). **Do NOT merge** — wait for Josh's explicit go.

## Out of scope (later): tax/VAT, our own email receipts, promo-code usage reporting,
time-series revenue charts, auto-revoke on dispute.
