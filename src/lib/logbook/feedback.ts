// The per-page feedback channel core (design §5/§9.4) — the "no forum" surface.
// A submit saves the row (always, if under the flood guard) and pays a small token
// once per page, capped per day. Admin marking a NEW row USEFUL pays the AUTHOR the
// bonus + the Shipped It patch, once. Body is stored raw and rendered as PLAIN TEXT
// everywhere (never HTML). Pure-ish core (takes userId/now); the "use server"
// wrappers in actions/feedback.ts add auth + admin gating.
import type { FeedbackStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { awardXp } from "@/lib/logbook/award";
import { earnBadge } from "@/lib/logbook/badge";
import {
  academyDate,
  dedupe,
  XP,
  FEEDBACK_DAILY_CAP,
  FEEDBACK_ROW_DAILY_LIMIT,
} from "@/lib/logbook/economy";

type LevelUp = { level: number; title: string } | null;

export type SubmitFeedbackResult =
  | { ok: false; error: string }
  | { ok: true; id: string; xp: number; levelUp: LevelUp };

export async function submitFeedback(
  input: { pageRef: string; body: string },
  userId: string,
  now: Date,
): Promise<SubmitFeedbackResult> {
  const day = academyDate(now);

  // Flood guard (hard): cap the number of feedback ROWS a user can create per day,
  // independent of whether they earn XP. Refuse the insert past the limit.
  const rowsToday = await db.lessonFeedback.count({
    where: { userId, createdAt: { gte: day } },
  });
  if (rowsToday >= FEEDBACK_ROW_DAILY_LIMIT) {
    return { ok: false, error: "daily limit" };
  }

  // The row saves regardless of the XP cap (design §9.4 — always route to admin).
  const row = await db.lessonFeedback.create({
    data: { userId, pageRef: input.pageRef, body: input.body },
  });

  // XP: once per page ever (dedupeKey has no day) AND only while today's paid
  // submits are under the daily cap. A capped or duplicate submit still thanks the
  // user; it just earns 0.
  let xp = 0;
  let levelUp: LevelUp = null;
  const paidToday = await db.xpEvent.count({
    where: { userId, source: "FEEDBACK_SUBMIT", earnedOn: day },
  });
  if (paidToday < FEEDBACK_DAILY_CAP) {
    const res = await awardXp({
      userId,
      source: "FEEDBACK_SUBMIT",
      amount: XP.FEEDBACK_SUBMIT,
      refId: input.pageRef,
      dedupeKey: dedupe.feedbackSubmit(userId, input.pageRef),
      now,
    });
    if (res.awarded) {
      xp = XP.FEEDBACK_SUBMIT;
      levelUp = res.levelUp;
    }
  }
  return { ok: true, id: row.id, xp, levelUp };
}

export type MarkFeedbackResult =
  | { ok: false; error: string }
  | { ok: true; paidUseful: boolean };

// Admin triage (wrapper enforces requireAdmin). Only a NEW row transitions; the
// first move to USEFUL pays the author FEEDBACK_USEFUL once (dedupe on feedbackId)
// + the Shipped It patch. Guarding on NEW makes a re-USEFUL a no-op, never a
// double-pay.
export async function markFeedback(
  input: { id: string; status: Extract<FeedbackStatus, "USEFUL" | "DISMISSED"> },
  now: Date,
): Promise<MarkFeedbackResult> {
  const fb = await db.lessonFeedback.findUnique({
    where: { id: input.id },
    select: { userId: true, status: true },
  });
  if (!fb) return { ok: false, error: "not found" };
  if (fb.status !== "NEW") return { ok: false, error: "already triaged" };

  await db.lessonFeedback.update({
    where: { id: input.id },
    data: { status: input.status },
  });

  if (input.status !== "USEFUL") return { ok: true, paidUseful: false };

  const res = await awardXp({
    userId: fb.userId,
    source: "FEEDBACK_USEFUL",
    amount: XP.FEEDBACK_USEFUL,
    refId: input.id,
    dedupeKey: dedupe.feedbackUseful(input.id),
    now,
  });
  await earnBadge(fb.userId, "skill:shipped-it");
  return { ok: true, paidUseful: res.awarded };
}
