// Admin: revenue reporting (Stripe Phase 3). Headline stat tiles + a recent-activity feed
// computed LIVE from the billing tables. Admin-gated by the middleware (/admin/*) +
// requireAdmin() here. Zero/near-zero volume is the DEFAULT reality until content ships +
// the sub program launches, so every tile renders cleanly at 0 and the feed shows a quiet
// empty state (the metrics helper guards divide-by-zero). The aggregation math lives in
// the pure @/lib/billing-metrics helper (unit-tested); this page only queries + renders.
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { formatUsd } from "@/lib/format-money";
import {
  mrrCents,
  activeSubCount,
  grossRevenueCents,
  refundRate,
  disputeRate,
} from "@/lib/billing-metrics";
import { StartTestSubscriptionButton } from "@/components/admin/StartTestSubscriptionButton";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "·";
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-panel-border bg-bg-2/30 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-numeral text-3xl tabular-nums text-title">{value}</p>
      {sub ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray-3">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export default async function AdminBillingPage() {
  await requireAdmin();

  // Metrics inputs (whole-table reads — small sets; force-dynamic).
  const bundle = await db.bundle.findUnique({
    where: { key: "all-access" },
    select: { subscriptionPriceCents: true },
  });
  const [subs, allPurchases, allInvoices, disputeCount, purchaseCount] =
    await Promise.all([
      db.subscription.findMany({ select: { status: true } }),
      db.purchase.findMany({
        select: { amountTotalCents: true, refundedCents: true },
      }),
      db.invoice.findMany({ select: { amountPaidCents: true } }),
      db.dispute.count(),
      db.purchase.count(),
    ]);

  const mrr = mrrCents(subs, bundle?.subscriptionPriceCents ?? null);
  const gross = grossRevenueCents(allPurchases, allInvoices);

  // Recent activity: last ~15 across the four money tables, normalized + merged by date.
  // Refunds/Disputes render as negative money (they reduce net).
  const [recentPurchases, recentInvoices, recentRefunds, recentDisputes] =
    await Promise.all([
      db.purchase.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, amountTotalCents: true, createdAt: true, bundleId: true },
      }),
      db.invoice.findMany({
        orderBy: { paidAt: "desc" },
        take: 15,
        select: { id: true, amountPaidCents: true, paidAt: true },
      }),
      db.refund.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, amountCents: true, createdAt: true },
      }),
      db.dispute.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, amountCents: true, createdAt: true },
      }),
    ]);

  const activity = [
    ...recentPurchases.map((p) => ({
      id: `p_${p.id}`,
      type: p.bundleId ? "Purchase · Pass" : "Purchase",
      amountCents: p.amountTotalCents,
      at: p.createdAt,
    })),
    ...recentInvoices.map((i) => ({
      id: `i_${i.id}`,
      type: "Invoice",
      amountCents: i.amountPaidCents,
      at: i.paidAt,
    })),
    ...recentRefunds.map((r) => ({
      id: `r_${r.id}`,
      type: "Refund",
      amountCents: -r.amountCents,
      at: r.createdAt,
    })),
    ...recentDisputes.map((d) => ({
      id: `d_${d.id}`,
      type: "Dispute",
      amountCents: -d.amountCents,
      at: d.createdAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR · BILLING"
        title="Revenue"
        accentWord="Revenue"
        lead="Live from the billing tables. Zero is expected until courses are published and the subscription program launches."
      />

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Recurring revenue assumes a MONTHLY interval (the provisioned default); the
            interval is not stored in our DB. See billing-metrics.ts. */}
        <Tile label="Recurring / mo" value={formatUsd(mrr)} sub="MRR (assumes monthly)" />
        <Tile label="Gross revenue" value={formatUsd(gross)} sub="Purchases + invoices" />
        <Tile label="Active subs" value={String(activeSubCount(subs))} />
        <Tile label="Refund rate" value={pct(refundRate(allPurchases))} />
        <Tile label="Dispute rate" value={pct(disputeRate(disputeCount, purchaseCount))} />
        <Tile label="Purchases" value={String(purchaseCount)} sub="All-time count" />
      </section>

      <section className="mt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Recent activity
        </p>
        {activity.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            No activity yet.
          </p>
        ) : (
          <div className="mt-4 border-t border-panel-border/60">
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex items-baseline justify-between gap-4 border-b border-panel-border/60 py-2.5"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text">
                  {a.type}
                </span>
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-3">
                    {iso(a.at)}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      a.amountCents < 0 ? "text-alert-red" : "text-text"
                    }`}
                  >
                    {a.amountCents < 0 ? "-" : ""}
                    {formatUsd(Math.abs(a.amountCents))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Test harness
        </p>
        <p className="mt-1 font-serif text-sm text-muted">
          Starts a subscription checkout on THIS admin account, to exercise the sub →
          portal → dunning loop. Use Stripe test mode only (a live charge would be real).
          Inert until the recurring price is provisioned.
        </p>
        <div className="mt-4">
          <StartTestSubscriptionButton />
        </div>
      </section>
    </main>
  );
}
