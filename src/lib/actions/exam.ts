"use server";

// Optional board-exam actions. getExam returns the question bank STRIPPED of the
// answer key (correctIndex) for client rendering; submitExam (Task 3.3) scores
// authoritatively server-side and confers MASTERED. Contrast the soft,
// client-scored stage quizzes — the exam yields a credential, so it is graded
// on the server with the answer key that never leaves it.
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

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
