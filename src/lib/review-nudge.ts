// Weekly review-due nudge (audit Phase 4 follow-up, built on #335's
// send-then-claim lifecycle machinery). The spaced-review deck had NO return
// trigger: due cards accumulated unseen behind a menu entry, so the retention
// loop never closed. Each lifecycle-cron tick this sends AT MOST one email per
// user per ISO week (ledger key `review-nudge:<year>-w<week>`), only to users
// with >= MIN_DUE due cards and marketing consent (sendLifecycleEmail re-checks
// consent and releases the claim on a failed send, so a Resend blip retries
// next tick instead of burning the week). PLAIN module.
import type { PrismaClient } from "@prisma/client";
import { siteUrl } from "@/lib/seo/jsonld";
import { env } from "@/env";
import { academyDate } from "@/lib/logbook/economy";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { sendLifecycleEmail } from "@/lib/lifecycle-send";
import { reviewNudgeEmail } from "@/lib/lifecycle-emails";
import { capture } from "@/lib/analytics";

// Below this many due cards the email is more noise than nudge.
const MIN_DUE = 3;
// Sanity cap per tick (the daily cron re-runs; a huge backlog spreads out).
const MAX_SENDS = 200;

/** ISO-8601 week stamp, e.g. "2026-w30" — the once-per-week ledger key. */
export function isoWeekStamp(now: Date): string {
  // ISO week: Thursday of the current week determines the week-year.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // shift to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

export async function sendReviewDueNudges(
  db: PrismaClient,
  now: Date,
  resendFetch: typeof fetch = fetch,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const today = academyDate(now);
  const sequence = `review-nudge:${isoWeekStamp(now)}`;

  // Users with >= MIN_DUE due, unsuspended items. groupBy + having keeps this
  // one query however many learners exist.
  const due = await db.reviewSchedule.groupBy({
    by: ["userId"],
    where: { dueOn: { lte: today }, suspended: false },
    _count: { _all: true },
    having: { userId: { _count: { gte: MIN_DUE } } },
  });
  if (due.length === 0) return { sent: 0, skipped: 0, failed: 0 };
  const countByUser = new Map(due.map((d) => [d.userId, d._count._all]));

  const users = await db.user.findMany({
    where: {
      id: { in: [...countByUser.keys()] },
      emailConsent: true,
      // Skip anyone already nudged this week WITHOUT burning a send slot.
      lifecycleSends: { none: { sequence } },
    },
    select: { id: true, email: true, name: true },
    take: MAX_SENDS,
  });

  const base = siteUrl();
  const host = base.replace(/^https?:\/\//, "");
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const u of users) {
    if (!u.email) {
      skipped++;
      continue;
    }
    const firstName = (u.name ?? "").trim().split(/\s+/)[0] || "there";
    const unsubscribeUrl = `${base}/email/unsubscribe/${signUnsubscribeToken(u.id)}`;
    const email = reviewNudgeEmail(
      {
        firstName,
        founderFirstName: "Josh",
        unsubscribeUrl,
        host,
        postalAddress: env.LIFECYCLE_POSTAL_ADDRESS,
        l101Url: `${base}/learn`,
      },
      { dueCount: countByUser.get(u.id) ?? MIN_DUE, reviewUrl: `${base}/review` },
    );
    try {
      const outcome = await sendLifecycleEmail(
        db,
        { userId: u.id, to: u.email, sequence, email, unsubscribeUrl },
        resendFetch,
      );
      if (outcome === "sent") sent++;
      else skipped++;
    } catch (e) {
      failed++;
      capture(
        "lifecycle_send_failed",
        { sequence, detail: e instanceof Error ? e.message : String(e) },
        u.id,
      );
    }
  }
  return { sent, skipped, failed };
}
