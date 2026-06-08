"use server";

// Optional board-exam actions. getExam returns the question bank STRIPPED of the
// answer key (correctIndex) for client rendering; submitExam (Task 3.3) scores
// authoritatively server-side and confers MASTERED. Contrast the soft,
// client-scored stage quizzes — the exam yields a credential, so it is graded
// on the server with the answer key that never leaves it.
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { withTxRetry } from "@/lib/tx-retry";

// The stored question shape (answer key included). Validated on read so a
// malformed bank fails loudly rather than leaking an unexpected field.
const storedQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  correctIndex: z.int().nonnegative(),
});
const storedQuestionsSchema = z.array(storedQuestionSchema);

type PublicQuestion = { id: string; prompt: string; options: string[] };
type PublicExam = {
  id: string;
  title: string;
  passThreshold: number;
  questions: PublicQuestion[];
};

export async function getExam(projectId: string): Promise<PublicExam | null> {
  await requireUser();
  const exam = await db.exam.findUnique({
    where: { projectId },
    select: { id: true, title: true, passThreshold: true, questions: true },
  });
  if (!exam) return null;
  const questions = storedQuestionsSchema.parse(exam.questions);
  return {
    id: exam.id,
    title: exam.title,
    passThreshold: exam.passThreshold,
    // Strip correctIndex — the answer key NEVER leaves the server.
    questions: questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  };
}

const submitExamSchema = z.object({
  projectId: z.cuid(),
  // questionId -> selected option index
  answers: z.record(z.string(), z.int().nonnegative()),
});

// Server-authoritative scoring. Eligible once the enrollment is COMPLETED (the
// exam never blocks completion — it's optional). Passing confers MASTERED;
// re-takes are allowed and never demote (status only climbs to MASTERED).
export async function submitExam(
  input: unknown,
): Promise<{ score: number; total: number; passed: boolean }> {
  const { projectId, answers } = submitExamSchema.parse(input);
  const user = await requireUser();

  const result = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const enrollment = await tx.enrollment.findUniqueOrThrow({
          where: { userId_projectId: { userId: user.id, projectId } },
          select: { id: true, status: true, project: { select: { slug: true } } },
        });
        if (enrollment.status === "IN_PROGRESS") {
          throw new Error("Finish the board before taking the exam.");
        }
        const exam = await tx.exam.findUniqueOrThrow({
          where: { projectId },
          select: { id: true, passThreshold: true, questions: true },
        });
        const questions = storedQuestionsSchema.parse(exam.questions);
        const total = questions.length;
        const score = questions.reduce(
          (n, q) => (answers[q.id] === q.correctIndex ? n + 1 : n),
          0,
        );
        const passed =
          total > 0 && Math.round((score / total) * 100) >= exam.passThreshold;

        await tx.examResult.create({
          data: {
            examId: exam.id,
            enrollmentId: enrollment.id,
            score,
            total,
            passed,
            answers,
          },
        });
        if (passed) {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { status: "MASTERED", masteredAt: new Date() },
          });
        }
        return { score, total, passed, slug: enrollment.project.slug };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidatePath(`/learn/${result.slug}`);
  return { score: result.score, total: result.total, passed: result.passed };
}
