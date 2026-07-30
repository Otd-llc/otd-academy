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
import { gateQuizBlock } from "@/lib/gate-quiz";
import { loadStageCard } from "@/lib/logbook/stage-card-load";

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

  // Shared load (loadStageCard): the enrollment ownership + this stage's card
  // content, the same shape the per-pick XP scorer uses — one loader so the gate
  // and the XP can't drift on which card they read.
  const load = await loadStageCard(db, enrollmentId, stage, user.id);
  // A learner records only their OWN passes (no writing to someone else's track).
  if (!load.owned) {
    return { ok: false, message: "Forbidden: not your enrollment." };
  }

  // Authoritative scoring: re-score the SUBMITTED answers against the card's real
  // answer keys. The server owns the keys, so a fabricated score can't pass.
  // Which block is THE gate now lives in gate-quiz.ts — one home, because the
  // client dispatch (GuideBlocks) and the review-snapshot path have to agree with
  // this on which block opens the gate, and three copies of the rule drift. (WI-2)
  const quizBlock = gateQuizBlock(load.contentBlocks);
  if (!quizBlock) {
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
  const base = `/projects/${load.projectSlug}/${encodeURIComponent(load.revLabel)}/guide`;
  revalidatePath(base);
  revalidatePath(`${base}/${stage}`);
  revalidatePath(`/learn/${load.projectSlug}`);

  return { ok: true };
}
