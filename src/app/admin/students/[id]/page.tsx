// Admin: per-student manager. Everything an operator can set on a learner
// account — profile, access grants (entitlements), board progress (enrollments),
// and deletion. Admin-gated by the middleware (/admin/*) + requireAdmin() here.
//
// `role` is intentionally READ-ONLY: it is derived from the ALLOWED_EMAILS roster
// on every token refresh (the auth jwt callback), so a control here would revert.
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { STAGE_LABELS, ENROLLMENT_STATUS_LABEL, type StageName } from "@/lib/stages";
import type { EnrollmentStatus } from "@prisma/client";
import { formatUsd } from "@/lib/format-money";
import {
  StudentProfileForm,
  StudentAccess,
  StudentProgress,
  DeleteStudentButton,
} from "@/components/admin/student-controls";
import { LogbookAdminControls } from "@/components/admin/LogbookAdminControls";
import { LEVELS } from "@/lib/logbook/economy";

export const dynamic = "force-dynamic";

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-panel-border/60 pt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ {label}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-panel-border/60 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span className="font-mono text-xs text-text">{value}</span>
    </div>
  );
}

// A titled sub-list inside the Billing section, with a quiet "none" empty state.
function BillingGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
        {title}
      </p>
      {empty ? (
        <p className="mt-2 font-mono text-xs text-muted">none</p>
      ) : (
        <div className="mt-1 border-t border-panel-border/60">{children}</div>
      )}
    </div>
  );
}

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      xpTotal: true,
      level: true,
      createdAt: true,
      emailVerified: true,
      stripeCustomerId: true,
      emailConsent: true,
      onboardingGoal: true,
      entitlements: {
        select: {
          id: true,
          projectId: true,
          bundleId: true,
          project: { select: { name: true, publicTitle: true } },
        },
      },
      enrollments: {
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          currentStage: true,
          status: true,
          project: { select: { name: true, publicTitle: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const projects = await db.project.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, name: true, publicTitle: true },
  });

  // Billing (Stripe Phase 3): the learner's recorded money + subscription lifecycle, all
  // already captured by the webhook, just surfaced here. Read-only. Refund/Dispute carry
  // no userId, so correlate via the soft purchaseId (fallback stripeChargeId) — never
  // paymentIntentId (they do not carry it).
  const [subscriptions, invoices, purchases] = await Promise.all([
    db.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
    db.invoice.findMany({
      where: { userId: user.id },
      orderBy: { paidAt: "desc" },
      take: 12,
      select: { id: true, amountPaidCents: true, paidAt: true },
    }),
    db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountTotalCents: true,
        refundedCents: true,
        createdAt: true,
        projectId: true,
        bundleId: true,
        stripeChargeId: true,
      },
    }),
  ]);
  const purchaseIds = purchases.map((p) => p.id);
  const chargeIds = purchases
    .map((p) => p.stripeChargeId)
    .filter((c): c is string => !!c);
  const [refunds, disputes] = await Promise.all([
    db.refund.findMany({
      where: {
        OR: [
          { purchaseId: { in: purchaseIds } },
          { stripeChargeId: { in: chargeIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountCents: true, status: true, createdAt: true },
    }),
    db.dispute.findMany({
      where: {
        OR: [
          { purchaseId: { in: purchaseIds } },
          { stripeChargeId: { in: chargeIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountCents: true, status: true, createdAt: true },
    }),
  ]);

  const entitlements = user.entitlements.map((e) => ({
    id: e.id,
    kind: (e.bundleId ? "pass" : "project") as "pass" | "project",
    label: e.bundleId
      ? "All-Access Pass"
      : (e.project?.publicTitle ?? e.project?.name ?? "Unknown board"),
  }));
  const hasPass = user.entitlements.some((e) => e.bundleId != null);
  const grantableProjects = projects.map((p) => ({
    id: p.id,
    label: p.publicTitle ?? p.name,
  }));

  const enrollments = user.enrollments.map((e) => ({
    id: e.id,
    project: e.project.publicTitle ?? e.project.name,
    stage: STAGE_LABELS[e.currentStage as StageName] ?? e.currentStage,
    status:
      ENROLLMENT_STATUS_LABEL[e.status as EnrollmentStatus] ?? e.status,
  }));

  // Logbook: the learner's earned patches (hardware keys get their tier appended) +
  // the recent admin-audit trail for this learner.
  const [badges, recentAudit] = await Promise.all([
    db.badgeEarned.findMany({
      where: { userId: user.id },
      orderBy: { earnedAt: "desc" },
      select: { badgeKey: true },
    }),
    db.adminAudit.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { action: true, detail: true, createdAt: true },
    }),
  ]);
  const rankTitle = LEVELS.find((l) => l.level === user.level)?.title ?? "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href="/admin/students"
          className="text-muted transition-colors hover:text-gold-light"
        >
          ‹ Students
        </Link>
      </nav>

      <PageHeader
        eyebrow="OPERATOR · STUDENT"
        title={user.name || user.email}
        accentWord={(user.name || user.email).split(/\s+/).pop() ?? ""}
        lead={user.name ? user.email : undefined}
      />

      <Section label="Account">
        <div className="border-t border-panel-border/60">
          <Field label="Email" value={user.email} />
          <Field
            label="Role"
            value={`${user.role} · set via ALLOWED_EMAILS roster`}
          />
          <Field
            label="Created"
            value={user.createdAt.toISOString().slice(0, 10)}
          />
          <Field
            label="Email verified"
            value={user.emailVerified ? "yes" : "no"}
          />
          <Field
            label="Stripe customer"
            value={user.stripeCustomerId ?? "none"}
          />
        </div>
      </Section>

      <Section label="Profile">
        <StudentProfileForm
          userId={user.id}
          initialName={user.name}
          initialConsent={user.emailConsent}
          initialGoal={user.onboardingGoal}
        />
      </Section>

      <Section label="Access">
        <StudentAccess
          userId={user.id}
          entitlements={entitlements}
          grantableProjects={grantableProjects}
          hasPass={hasPass}
        />
      </Section>

      <Section label="Logbook">
        <div className="border-t border-panel-border/60">
          <Field label="XP total" value={user.xpTotal.toLocaleString("en-US")} />
          <Field label="Flight level" value={`FL${user.level} · ${rankTitle}`} />
          <Field label="Patches" value={String(badges.length)} />
        </div>
        <div className="mt-6">
          <LogbookAdminControls
            userId={user.id}
            xpTotal={user.xpTotal}
            level={user.level}
            earnedKeys={badges.map((b) => b.badgeKey)}
          />
        </div>
        {recentAudit.length > 0 ? (
          <div className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
              Recent admin actions
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {recentAudit.map((a, i) => (
                <li key={i} className="font-mono text-[10px] leading-relaxed text-muted">
                  {a.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {a.action} ·{" "}
                  <span className="text-gray-3">{JSON.stringify(a.detail)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section label="Billing">
        <div className="space-y-6">
          <BillingGroup title="Subscriptions" empty={subscriptions.length === 0}>
            {subscriptions.map((s) => (
              <Field
                key={s.id}
                label={s.status}
                value={`${
                  s.currentPeriodEnd ? `ends ${iso(s.currentPeriodEnd)}` : "no period"
                }${s.cancelAtPeriodEnd ? " · cancels at period end" : ""}`}
              />
            ))}
          </BillingGroup>

          <BillingGroup title="Purchases" empty={purchases.length === 0}>
            {purchases.map((p) => (
              <Field
                key={p.id}
                label={`${iso(p.createdAt)}${p.bundleId ? " · Pass" : ""}`}
                value={`${formatUsd(p.amountTotalCents)}${
                  p.refundedCents > 0 ? ` (refunded ${formatUsd(p.refundedCents)})` : ""
                }`}
              />
            ))}
          </BillingGroup>

          <BillingGroup title="Invoices" empty={invoices.length === 0}>
            {invoices.map((i) => (
              <Field key={i.id} label={iso(i.paidAt)} value={formatUsd(i.amountPaidCents)} />
            ))}
          </BillingGroup>

          <BillingGroup title="Refunds" empty={refunds.length === 0}>
            {refunds.map((r) => (
              <Field
                key={r.id}
                label={`${iso(r.createdAt)} · ${r.status}`}
                value={formatUsd(r.amountCents)}
              />
            ))}
          </BillingGroup>

          <BillingGroup title="Disputes" empty={disputes.length === 0}>
            {disputes.map((d) => (
              <Field
                key={d.id}
                label={`${iso(d.createdAt)} · ${d.status}`}
                value={formatUsd(d.amountCents)}
              />
            ))}
          </BillingGroup>
        </div>
      </Section>

      <Section label="Progress">
        <StudentProgress userId={user.id} enrollments={enrollments} />
      </Section>

      <Section label="Danger zone">
        <DeleteStudentButton
          userId={user.id}
          email={user.email}
          isSelf={user.id === admin.id}
        />
      </Section>
    </main>
  );
}
