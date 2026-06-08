// Learner home / transcript (Slice 4 / Task 4.5). Lists the learner's enrolled
// boards with stage progress, quiz grades, exam grade + MASTERED badge, plus the
// boards available to start (and locked ones with their prerequisites).
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { learnerBoardAvailability } from "@/lib/learner-board-availability";
import { STAGE_ORDER, STAGE_LABELS, type StageName } from "@/lib/stages";

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "text-signal-blue",
  COMPLETED: "text-status-green",
  MASTERED: "text-command-gold",
};

export default async function LearnerHomePage() {
  const user = await currentUserOrRedirect();

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    select: {
      status: true,
      currentStage: true,
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
  const enrolledProjectIds = new Set(
    (
      await db.enrollment.findMany({
        where: { userId: user.id },
        select: { projectId: true },
      })
    ).map((e) => e.projectId),
  );

  const availability = await learnerBoardAvailability(user.id);
  const availabilityById = new Map(availability.map((a) => [a.projectId, a]));
  const browsable = await db.project.findMany({
    where: { archivedAt: null, publishedRevisionId: { not: null } },
    select: { id: true, slug: true, name: true, level: true, track: true },
    orderBy: { name: "asc" },
  });
  const notEnrolled = browsable.filter((p) => !enrolledProjectIds.has(p.id));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl tracking-wider text-white">
        MY <span className="text-command-gold">LEARNING</span>
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-sm uppercase tracking-wider text-gold-dim">
          Enrolled boards
        </h2>
        {enrollments.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            Not enrolled in any board yet — pick one below.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {enrollments.map((e) => {
              const stageIndex =
                STAGE_ORDER.indexOf(e.currentStage as StageName) + 1;
              const exam = e.examResults[0];
              return (
                <li key={e.project.slug} className="glass-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/learn/${e.project.slug}`}
                      className="font-display text-xl tracking-wide text-command-gold underline"
                    >
                      {e.project.name}
                    </Link>
                    <span
                      className={`font-mono text-xs uppercase tracking-wider ${
                        STATUS_COLOR[e.status] ?? "text-gray-1"
                      }`}
                    >
                      {e.status === "MASTERED" ? "★ MASTERED" : e.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs uppercase tracking-wider text-muted">
                    <span>
                      Stage {stageIndex} / {STAGE_ORDER.length} ·{" "}
                      {STAGE_LABELS[e.currentStage as StageName]}
                    </span>
                    <span>{e.quizPasses.length} checks passed</span>
                    {exam && (
                      <span
                        className={
                          exam.passed ? "text-status-green" : "text-alert-red"
                        }
                      >
                        Exam {exam.score}/{exam.total}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-sm uppercase tracking-wider text-gold-dim">
          Available boards
        </h2>
        {notEnrolled.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            No other boards open right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {notEnrolled.map((p) => {
              const locked = !(availabilityById.get(p.id)?.available ?? true);
              return (
                <li
                  key={p.slug}
                  className="flex items-center justify-between gap-4 border border-panel-border px-4 py-3"
                >
                  <Link
                    href={`/learn/${p.slug}`}
                    className="font-mono text-sm text-signal-blue underline"
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
    </main>
  );
}
