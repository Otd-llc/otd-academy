// Learner exam page (Slice 4 / Task 4.4). Offered once the board is COMPLETED.
// Renders getExam questions (answer key already stripped server-side — verify in
// the page source) and submits to the server-scored submitExam.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { getExam } from "@/lib/actions/exam";
import { ExamForm } from "@/components/learn/ExamForm";
import { ChevronLeftIcon } from "@/components/icons";

export default async function LearnerExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUserOrRedirect();

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: {
      status: true,
      examResults: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { score: true, total: true, passed: true },
      },
    },
  });

  const exam = await getExam(project.id);

  const backLink = (
    <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
      <Link
        href={`/learn/${slug}`}
        className="inline-flex items-center gap-1.5 text-signal-blue underline"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {project.name}
      </Link>
    </nav>
  );

  if (!exam) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {backLink}
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          This board has no exam.
        </p>
      </main>
    );
  }

  // Eligibility: the exam is offered once the board is COMPLETED (or MASTERED).
  if (!enrollment || enrollment.status === "IN_PROGRESS") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {backLink}
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          Finish the board before taking the exam.
        </p>
      </main>
    );
  }

  const latest = enrollment.examResults[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {backLink}
      <div className="glass-card border-l-4 border-l-command-gold p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          Board exam · pass ≥ {exam.passThreshold}%
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wider text-white">
          {exam.title}
        </h1>
        {enrollment.status === "MASTERED" && (
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-command-gold">
            ★ You’ve mastered this board. Re-takes are allowed.
          </p>
        )}
        {latest && (
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
            Last attempt: {latest.score}/{latest.total}
          </p>
        )}
      </div>

      <div className="mt-6">
        <ExamForm
          projectId={project.id}
          questions={exam.questions}
          passThreshold={exam.passThreshold}
        />
      </div>
    </main>
  );
}
