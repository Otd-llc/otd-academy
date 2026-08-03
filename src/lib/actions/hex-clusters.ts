"use server";

// Saving a hex-cluster build to a student's account.
//
// "use server" rule: this file exports ONLY async functions. Every type,
// schema, constant and formatter lives in @/lib/hex-cluster — re-exporting a
// type from here compiles fine and crashes at runtime.
//
// THE ACADEMY IS A PIPE. The payload goes in opaque and comes out opaque,
// transport prefix included. It is never parsed, re-encoded or migrated here,
// and there is no server-side decompression path at all: the schema, its
// validator and its migrate() chokepoint live in the configurator on a
// different deploy cadence, and mirroring them would be a third copy of enum
// unions that file already documents as fragile.
//
// Design: docs/plans/2026-08-01-hex-cluster-saved-builds-design.md §§5.2, 5.3, 6.

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUserId, requireUser } from "@/lib/auth-helpers";
import { enforce } from "@/lib/abuse-limit";
import { hexSaveCheck } from "@/lib/abuse-policy";
import { defenseEnabled } from "@/lib/abuse-defense-flag";
import { invalidateHexCluster } from "@/lib/cache-invalidate";
import {
  IDEMPOTENCY_WINDOW_MS,
  MAX_ACTIVE_CLUSTERS,
  MAX_REVISIONS_PER_CLUSTER,
  MAX_TOTAL_CLUSTERS,
  SAVE_ERROR_MESSAGE,
  checkPayload,
  formatDrawingLabel,
  formatRevLabel,
  isPayloadHash,
  makeShareCode,
  normaliseName,
  validateSummaryWire,
  type MutateResult,
  type SaveErrCode,
  type SaveInput,
  type SaveResult,
} from "@/lib/hex-cluster";

function fail(code: SaveErrCode): SaveResult {
  return { ok: false, code, message: SAVE_ERROR_MESSAGE[code] };
}

/**
 * Serialise everything this user does, for the length of one transaction.
 *
 * MEASURED against local PG 17.10, and every one of these is a real race the
 * obvious code loses:
 *   - `count()` in-transaction under READ COMMITTED does NOT hold a cap: two
 *     transactions both saw 2, both inserted, final 4 against a cap of 3.
 *   - `INSERT … SELECT COALESCE(MAX(revNo),0)+1` races: with the unique index
 *     dropped, both computed revNo 2.
 *   - WITH the index, the loser BLOCKS on the uncommitted key and then errors
 *     55P03 under a lock_timeout — it does not fail fast.
 *   - A P2002 retry never fires: a raw-SQL violation surfaces as P2010 with the
 *     SQLSTATE buried at meta.driverAdapterError.cause.originalCode.
 *   - Retrying inside the transaction is impossible: the next statement gets
 *     25P02.
 *
 * One advisory lock keyed on the user fixes the quota check, the revNo
 * allocation and the idempotency read-then-write together. Transaction-scoped,
 * so it is safe on Neon's PgBouncer pooler — only SESSION-level advisory locks
 * are unsupported there. @@unique([clusterId, revNo]) stays as the backstop.
 */
async function lockUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

export async function saveHexCluster(input: SaveInput): Promise<SaveResult> {
  const user = await requireUser();

  // Burst rate only. enforce() is a sliding-window RATE limiter: it cannot
  // express "50 rows exist", returns ok when KV_REST_API_* is unset (all of
  // local and CI), and degrades open — so the quotas below are counted in SQL
  // instead. It also does not self-gate; callers apply the flag.
  if (await defenseEnabled()) {
    const verdict = await enforce([hexSaveCheck(user.id)], "open");
    if (!verdict.ok) return fail("rate-limited");
  }

  const name = normaliseName(input.name);
  if (!name) return fail("name-invalid");

  const payloadProblem = checkPayload(input.payload);
  if (payloadProblem === "uncompressed") return fail("payload-uncompressed");
  if (payloadProblem === "too-large") return fail("payload-too-large");
  if (payloadProblem) return fail("payload-malformed");

  if (!isPayloadHash(input.payloadHash)) return fail("payload-malformed");
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) {
    return fail("payload-malformed");
  }

  const summary = validateSummaryWire(input.summary);
  if (!summary) return fail("summary-invalid");
  // The academy stamps the confirmed name in. The configurator never puts user
  // text in the envelope — that keeps its base64 encoder off CJK and emoji —
  // and a FIRST save has no name until this page collects it, so without this
  // /c/ would render a blank title.
  const stored = { ...summary, nameAtSave: name };

  if (input.mode === "rev" && !input.share) return fail("not-found");

  try {
    return await db.$transaction(async (tx) => {
      await lockUser(tx, user.id);

      if (input.mode === "rev") {
        return await saveRevision(tx, user.id, input, stored, name);
      }
      return await saveNewDrawing(tx, user.id, input, stored, name);
    });
  } catch (err) {
    console.error("[hex-clusters] save failed", err);
    return fail("payload-malformed");
  }
}

async function saveRevision(
  tx: Prisma.TransactionClient,
  userId: string,
  input: SaveInput,
  stored: object,
  name: string,
): Promise<SaveResult> {
  // Ownership lives in the WHERE, never in a later branch: a share code the
  // caller does not own must be indistinguishable from one that does not
  // exist.
  const parent = await tx.hexCluster.findFirst({
    where: { userId, revisions: { some: { shareCode: input.share! } } },
    select: { id: true, drawingNo: true, archivedAt: true },
  });
  if (!parent) return fail("not-found");

  if (parent.archivedAt) {
    // NOT not-found. Saving onto an archived drawing would resurrect it
    // silently, but the owner's remedy is one click — routing them into "save
    // as new" instead would mint a second drawing number for the same design
    // and burn another slot against both caps.
    if (!input.allowUnarchive) return fail("cluster-archived");
    const active = await tx.hexCluster.count({
      where: { userId, archivedAt: null },
    });
    if (active >= MAX_ACTIVE_CLUSTERS) return fail("quota-clusters");
    await tx.hexCluster.update({
      where: { id: parent.id },
      data: { archivedAt: null },
    });
  }

  const latest = await tx.hexClusterRevision.findFirst({
    where: { clusterId: parent.id },
    orderBy: { revNo: "desc" },
    select: {
      id: true,
      revNo: true,
      payloadHash: true,
      shareCode: true,
      createdAt: true,
    },
  });

  // Idempotency, scoped to the LATEST revision only. Any-revision matching
  // would break the A -> B -> A invariant: editing back to earlier bytes must
  // mint a new revision carrying the old hash, which is exactly why
  // payloadHash is not unique per cluster.
  if (
    latest &&
    latest.payloadHash === input.payloadHash &&
    Date.now() - latest.createdAt.getTime() < IDEMPOTENCY_WINDOW_MS
  ) {
    return {
      ok: true,
      drawingLabel: formatDrawingLabel(parent.drawingNo),
      revLabel: formatRevLabel(latest.revNo),
      shareCode: latest.shareCode,
      name,
      savedAt: latest.createdAt.toISOString(),
    };
  }

  const revNo = (latest?.revNo ?? 0) + 1;
  if (revNo > MAX_REVISIONS_PER_CLUSTER) return fail("quota-revisions");

  const revision = await tx.hexClusterRevision.create({
    data: {
      clusterId: parent.id,
      revNo,
      shareCode: makeShareCode((n) => randomBytes(n)),
      payload: input.payload,
      payloadHash: input.payloadHash,
      schemaVersion: input.schemaVersion,
      summary: stored as Prisma.InputJsonValue,
    },
    select: { shareCode: true, createdAt: true },
  });

  // EXPLICITLY, because @updatedAt only fires when the cluster row itself is
  // updated and creating a revision does not touch it. Without this the
  // account list's "ordered by updatedAt" would order by
  // created-or-last-renamed, and @@index([userId, updatedAt]) would be
  // indexing the wrong thing.
  await tx.hexCluster.update({
    where: { id: parent.id },
    data: { updatedAt: new Date() },
  });

  invalidateHexCluster(parent.id);

  return {
    ok: true,
    drawingLabel: formatDrawingLabel(parent.drawingNo),
    revLabel: formatRevLabel(revNo),
    shareCode: revision.shareCode,
    name,
    savedAt: revision.createdAt.toISOString(),
  };
}

async function saveNewDrawing(
  tx: Prisma.TransactionClient,
  userId: string,
  input: SaveInput,
  stored: object,
  name: string,
): Promise<SaveResult> {
  // First-save idempotency is keyed (userId, payloadHash, revNo = 1) — there
  // is no clusterId yet. SCOPED TO FIRST REVISIONS, or it would swallow a
  // legitimate "Save as a new drawing" made within the window of a rev save of
  // the same bytes, which is precisely the fork offered at the revision cap.
  const recent = await tx.hexClusterRevision.findFirst({
    where: {
      revNo: 1,
      payloadHash: input.payloadHash,
      createdAt: { gt: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
      cluster: { userId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      shareCode: true,
      createdAt: true,
      cluster: { select: { drawingNo: true } },
    },
  });
  if (recent) {
    return {
      ok: true,
      drawingLabel: formatDrawingLabel(recent.cluster.drawingNo),
      revLabel: formatRevLabel(1),
      shareCode: recent.shareCode,
      name,
      savedAt: recent.createdAt.toISOString(),
    };
  }

  // Both caps, counted inside the lock. Archived rows do not count against the
  // active cap, which is what makes archive -> save -> archive an unbounded
  // write loop without the TOTAL cap. 200 total is terminal in v1: unarchiving
  // moves a row between states and leaves the total unchanged, so it is not an
  // exit, and hard delete is deliberately deferred because it 404s a printed
  // sheet's QR.
  const [active, total] = await Promise.all([
    tx.hexCluster.count({ where: { userId, archivedAt: null } }),
    tx.hexCluster.count({ where: { userId } }),
  ]);
  if (total >= MAX_TOTAL_CLUSTERS) return fail("quota-total");
  if (active >= MAX_ACTIVE_CLUSTERS) return fail("quota-clusters");

  const cluster = await tx.hexCluster.create({
    data: {
      userId,
      name,
      revisions: {
        create: {
          revNo: 1,
          shareCode: makeShareCode((n) => randomBytes(n)),
          payload: input.payload,
          payloadHash: input.payloadHash,
          schemaVersion: input.schemaVersion,
          summary: stored as Prisma.InputJsonValue,
        },
      },
    },
    select: {
      drawingNo: true,
      revisions: { select: { shareCode: true, createdAt: true } },
    },
  });

  return {
    ok: true,
    drawingLabel: formatDrawingLabel(cluster.drawingNo),
    revLabel: formatRevLabel(1),
    shareCode: cluster.revisions[0].shareCode,
    name,
    savedAt: cluster.revisions[0].createdAt.toISOString(),
  };
}

// â”€â”€ Row actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Their own result type: they mint no revision, so a SaveOk shape was
// unsatisfiable, and a bare boolean could not say why.

/**
 * The same save, for a caller that cannot afford a throw.
 *
 * `saveHexCluster` calls `requireUser()`, which THROWS for a signed-out
 * visitor. That is right for the save PAGE, whose route gate has already sent
 * anonymous visitors to /sign-in, so reaching the action signed out means
 * something is wrong. It is wrong for the embedded panel, where being signed
 * out is the ordinary case and the whole point is to discover it and offer a
 * sign-in WITHOUT tearing down a frame that is holding the visitor's build.
 *
 * A separate action rather than a flag on the existing one, and a WRAPPER shape
 * rather than a new `SaveErrCode` member: "signed out" is not a save error, it
 * is the absence of the identity a save needs, and putting it in that union
 * would add a case to every exhaustive switch over save failures that none of
 * them can act on.
 *
 * The session read here is NOT the security boundary. `saveHexCluster` still
 * calls `requireUser()`, and every write is still scoped by `userId` in the
 * WHERE clause. This only decides which UI to show.
 *
 * `currentUserId()` and not `auth()` directly, for two reasons. It is the
 * cheapest form of the question (the id rides on the session JWT, so the common
 * case is zero DB queries), and it keeps this module's auth dependency where
 * every other action in the file already has it -- importing `@/auth` here
 * bypassed the `@/lib/auth-helpers` mock in the action tests and pulled the real
 * next-auth into a vitest run, where `next/server` does not resolve.
 */
export async function saveHexClusterEmbedded(
  input: SaveInput,
): Promise<{ auth: "signed-out" } | { auth: "ok"; result: SaveResult }> {
  if (!(await currentUserId())) return { auth: "signed-out" };
  return { auth: "ok", result: await saveHexCluster(input) };
}

export async function renameHexCluster(
  id: string,
  rawName: string,
): Promise<MutateResult> {
  const user = await requireUser();
  const name = normaliseName(rawName);
  if (!name)
    return {
      ok: false,
      code: "name-invalid",
      message: SAVE_ERROR_MESSAGE["name-invalid"],
    };

  const updated = await db.hexCluster.updateMany({
    where: { id, userId: user.id },
    data: { name },
  });
  if (updated.count === 0) {
    return {
      ok: false,
      code: "not-found",
      message: SAVE_ERROR_MESSAGE["not-found"],
    };
  }
  // Deliberately NO cache invalidation: /c/ renders summary.nameAtSave, which a
  // rename cannot reach, and the HexCluster.name fallback applies only when
  // userId is null — a state in which nobody can rename.
  return { ok: true };
}

export async function archiveHexCluster(id: string): Promise<MutateResult> {
  const user = await requireUser();
  const updated = await db.hexCluster.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (updated.count === 0) {
    return {
      ok: false,
      code: "not-found",
      message: SAVE_ERROR_MESSAGE["not-found"],
    };
  }
  invalidateHexCluster(id);
  return { ok: true };
}

export async function unarchiveHexCluster(id: string): Promise<MutateResult> {
  const user = await requireUser();
  // Inside the same advisory-locked transaction as a save, and re-checking the
  // active cap: an unlocked count() does not hold a cap (measured), so
  // unarchiving is a way back over 50 without it.
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, user.id);
    const cluster = await tx.hexCluster.findFirst({
      where: { id, userId: user.id },
      select: { id: true, archivedAt: true },
    });
    if (!cluster)
      return {
        ok: false,
        code: "not-found" as const,
        message: SAVE_ERROR_MESSAGE["not-found"],
      };
    if (!cluster.archivedAt) return { ok: true as const };

    const active = await tx.hexCluster.count({
      where: { userId: user.id, archivedAt: null },
    });
    if (active >= MAX_ACTIVE_CLUSTERS) {
      return {
        ok: false,
        code: "quota-clusters" as const,
        message: SAVE_ERROR_MESSAGE["quota-clusters"],
      };
    }
    await tx.hexCluster.update({
      where: { id: cluster.id },
      data: { archivedAt: null },
    });
    return { ok: true as const };
  });

  // Or /c/ keeps saying "removed by its owner" for up to an hour after the
  // cluster is live again.
  if (result.ok) invalidateHexCluster(id);
  return result;
}
