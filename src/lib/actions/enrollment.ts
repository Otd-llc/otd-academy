"use server";

// Learner enrollment actions. `enroll` is the learner's entry point into a
// board; `advanceEnrollment` (below) moves the learner's OWN currentStage,
// gated by learnerExitGate. Both require only a signed-in user (requireUser) —
// these are learner, not curriculum-authoring, mutations.
import { Prisma, type EnrollmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { withTxRetry } from "@/lib/tx-retry";

const enrollSchema = z.object({ projectId: z.cuid() });

export async function enroll(
  input: unknown,
): Promise<{ id: string; status: EnrollmentStatus }> {
  const { projectId } = enrollSchema.parse(input);
  const user = await requireUser();

  const enrollment = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const project = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { id: true, slug: true, publishedRevisionId: true },
        });
        if (!project.publishedRevisionId) {
          throw new Error("This board is not open for enrollment yet.");
        }
        // Idempotent: one Enrollment per (user, project). `update: {}` leaves an
        // existing enrollment (and its progress) untouched.
        return tx.enrollment.upsert({
          where: { userId_projectId: { userId: user.id, projectId } },
          update: {},
          create: {
            userId: user.id,
            projectId,
            revisionId: project.publishedRevisionId,
          },
          select: { id: true, status: true, project: { select: { slug: true } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidatePath(`/learn/${enrollment.project.slug}`);
  return { id: enrollment.id, status: enrollment.status };
}
