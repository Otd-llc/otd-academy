// First-run router (/start). The default post-sign-in destination. It resolves
// the learner's state and shows exactly one next action:
//   - not signed in            -> /sign-in (returns here)
//   - already enrolled in L1.01 -> jump to their current stage (past first-run)
//   - no onboarding goal yet    -> the one-question goal survey
//   - goal set, not enrolled    -> the single "Start L1.01" CTA
//
// This is the "minimize steps to value / one next action" surface from the
// onboarding procedure. noindex: it is a private first-run page.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { GoalSurvey } from "@/components/onboarding/GoalSurvey";
import { StartConsent } from "@/components/onboarding/StartConsent";
import { EnrollButton } from "@/components/learn/EnrollButton";

const ENTRY_SLUG = "l1-01-wroom-breakout";

export const metadata: Metadata = {
  title: "Start — OTD Academy",
  robots: { index: false, follow: false },
};

export default async function StartPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in?callbackUrl=/start");

  const user = await db.user.findUniqueOrThrow({
    where: { email: session.user.email },
    select: { id: true, onboardingGoal: true, emailConsent: true },
  });

  // The entry board + its published revision, plus this learner's enrollment (if
  // any) so we can route an already-started learner straight to their stage.
  const project = await db.project.findUnique({
    where: { slug: ENTRY_SLUG },
    select: {
      id: true,
      slug: true,
      publishedRevision: { select: { label: true } },
      enrollments: {
        where: { userId: user.id },
        select: { currentStage: true },
        take: 1,
      },
    },
  });

  const revLabel = project?.publishedRevision?.label ?? null;
  const enrollment = project?.enrollments[0] ?? null;

  // Already enrolled -> past first-run; continue where they left off.
  if (project && revLabel && enrollment) {
    redirect(
      `/projects/${project.slug}/${encodeURIComponent(revLabel)}/guide/${enrollment.currentStage}`,
    );
  }

  // No goal recorded yet -> ask the one question first.
  if (!user.onboardingGoal) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <GoalSurvey />
      </main>
    );
  }

  // Goal set, not enrolled -> the single "start here" action.
  const continueHref =
    project && revLabel
      ? `/projects/${project.slug}/${encodeURIComponent(revLabel)}/guide/REQUIREMENTS`
      : null;

  // What the learner walks away with — the B2 "outcome checklist" framing.
  const outcomes = [
    "Fab-ready gerbers a shop can build",
    "A verifiable certificate",
    "The real KiCad files, yours to keep",
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Start here
      </p>
      <h1 className="title-hero mt-2">Design your first real board</h1>
      <p className="mt-4 font-serif text-lg leading-relaxed text-text">
        L1.01 is free and the right place to begin. You design an ESP32-S3 board
        end to end in KiCad 10: requirements, BOM, schematic, ERC, layout, DRC,
        gerbers. No PCB experience needed.
      </p>

      <ul className="mt-6 border-t border-panel-border/60">
        {outcomes.map((o) => (
          <li
            key={o}
            className="flex items-center gap-3 border-b border-panel-border/60 py-3"
          >
            <span aria-hidden className="font-mono text-sm text-status-green">
              ✓
            </span>
            <span className="font-serif text-base text-text">{o}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
        {project && revLabel && continueHref ? (
          <EnrollButton
            projectId={project.id}
            continueHref={continueHref}
            label="Start L1.01"
            busyLabel="Starting…"
            cta
          />
        ) : (
          <p className="font-mono text-sm uppercase tracking-wider text-muted">
            The entry board is not open yet.
          </p>
        )}
        <StartConsent initialConsent={user.emailConsent} />
      </div>
    </main>
  );
}
