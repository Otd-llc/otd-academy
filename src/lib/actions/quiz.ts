"use server";

// recordQuizPass — learner comprehension-quiz write (per Enrollment).
//
// The QuizBlock submits the learner's PICKED answers; this action re-scores them
// SERVER-SIDE against the card's real answer keys (which live in the DB guide
// content), and persists a QuizPass only on a genuine full-correct. That closes
// the old hole where the client posted its own `score` — a fabricated POST can no
// longer open the gate, because you must submit answers that actually MATCH the
// stored keys. The learner exit gate (learner-gates.ts) then ANDs
// `quizPasses.has(stage)`. One QuizPass row per (enrollment, stage).
//
// (The answer keys are still embedded in the client payload for instant
// per-question feedback; hiding them from the learner entirely is a separate,
// lower-value follow-up — the gate itself is now server-authoritative.)

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

const recordQuizPassSchema = z.object({
  enrollmentId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  // The learner's selected option index per question, in question order.
  answers: z.array(z.int().nonnegative()).min(1),
});

export type RecordQuizPassResult = { ok: boolean; message?: string };

export async function recordQuizPass(
  input: unknown,
): Promise<RecordQuizPassResult> {
  const user = await requireUser();
  const { enrollmentId, stage, answers } = recordQuizPassSchema.parse(input);

  // Load the enrollment (to confirm ownership) + this stage's card content, so we
  // can score against the SERVER's answer keys rather than a client-claimed score.
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: {
      userId: true,
      project: { select: { slug: true } },
      revision: {
        select: {
          label: true,
          guide: {
            select: {
              cards: { where: { stage }, select: { contentBlocks: true } },
            },
          },
        },
      },
    },
  });
  // A learner records only their OWN passes (no writing to someone else's track).
  if (enrollment.userId !== user.id) {
    return { ok: false, message: "Forbidden: not your enrollment." };
  }

  // Authoritative scoring: re-score the SUBMITTED answers against the card's real
  // answer keys. The server owns the keys, so a fabricated score can't pass.
  const card = enrollment.revision.guide?.cards[0];
  const parsed = card
    ? guideContentBlocksSchema.safeParse(card.contentBlocks)
    : null;
  const quizBlock = parsed?.success
    ? parsed.data.find((b) => b.type === "quiz")
    : undefined;
  if (!quizBlock || quizBlock.type !== "quiz") {
    return { ok: false, message: "No quiz on this stage." };
  }
  const keys = quizBlock.questions.map((q) => q.answer);
  const allCorrect =
    answers.length === keys.length && keys.every((k, i) => answers[i] === k);
  if (!allCorrect) {
    return { ok: false, message: "Quiz not fully correct yet." };
  }

  const total = keys.length;
  try {
    await db.quizPass.upsert({
      where: { enrollmentId_stage: { enrollmentId, stage } },
      create: { enrollmentId, stage, score: total, total },
      // Idempotent re-pass: passedAt stays the first pass; the gate only cares a
      // row exists.
      update: { score: total, total },
    });
  } catch (e) {
    // Concurrent double-submit raced on the unique key — already recorded.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: true };
    }
    throw e;
  }

  // Refresh the learner guide so the gate re-evaluates with the new pass.
  const base = `/projects/${enrollment.project.slug}/${encodeURIComponent(enrollment.revision.label)}/guide`;
  revalidatePath(base);
  revalidatePath(`${base}/${stage}`);
  revalidatePath(`/learn/${enrollment.project.slug}`);

  return { ok: true };
}
