"use server";

// recordQuizPass — learner comprehension-quiz write (per Enrollment).
//
// Each stage card's quiz is client-scored for instant feedback; when the learner
// gets every question right, the QuizBlock calls this to PERSIST the pass. The
// learner exit gate (learner-gates.ts) then ANDs `quizPasses.has(stage)` so the
// learner's own stage won't open until both the proof artifact (where required)
// AND the quiz are done.
//
// "Soft" by design: scoring stays on the client, so a determined learner could
// fake the POST — but in a self-paced tool the only person that hurts is the
// learner. We still refuse a pass the client didn't claim as fully correct, and
// we refuse to write to an enrollment that isn't the caller's. One QuizPass row
// per (enrollment, stage).

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { withTxRetry } from "@/lib/tx-retry";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";

const recordQuizPassSchema = z.object({
  enrollmentId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  score: z.int().nonnegative(),
  total: z.int().positive(),
});

export type RecordQuizPassResult = { ok: boolean; message?: string };

export async function recordQuizPass(
  input: unknown,
): Promise<RecordQuizPassResult> {
  const user = await requireUser();
  const data = recordQuizPassSchema.parse(input);

  // Don't record a pass the client didn't actually earn (a full score).
  if (data.score < data.total) {
    return { ok: false, message: "Quiz not fully correct yet." };
  }

  try {
    await withTxRetry(() =>
      db.$transaction(
        async (tx) => {
          // The enrollment must belong to the caller — a learner records only
          // their own passes (no writing to someone else's track).
          const enrollment = await tx.enrollment.findUniqueOrThrow({
            where: { id: data.enrollmentId },
            select: { userId: true },
          });
          if (enrollment.userId !== user.id) {
            throw new Error("Forbidden: not your enrollment.");
          }
          await tx.quizPass.upsert({
            where: {
              enrollmentId_stage: {
                enrollmentId: data.enrollmentId,
                stage: data.stage,
              },
            },
            create: {
              enrollmentId: data.enrollmentId,
              stage: data.stage,
              score: data.score,
              total: data.total,
            },
            // Idempotent re-pass: keep the latest score (passedAt stays the first
            // pass — the gate only cares that a row exists).
            update: { score: data.score, total: data.total },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  } catch (e) {
    // Concurrent double-submit raced on the unique key — already recorded.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: true };
    }
    throw e;
  }

  // Refresh the learner guide so the gate re-evaluates with the new pass.
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: data.enrollmentId },
    select: {
      project: { select: { slug: true } },
      revision: { select: { label: true } },
    },
  });
  const base = `/projects/${enrollment.project.slug}/${encodeURIComponent(enrollment.revision.label)}/guide`;
  revalidatePath(base);
  revalidatePath(`${base}/${data.stage}`);
  revalidatePath(`/learn/${enrollment.project.slug}`);

  return { ok: true };
}
