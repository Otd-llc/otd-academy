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
import { nextStage, type StageName } from "@/lib/stages";
import { learnerExitGate } from "@/lib/learner-gates";
import { loadLearnerGateContext } from "@/lib/load-learner-gate-context";

type AdvanceEnrollmentResult =
  | { ok: true; toStage: StageName }
  | { ok: false; reasons: string[] };

const enrollSchema = z.object({ projectId: z.cuid() });
const advanceEnrollmentSchema = z.object({ projectId: z.cuid() });

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

        // Completion-gated DAG: every prerequisite (dependsOn) project must be at
        // least COMPLETED by this learner before they can enroll.
        const prereqEdges = await tx.projectDependency.findMany({
          where: { dependentProjectId: projectId },
          select: { dependsOnProjectId: true },
        });
        const required = new Set(prereqEdges.map((e) => e.dependsOnProjectId));
        if (required.size > 0) {
          const met = await tx.enrollment.count({
            where: {
              userId: user.id,
              projectId: { in: [...required] },
              status: { in: ["COMPLETED", "MASTERED"] },
            },
          });
          if (met < required.size) {
            throw new Error("Prerequisites not complete for this board.");
          }
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

// Advance the learner's OWN currentStage past `learnerExitGate`. Mirrors the
// author advanceStage optimistic-lock pattern (conditional UPDATE WHERE the
// stage still matches what we read). Advancing into the terminal REVISION stage
// flips the enrollment to COMPLETED.
export async function advanceEnrollment(
  input: unknown,
): Promise<AdvanceEnrollmentResult> {
  const { projectId } = advanceEnrollmentSchema.parse(input);
  const user = await requireUser();

  return withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const e = await tx.enrollment.findUniqueOrThrow({
          where: { userId_projectId: { userId: user.id, projectId } },
          select: {
            id: true,
            currentStage: true,
            project: { select: { slug: true } },
          },
        });
        const stage = e.currentStage as StageName;
        const to = nextStage(stage);
        if (!to) throw new Error("Already at the final stage.");

        const ctx = await loadLearnerGateContext(tx, e.id);
        const gate = learnerExitGate(stage, ctx);
        if (!gate.ok) return { ok: false as const, reasons: gate.reasons };

        const now = new Date();
        const terminal = to === "REVISION";
        const rows = await tx.$executeRaw`
          UPDATE "Enrollment"
          SET "currentStage" = ${to}::"Stage", "currentStageEnteredAt" = ${now}
              ${
                terminal
                  ? Prisma.sql`, "status" = 'COMPLETED'::"EnrollmentStatus", "completedAt" = ${now}`
                  : Prisma.empty
              }
          WHERE "id" = ${e.id} AND "currentStage" = ${stage}::"Stage"`;
        if (rows === 0) throw new Error("Stale state — refresh and try again.");

        revalidatePath(`/learn/${e.project.slug}`);
        return { ok: true as const, toStage: to };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
