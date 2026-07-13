"use server";

// Admin per-learner logbook mutations (2026-07-13). Full manual control for comps,
// corrections, and exercising the (course-gated) hardware patches before build courses
// exist: grant/revoke any patch, adjust XP (rank follows), and override the FL level.
//
// Every call is requireAdmin() and writes an AdminAudit row (who did what to whom).
//
// "use server" DISCIPLINE (see use-server-export-rule): this module exports ONLY async
// functions. Return shapes are declared INLINE (a named exported type would be a
// runtime export that crashes, uncaught by tsc). The client reads `res.ok`.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type Prisma as PrismaNS } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { academyDate, levelFor, LEVELS } from "@/lib/logbook/economy";

type Result = { ok: true } | { ok: false; error: string };
const bad = (error: string): Result => ({ ok: false, error });

function reval(userId: string) {
  revalidatePath(`/admin/students/${userId}`);
}

async function audit(
  actorId: string,
  action: string,
  targetUserId: string,
  detail: PrismaNS.InputJsonValue,
): Promise<void> {
  await db.adminAudit.create({ data: { actorId, action, targetUserId, detail } });
}

/** Grant a patch (any key, incl. the tiered hardware keys `hw:<name>:<1|2|3>`). */
export async function adminGrantPatch(input: {
  userId: string;
  badgeKey: string;
  note?: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const badgeKey = input.badgeKey.trim();
  if (!badgeKey) return bad("Badge key is required.");
  try {
    // Earned patches are permanent + idempotent (composite PK) — a re-grant is a no-op.
    await db.badgeEarned.upsert({
      where: { userId_badgeKey: { userId: input.userId, badgeKey } },
      create: {
        userId: input.userId,
        badgeKey,
        meta: { kind: "admin", grantedBy: admin.id, note: input.note ?? null },
      },
      update: {},
    });
    await audit(admin.id, "grant_patch", input.userId, { badgeKey, note: input.note ?? null });
    reval(input.userId);
    return { ok: true };
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Grant failed.");
  }
}

/** Revoke a patch. Idempotent — revoking one the learner never had is a no-op. */
export async function adminRevokePatch(input: {
  userId: string;
  badgeKey: string;
  note?: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const badgeKey = input.badgeKey.trim();
  if (!badgeKey) return bad("Badge key is required.");
  try {
    await db.badgeEarned.delete({
      where: { userId_badgeKey: { userId: input.userId, badgeKey } },
    });
  } catch (e) {
    // P2025 = the row was not there → already revoked, treat as success.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) {
      return bad(e instanceof Error ? e.message : "Revoke failed.");
    }
  }
  await audit(admin.id, "revoke_patch", input.userId, { badgeKey, note: input.note ?? null });
  reval(input.userId);
  return { ok: true };
}

/**
 * Adjust a learner's XP by a signed delta and recompute the FL level BOTH directions
 * (grant XP and the rank follows). The stored XpEvent uses the EFFECTIVE delta (after
 * flooring the total at 0) so the event ledger keeps summing to `xpTotal`.
 */
export async function adminAdjustXp(input: {
  userId: string;
  amount: number;
  note?: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const requested = Math.trunc(input.amount);
  if (!Number.isFinite(requested) || requested === 0) {
    return bad("Enter a nonzero whole-number amount.");
  }
  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { xpTotal: true },
      });
      const newTotal = Math.max(0, u.xpTotal + requested);
      const delta = newTotal - u.xpTotal; // effective (may be smaller than requested)
      await tx.xpEvent.create({
        data: {
          userId: input.userId,
          source: "MANUAL_ADJUST",
          amount: delta,
          refId: input.note ? input.note.slice(0, 200) : null,
          earnedOn: academyDate(now),
          dedupeKey: `MANUAL_ADJUST:${input.userId}:${randomUUID()}`,
        },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { xpTotal: newTotal, level: levelFor(newTotal).level },
      });
    });
    await audit(admin.id, "adjust_xp", input.userId, { amount: requested, note: input.note ?? null });
    reval(input.userId);
    return { ok: true };
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Adjust failed.");
  }
}

/**
 * Override the FL level directly (a hard set, independent of xpTotal). Use adminAdjustXp
 * for the honest path where the rank follows the XP; this is the operator escape hatch.
 */
export async function adminSetLevel(input: {
  userId: string;
  level: number;
  note?: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const level = Math.trunc(input.level);
  if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) {
    return bad(`Level must be between 1 and ${LEVELS.length}.`);
  }
  const prev = await db.user.findUnique({
    where: { id: input.userId },
    select: { level: true },
  });
  if (!prev) return bad("Learner not found.");
  await db.user.update({ where: { id: input.userId }, data: { level } });
  await audit(admin.id, "set_level", input.userId, {
    level,
    prevLevel: prev.level,
    note: input.note ?? null,
  });
  reval(input.userId);
  return { ok: true };
}
