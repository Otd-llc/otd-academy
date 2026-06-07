// Learner board page (Slice 4 / Task 4.3). Shows one of: Enroll (available),
// Continue (resume at the learner's currentStage), or Locked + the prerequisite
// list, plus an exam link once the board is COMPLETED.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { learnerBoardAvailability } from "@/lib/learner-board-availability";
import { STAGE_ORDER, STAGE_LABELS, type StageName } from "@/lib/stages";
import { EnrollButton } from "@/components/learn/EnrollButton";
import { ChevronLeftIcon } from "@/components/icons";

function guideHref(slug: string, revLabel: string, stage: string): string {
  return `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${stage}`;
}

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "text-signal-blue",
  COMPLETED: "text-status-green",
  MASTERED: "text-command-gold",
};

export default async function LearnerBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUserOrRedirect();

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      level: true,
      track: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
      exam: { select: { id: true } },
    },
  });
  if (!project) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: { currentStage: true, status: true },
  });

  const availability = await learnerBoardAvailability(user.id);
  const entry = availability.find((b) => b.projectId === project.id);
  const locked = entry ? !entry.available : false;

  const revLabel = project.publishedRevision?.label ?? null;
  const stageIndex = enrollment
    ? STAGE_ORDER.indexOf(enrollment.currentStage as StageName) + 1
    : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          My learning
        </Link>
      </nav>

      <div className="glass-card border-l-4 border-l-command-gold p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          Board · {project.slug}
          {project.level ? ` · ${project.level}` : ""}
          {project.track ? ` · ${project.track}` : ""}
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wider text-white">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-3 font-serif text-base leading-relaxed text-gray-1">
            {project.description}
          </p>
        )}
      </div>

      <section className="glass-card mt-6 p-6">
        {!project.publishedRevisionId || !revLabel ? (
          <p className="font-mono text-sm uppercase tracking-wider text-muted">
            This board isn’t open for enrollment yet.
          </p>
        ) : enrollment ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted">
                Status ·{" "}
                <span className={STATUS_COLOR[enrollment.status] ?? "text-gray-1"}>
                  {enrollment.status}
                </span>
              </p>
              <p className="font-mono text-xs uppercase tracking-wider text-muted">
                Stage {stageIndex} / {STAGE_ORDER.length} ·{" "}
                {STAGE_LABELS[enrollment.currentStage as StageName]}
              </p>
            </div>
            <Link
              href={guideHref(project.slug, revLabel, enrollment.currentStage)}
              className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
            >
              Continue
            </Link>
            {enrollment.status !== "IN_PROGRESS" && project.exam && (
              <div className="border-t border-panel-border pt-4">
                <Link
                  href={`/learn/${project.slug}/exam`}
                  className="inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:border-signal-blue"
                >
                  {enrollment.status === "MASTERED"
                    ? "Review exam"
                    : "Take the board exam"}
                </Link>
              </div>
            )}
          </div>
        ) : locked ? (
          <div className="space-y-3">
            <p className="font-mono text-sm uppercase tracking-wider text-alert-red">
              Locked — finish these boards first:
            </p>
            <ul className="space-y-1">
              {entry?.missingPrereqs.map((p) => (
                <li key={p.id} className="font-mono text-sm">
                  <Link
                    href={`/learn/${p.slug}`}
                    className="text-signal-blue underline"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Ready to start.
            </p>
            <EnrollButton
              projectId={project.id}
              continueHref={guideHref(project.slug, revLabel, "REQUIREMENTS")}
            />
          </div>
        )}
      </section>
    </main>
  );
}
