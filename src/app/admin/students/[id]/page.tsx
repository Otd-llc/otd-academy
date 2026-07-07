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
import {
  StudentProfileForm,
  StudentAccess,
  StudentProgress,
  DeleteStudentButton,
} from "@/components/admin/student-controls";

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
