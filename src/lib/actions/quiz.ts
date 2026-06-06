"use server";

// recordQuizPass — soft quiz-gate write (learner-guide).
//
// The comprehension quiz on each stage card is client-scored for instant
// feedback; when the learner gets every question right, the QuizBlock calls
// this action to PERSIST the pass. The stage exit gate (stages.ts) then ANDs
// `quizPasses.has(stage)` into the work-gate, so a stage won't open until both
// the work is done AND its quiz is passed.
//
// "Soft" by design: scoring stays on the client, so a determined user could
// fake the POST — but in a self-paced learning tool the only person that hurts
// is the learner. We still refuse to record a pass the client didn't claim as
// fully correct, and we keep the standard mutation discipline (requireUser,
// assertNotFrozen, Serializable tx + retry, revalidate). Scoped to the Revision,
// the same scope as every other gate input — one QuizPass row per (rev, stage).

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";

const recordQuizPassSchema = z.object({
  revisionId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  score: z.int().nonnegative(),
  total: z.int().positive(),
});

export type RecordQuizPassResult = { ok: boolean; message?: string };

export async function recordQuizPass(
  input: unknown,
): Promise<RecordQuizPassResult> {
  await requireUser();
  const data = recordQuizPassSchema.parse(input);

  // Don't record a pass the client didn't actually earn (a full score).
  if (data.score < data.total) {
    return { ok: false, message: "Quiz not fully correct yet." };
  }

  try {
    await withTxRetry(() =>
      db.$transaction(
        async (tx) => {
          await assertNotFrozen(tx, data.revisionId);
          await tx.quizPass.upsert({
            where: {
              revisionId_stage: {
                revisionId: data.revisionId,
                stage: data.stage,
              },
            },
            create: {
              revisionId: data.revisionId,
              stage: data.stage,
              score: data.score,
              total: data.total,
            },
            // Idempotent re-pass: keep the latest score (passedAt is left as the
            // first pass — the gate only cares that a row exists).
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

  // Refresh the stage card + hub so the gate re-evaluates with the new pass.
  const rev = await db.revision.findUniqueOrThrow({
    where: { id: data.revisionId },
    select: { label: true, project: { select: { slug: true } } },
  });
  const base = `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}/guide`;
  revalidatePath(base);
  revalidatePath(`${base}/${data.stage}`);

  return { ok: true };
}
