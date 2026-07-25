// Learner home / transcript (Slice 4 / Task 4.5). Lists the learner's enrolled
// boards with stage progress, quiz grades, exam grade + MASTERED badge, plus the
// boards available to start (and locked ones with their prerequisites).
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { LearnLadder } from "@/components/learn/LearnLadder";
import { LibraryStanding } from "@/components/learn/LibraryStanding";
import { DunningBanner } from "@/components/billing/DunningBanner";
import { pastDueSubscription } from "@/lib/past-due-subscription";
import { getLearnLibraryStanding } from "@/lib/logbook/load";
import { boardPoster } from "@/lib/board-posters";
import { currentUserOrRedirect } from "@/lib/learner";
import { learnerBoardAvailability } from "@/lib/learner-board-availability";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  ENROLLMENT_STATUS_LABEL,
  type StageName,
} from "@/lib/stages";
import type { EnrollmentStatus } from "@prisma/client";

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "text-signal-blue",
  COMPLETED: "text-status-green",
  MASTERED: "text-command-gold",
};

export default async function LearnerHomePage() {
  const user = await currentUserOrRedirect();
  const pastDue = await pastDueSubscription(user.id);

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    select: {
      status: true,
      currentStage: true,
      projectId: true,
      revision: { select: { label: true } },
      project: { select: { slug: true, name: true, exam: { select: { id: true } } } },
      quizPasses: { select: { stage: true } },
      examResults: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { score: true, total: true, passed: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });
  // Derived from the one enrollment scan above — this page used to issue the
  // same scan three times (here, an ids-only copy, and inside availability).
  const enrolledProjectIds = new Set(enrollments.map((e) => e.projectId));

  // Ladder rows — latest-activity board (index 0; ordered startedAt desc above)
  // is the one the selector opens on. Poster gated to slugs with a baked asset.
  const ladderBoards = enrollments.map((e) => {
    const exam = e.examResults[0];
    const done = e.status === "COMPLETED" || e.status === "MASTERED";
    const revLabel = e.revision?.label ?? null;
    // Resume INTO the build — the guide at the current stage — not the board-detail
    // page (which just re-states this row). Completed → the completion page.
    const href = done
      ? `/learn/${e.project.slug}/complete`
      : revLabel
        ? `/projects/${e.project.slug}/${encodeURIComponent(revLabel)}/guide/${e.currentStage}`
        : `/learn/${e.project.slug}`;
    return {
      slug: e.project.slug,
      name: e.project.name,
      href,
      statusLabel: ENROLLMENT_STATUS_LABEL[e.status as EnrollmentStatus] ?? e.status,
      statusColor: STATUS_COLOR[e.status] ?? "text-text",
      done,
      stageIndex: STAGE_ORDER.indexOf(e.currentStage as StageName) + 1,
      totalStages: STAGE_ORDER.length,
      phase: STAGE_LABELS[e.currentStage as StageName],
      checks: e.quizPasses.length,
      poster: boardPoster(e.project.slug),
      exam: exam ? { score: exam.score, total: exam.total, passed: exam.passed } : null,
    };
  });

  const availability = await learnerBoardAvailability(
    user.id,
    enrollments.map((e) => ({ projectId: e.projectId, status: e.status })),
  );
  const availabilityById = new Map(availability.map((a) => [a.projectId, a]));
  const browsable = await db.project.findMany({
    where: { archivedAt: null, publishedRevisionId: { not: null } },
    select: { id: true, slug: true, name: true, level: true, track: true },
    orderBy: { name: "asc" },
  });
  const notEnrolled = browsable.filter((p) => !enrolledProjectIds.has(p.id));

  // Subordinate Library standing (owner-picked L1 strip) — rank + lessons read +
  // the single resume lesson. Null when no public library lessons exist.
  const libraryStanding = await getLearnLibraryStanding(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {pastDue ? <DunningBanner /> : null}
      <PageHeader
        eyebrow="YOUR PROGRESS"
        title="My learning"
        lead="Your enrolled boards and where each one stands."
      />

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Enrolled boards
        </h2>
        {enrollments.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            Not enrolled in any board yet. Pick one below.
          </p>
        ) : (
          <LearnLadder boards={ladderBoards} />
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Available boards
        </h2>
        {notEnrolled.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            No other boards open right now.
          </p>
        ) : (
          <ul className="mt-4 border-t border-panel-border/60">
            {notEnrolled.map((p) => {
              const locked = !(availabilityById.get(p.id)?.available ?? true);
              return (
                <li
                  key={p.slug}
                  className="group flex items-center justify-between gap-4 border-b border-panel-border/60 py-6 hover:bg-command-gold/[0.04] focus-within:bg-command-gold/[0.06]"
                >
                  <Link
                    href={`/learn/${p.slug}`}
                    className="title-card group-hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
                  >
                    {p.name}
                  </Link>
                  <span className="font-mono text-xs uppercase tracking-wider text-muted">
                    {locked ? (
                      <span className="text-alert-red">Locked</span>
                    ) : (
                      "Available"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {libraryStanding ? <LibraryStanding standing={libraryStanding} /> : null}
    </main>
  );
}
