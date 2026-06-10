"use server";

// Learner enrollment actions. `enroll` is the learner's entry point into a
// board; `advanceEnrollment` (below) moves the learner's OWN currentStage,
// gated by learnerExitGate. Both require only a signed-in user (requireUser) —
// these are learner, not curriculum-authoring, mutations.
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { Prisma, type EnrollmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { withTxRetry } from "@/lib/tx-retry";
import { r2, enrollmentArtifactKey } from "@/lib/r2";
import { nextStage, type StageName } from "@/lib/stages";
import { learnerExitGate, learnerProofSubkind } from "@/lib/learner-gates";
import { gateSpec } from "@/lib/gate-spec";
import { getR2ObjectText } from "@/lib/part-r2";
import { validateErcReport } from "@/lib/kicad/erc-report";
import { hasProjectEntitlement } from "@/lib/entitlements";
import { loadLearnerGateContext } from "@/lib/load-learner-gate-context";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

const PROOF_PUT_TTL_SECONDS = 900; // 15 min, mirrors uploads.ts
// ERC reports are kilobytes; refuse to slurp a huge file into memory as text.
const ERC_VALIDATE_MAX_BYTES = 5_000_000;

function ensureR2Enabled(): void {
  if (!env.R2_ENABLED) {
    throw new Error(
      "R2 file storage is not enabled on this deployment. Set R2_ENABLED=true and configure R2_* credentials.",
    );
  }
  if (!env.R2_BUCKET) throw new Error("R2_BUCKET is not configured.");
}

type AdvanceEnrollmentResult =
  | { ok: true; toStage: StageName }
  | { ok: false; reasons: string[] };

const enrollSchema = z.object({ projectId: z.cuid() });
const advanceEnrollmentSchema = z.object({ projectId: z.cuid() });
const submitProofSchema = z.object({
  projectId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  linkUrl: z.url().max(2000),
});
const proofUploadUrlSchema = z.object({
  projectId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  sizeBytes: z.int().positive().max(MAX_UPLOAD_BYTES),
});
const recordProofSchema = z.object({
  projectId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  key: z.string().min(1).max(1024),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  sizeBytes: z.int().positive().max(MAX_UPLOAD_BYTES),
});

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
          select: {
            id: true,
            slug: true,
            publishedRevisionId: true,
            accessTier: true,
          },
        });
        if (!project.publishedRevisionId) {
          throw new Error("This board is not open for enrollment yet.");
        }

        // Access-tier gate (Task A4): PUBLIC/FREE boards are open; PREMIUM ones
        // require an Entitlement. The free-preview first card does NOT grant
        // enrollment, so we check the row here rather than trusting page reads.
        if (project.accessTier === "PREMIUM") {
          const entitled = await hasProjectEntitlement(tx, user.id, projectId);
          if (!entitled) {
            throw new Error(
              "This is a premium course — unlock it to enroll.",
            );
          }
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

// Learner proof artifact for a design stage (REQUIREMENTS / SCHEMATIC / LAYOUT).
// A lightweight LINK artifact (a URL to the learner's doc/file) — sidesteps R2
// and the frozen-reference problem by attaching to the enrollment, not the
// revision. Idempotent: one proof per (enrollment, subkind) satisfies the gate.
export async function submitEnrollmentProof(
  input: unknown,
): Promise<{ ok: true }> {
  const { projectId, stage, linkUrl } = submitProofSchema.parse(input);
  const user = await requireUser();
  const subkind = learnerProofSubkind(stage);
  if (!subkind) {
    throw new Error("This stage does not take a proof artifact.");
  }
  // A validated stage checks the file's contents, so a pasted link (which we
  // can't fetch + parse reliably) can't satisfy it — require the file itself.
  const linkArtifact = gateSpec(stage).artifact;
  if (linkArtifact?.validate) {
    throw new Error(
      `This stage checks the file's contents, so paste-a-link isn't accepted — upload the ${linkArtifact.label} file itself.`,
    );
  }

  await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const enrollment = await tx.enrollment.findUniqueOrThrow({
          where: { userId_projectId: { userId: user.id, projectId } },
          select: { id: true, project: { select: { slug: true } } },
        });
        const existing = await tx.artifact.findFirst({
          where: { enrollmentId: enrollment.id, subkind },
          select: { id: true },
        });
        if (!existing) {
          await tx.artifact.create({
            data: {
              enrollmentId: enrollment.id,
              stage,
              kind: "LINK",
              subkind,
              title: `${subkind} (learner submission)`,
              linkUrl,
              createdBy: user.id,
            },
          });
        }
        revalidatePath(
          `/projects/${enrollment.project.slug}`,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return { ok: true };
}

// ─── Learner proof UPLOAD (presigned PUT to R2) ────────────────────────────
// The primary proof path: the learner uploads their own file straight to R2,
// mirroring the author upload flow (createUploadUrl → client PUT → recordArtifact
// + HEAD-verify). Two steps so the bytes never transit the server. Both gate on
// the caller owning the enrollment and the stage actually taking a proof.

export type EnrollmentProofUploadUrl = {
  uploadUrl: string;
  key: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  stage: StageName;
};

export async function createEnrollmentProofUploadUrl(
  input: unknown,
): Promise<EnrollmentProofUploadUrl> {
  const data = proofUploadUrlSchema.parse(input);
  const user = await requireUser();
  const subkind = learnerProofSubkind(data.stage);
  if (!subkind) throw new Error("This stage does not take a proof artifact.");
  if (data.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large: ${data.sizeBytes} exceeds ${MAX_UPLOAD_BYTES}.`);
  }
  // Caller must own the enrollment (throws if they aren't enrolled).
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { userId_projectId: { userId: user.id, projectId: data.projectId } },
    select: { id: true },
  });
  ensureR2Enabled();

  const key = enrollmentArtifactKey(
    enrollment.id,
    data.stage,
    createId(),
    data.filename,
  );
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      ContentLength: data.sizeBytes,
      ContentType: data.mime,
    }),
    { expiresIn: PROOF_PUT_TTL_SECONDS },
  );
  return {
    uploadUrl,
    key,
    filename: data.filename,
    mime: data.mime,
    sizeBytes: data.sizeBytes,
    stage: data.stage as StageName,
  };
}

export async function recordEnrollmentProof(
  input: unknown,
): Promise<{ ok: true; valid: boolean | null; detail: string | null }> {
  const data = recordProofSchema.parse(input);
  const user = await requireUser();
  const subkind = learnerProofSubkind(data.stage);
  if (!subkind) throw new Error("This stage does not take a proof artifact.");

  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { userId_projectId: { userId: user.id, projectId: data.projectId } },
    select: { id: true, project: { select: { slug: true } } },
  });
  // The key must live under this enrollment's prefix — blocks a forged token
  // from pointing the row at another enrollment's (or the author's) object.
  if (!data.key.startsWith(`enrollments/${enrollment.id}/`)) {
    throw new Error("Upload key does not belong to this enrollment.");
  }
  ensureR2Enabled();

  // HEAD-verify the uploaded object (R2 has been inconsistent about enforcing
  // presigned Content-Length); delete + reject an oversize object.
  const head = await r2.send(
    new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: data.key }),
  );
  const actualSize = head.ContentLength ?? 0;
  if (actualSize > data.sizeBytes || actualSize > MAX_UPLOAD_BYTES) {
    await r2.send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: data.key }),
    );
    throw new Error(
      `Uploaded file exceeds declared size (${actualSize} > ${data.sizeBytes}).`,
    );
  }

  // Content validation ("passes muster") for subkinds that carry a validator —
  // an ERC_REPORT must parse to ZERO errors. The artifact is still recorded on a
  // fail (valid=false) so the gate can show the specific reason; the gate only
  // clears on valid=true. Presence-only subkinds leave valid = null.
  const validator = gateSpec(data.stage).artifact?.validate ?? null;
  let valid: boolean | null = null;
  let validationDetail: string | null = null;
  if (validator === "erc") {
    if (actualSize > ERC_VALIDATE_MAX_BYTES) {
      valid = false;
      validationDetail = "file is far too large to be an ERC report";
    } else {
      let text: string;
      try {
        text = await getR2ObjectText(data.key);
      } catch {
        await r2.send(
          new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: data.key }),
        );
        throw new Error(
          "Could not read the uploaded file to validate it — try again.",
        );
      }
      const result = validateErcReport(text);
      valid = result.ok;
      validationDetail = result.detail;
    }
  }

  const created = await db.artifact.create({
    data: {
      enrollmentId: enrollment.id,
      stage: data.stage,
      kind: "FILE",
      subkind,
      title: data.filename,
      fileKey: data.key,
      fileMime: data.mime,
      fileBytes: actualSize,
      valid,
      validationDetail,
      createdBy: user.id,
    },
  });

  // Replace any earlier proof of the same subkind for this enrollment so the gate
  // reflects the LATEST upload (and we don't accumulate dead files in R2).
  const stale = await db.artifact.findMany({
    where: { enrollmentId: enrollment.id, subkind, id: { not: created.id } },
    select: { id: true, fileKey: true },
  });
  if (stale.length) {
    await db.artifact.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
    for (const s of stale) {
      if (!s.fileKey) continue;
      try {
        await r2.send(
          new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: s.fileKey }),
        );
      } catch {
        // best-effort cleanup; a leftover object isn't worth failing the upload.
      }
    }
  }

  revalidatePath(`/projects/${enrollment.project.slug}`);
  return { ok: true, valid, detail: validationDetail };
}
