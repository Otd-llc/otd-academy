// Durable retry for the payment-failed (dunning) email.
//
// The webhook's ProcessedStripeEvent claim commits BEFORE the send, so Stripe's
// redelivery no-ops and a failed send used to vanish into console.error — the
// customer with a failing card was never told (silent involuntary churn, lost
// recurring revenue). A failed send now parks a marker row in the existing
// LifecycleSend ledger (sequence "dunning-pending:<invoiceId>", unique per
// user+invoice) and the daily lifecycle cron drains it.
//
// The drain sends via the TRANSACTIONAL dunning sender directly — a billing
// notice is not consent-gated (same class as the magic link), so it must NOT
// go through sendLifecycleEmail's consent guard. Marker deleted on success,
// kept for the next tick on failure. PLAIN module (no "use server").
import type { PrismaClient } from "@prisma/client";
import { sendPaymentFailedEmail } from "@/lib/subscription-dunning";
import { capture } from "@/lib/analytics";

const PREFIX = "dunning-pending:";

/** Park a failed dunning send for the cron to retry. Idempotent per (user, invoice). */
export async function recordDunningPending(
  db: PrismaClient,
  userId: string,
  invoiceId: string,
): Promise<void> {
  try {
    await db.lifecycleSend.create({
      data: { userId, sequence: `${PREFIX}${invoiceId}` },
    });
  } catch {
    // P2002 = already parked for this invoice; anything else — the next
    // payment_failed redelivery won't re-park (claim no-ops), so log loudly.
    // Either way the caller (webhook) must not throw post-claim.
  }
}

/** Drain parked dunning emails. Called by the lifecycle cron each tick. */
export async function drainDunningPending(
  db: PrismaClient,
  resendFetch: typeof fetch = fetch,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const pending = await db.lifecycleSend.findMany({
    where: { sequence: { startsWith: PREFIX } },
    select: {
      userId: true,
      sequence: true,
      user: { select: { email: true } },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of pending) {
    if (!row.user?.email) {
      // No address to notify — drop the marker rather than retry forever.
      await db.lifecycleSend.delete({
        where: { userId_sequence: { userId: row.userId, sequence: row.sequence } },
      });
      skipped++;
      continue;
    }
    const ok = await sendPaymentFailedEmail({ toEmail: row.user.email }, resendFetch);
    if (ok) {
      await db.lifecycleSend.delete({
        where: { userId_sequence: { userId: row.userId, sequence: row.sequence } },
      });
      sent++;
    } else {
      capture("dunning_send_failed", { stage: "retry", sequence: row.sequence }, row.userId);
      failed++;
    }
  }
  return { sent, failed, skipped };
}
