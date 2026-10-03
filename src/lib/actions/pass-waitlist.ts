"use server";

// All-Access Pass waitlist capture. The Pass isn't on sale yet (no provisioned
// Stripe price), so a waitlist is the only action. No auth required: anyone can
// leave an email. When a signed-in learner joins, we stamp their userId. The
// upsert on the unique email makes a repeat submit a no-op (no throw, no dup).
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { capture } from "@/lib/analytics";
import { clientIp, ipCheckFor } from "@/lib/abuse-policy";
import { enforce } from "@/lib/abuse-limit";
import {
  doubleOptInEnabled,
  sendWaitlistConfirmation,
} from "@/lib/waitlist-confirm";
import { defenseEnabled } from "@/lib/abuse-defense-flag";

const joinPassWaitlistSchema = z.object({ email: z.email() });

export async function joinPassWaitlist(input: unknown): Promise<{ ok: true }> {
  // Lowercased at the boundary. The row is keyed on the address, and the
  // database now refuses a second row that differs only in case
  // (20261001120000_email_hygiene), so every comparison below is exact.
  const email = joinPassWaitlistSchema.parse(input).email.toLowerCase();

  // Same fail-open per-IP guard as joinWaitlist (shared bucket — same abuse
  // class): this was the one anonymous public write with no rate limit, an
  // arbitrary-email insert + telemetry-pollution loop.
  if (await defenseEnabled()) {
    const check = ipCheckFor("waitlist:ip:hour", clientIp(await headers()));
    if (check && !(await enforce([check], "open")).ok) {
      throw new Error("Too many requests. Please try again in a little while.");
    }
  }

  // Stamp the signed-in user's id ONLY when the submitted address is their own
  // (best-effort; anon is fine). The email is still the unique key. Stamping
  // any row for any typed address let a signed-in visitor claim a stranger's
  // row; found by plan validation (2026-09-30). Case-insensitive on both sides.
  let userId: string | null = null;
  const session = await auth();
  const sessionEmailRaw = session?.user?.email ?? null;
  if (
    sessionEmailRaw &&
    sessionEmailRaw.toLowerCase() === email.toLowerCase()
  ) {
    const user = await db.user.findUnique({
      where: { email: sessionEmailRaw },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const prior = await db.passWaitlist.findUnique({
    where: { email },
    select: { id: true },
  });

  await db.passWaitlist.upsert({
    where: { email },
    // NEVER OVERWRITE a userId already on the row.
    update: {},
    // Double opt-in (plan P.5): a new row starts unconfirmed and gets one
    // confirmation mail below. With the switch off it confirms at creation.
    create: {
      email,
      userId,
      confirmedAt: doubleOptInEnabled() ? null : new Date(),
    },
  });
  if (userId) {
    await db.passWaitlist.updateMany({
      where: { email, userId: null },
      data: { userId },
    });
  }

  // The confirmation, inline. A send failure leaves the row unconfirmed with
  // its ledger released, so the next submit retries; the visitor's submit has
  // already succeeded and is not failed for it.
  try {
    await sendWaitlistConfirmation(
      db,
      { table: "PassWaitlist", email },
      {
        list: "the All-Access Pass waitlist",
        promise: "when the pass goes on sale",
      },
    );
  } catch {
    // logged inside; nothing more to do here
  }

  // Funnel: `email_captured` — fire once on a new signup; best-effort; a no-op
  // when PostHog is unconfigured.
  if (!prior) {
    try {
      // No raw email in props — PII stays out of analytics (the DB row holds it).
      capture(
        "email_captured",
        { source: "pass_waitlist" },
        userId ?? undefined,
      );
    } catch {
      // best-effort
    }
  }

  return { ok: true };
}
