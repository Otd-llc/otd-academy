import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { getExam } from "@/lib/actions/exam";
import { BrandMark } from "@/components/BrandMark";
import { SupportBlock } from "@/components/learn/SupportBlock";
import { pickNextLessons } from "@/lib/learner-next-lessons";

export default async function LessonCompletePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUserOrRedirect();

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!project) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: { status: true },
  });
  // Only a finished learner sees this screen; anyone else goes back to the board.
  if (!enrollment || enrollment.status === "IN_PROGRESS") {
    redirect(`/learn/${slug}`);
  }
  const mastered = enrollment.status === "MASTERED";

  const exam = await getExam(project.id); // null when the lesson has no exam

  // Next lesson(s): DAG dependents of this lesson that are published.
  const deps = await db.projectDependency.findMany({
    where: { dependsOnProjectId: project.id },
    select: { dependentProjectId: true },
  });
  const nextProjects = deps.length
    ? await db.project.findMany({
        where: {
          id: { in: deps.map((d) => d.dependentProjectId) },
          publishedRevisionId: { not: null },
        },
        select: { slug: true, name: true, criticalPath: true },
      })
    : [];
  const next = pickNextLessons(
    nextProjects.map((p) => ({ slug: p.slug, name: p.name, criticalPath: !!p.criticalPath })),
  );

  return (
    <main className="relative mx-auto flex min-h-[80svh] max-w-3xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6">
      {/* Hero — the viz "mission complete" reveal */}
      <BrandMark className="signin-rise animate-pulse-brand h-14 w-14 text-command-gold" />
      <div className="signin-rise flex flex-col items-center" style={{ animationDelay: "90ms" }}>
        <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          {mastered ? "// Mastered" : "// Lesson complete"}
        </span>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-[0.12em] text-gray-1 sm:text-5xl">
          {project.name}
        </h1>
        <p className="mt-4 font-serif text-base italic text-gold-dim">
          You built a real board, start to finish.
        </p>
      </div>
      <div
        aria-hidden
        className="signin-rise h-px w-[140px] overflow-hidden bg-bg-3"
        style={{ animationDelay: "150ms" }}
      >
        <div className="signin-bar-fill h-full bg-command-gold" />
      </div>

      {/* Exam entry / certificate */}
      {exam ? (
        <section
          className="signin-rise w-full max-w-2xl"
          style={{ animationDelay: "210ms" }}
        >
          {mastered ? (
            <div className="glass-card border-command-gold/40 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                ★ Verified Certificate of Achievement — earned
              </p>
              <Link
                href={`/learn/${slug}/exam`}
                className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.2em] text-gray-2 underline hover:text-command-gold"
              >
                Review exam
              </Link>
            </div>
          ) : (
            <div className="glass-card p-6">
              <p className="font-display text-xl tracking-wider text-gray-1">
                Earn your Verified Certificate of Achievement
              </p>
              <p className="mt-2 font-serif text-sm italic text-gray-2">
                Optional — take the final exam to verify what you learned.
              </p>
              <Link
                href={`/learn/${slug}/exam`}
                className="glass-button glass-button-cta mt-4 inline-block px-6 py-3 font-mono text-sm uppercase tracking-[0.18em]"
              >
                Take the final exam
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* Affiliate support */}
      <div className="signin-rise" style={{ animationDelay: "270ms" }}>
        <SupportBlock />
      </div>

      {/* Next lesson(s) */}
      <section
        className="signin-rise flex w-full max-w-2xl flex-col items-center gap-3"
        style={{ animationDelay: "330ms" }}
      >
        {next.length > 0 ? (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
              // Up next
            </span>
            {next.map((n) => (
              <Link
                key={n.slug}
                href={`/learn/${n.slug}`}
                className="glass-button w-full max-w-md px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
              >
                {n.name} →
              </Link>
            ))}
          </>
        ) : null}
        <Link
          href="/learn"
          className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-gray-3 transition-colors hover:text-command-gold"
        >
          ← All lessons
        </Link>
      </section>
    </main>
  );
}
