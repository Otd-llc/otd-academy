// Resend send + once-only ledger write for one lifecycle email. POSTs to
// api.resend.com/emails exactly like the magic-link / sourcing-digest senders
// (env AUTH_RESEND_KEY / AUTH_RESEND_FROM), then records the LifecycleSend row so
// the sequence never fires twice for this user.
//
// The CONSENT guard lives here too (defense in depth): even though every audience
// selector filters `emailConsent: true`, a re-check immediately before the network
// call closes the race between selection and send. An opted-out user is skipped,
// never emailed.
import type { PrismaClient } from "@prisma/client";
import { env } from "@/env";
import type { LifecycleEmail } from "@/lib/lifecycle-emails";

export type SendOutcome = "sent" | "skipped-consent" | "already-sent";

// Send `email` to one recipient and record the LifecycleSend row. The unique
// (userId, sequence) index makes the ledger insert the idempotency point: if a
// concurrent run already inserted it, we treat it as already-sent and do NOT send
// again. We INSERT FIRST (claim), then send, so a crash after send-before-claim
// can at worst re-send once on the next tick rather than spam; here the claim
// guards the send. resendFetch is injectable so tests never touch the network.
export async function sendLifecycleEmail(
  db: PrismaClient,
  args: {
    userId: string;
    to: string;
    sequence: string;
    email: LifecycleEmail;
    /** Signed one-click opt-out URL, mirrored into the List-Unsubscribe header. */
    unsubscribeUrl: string;
  },
  resendFetch: typeof fetch = fetch,
): Promise<SendOutcome> {
  // Re-verify consent at send time (closes the select→send race).
  const user = await db.user.findUnique({
    where: { id: args.userId },
    select: { emailConsent: true },
  });
  if (!user || user.emailConsent !== true) return "skipped-consent";

  // Claim the (user, sequence) slot first. If it already exists, another run beat
  // us — do not send a duplicate.
  try {
    await db.lifecycleSend.create({
      data: { userId: args.userId, sequence: args.sequence },
    });
  } catch {
    // Unique violation (P2002) → already claimed/sent. Anything else also means we
    // could not safely claim, so skip rather than risk a double-send.
    return "already-sent";
  }

  const { subject, html, text } = args.email;
  const res = await resendFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Dedicated marketing sender, kept off the transactional login@ identity.
      from: env.LIFECYCLE_RESEND_FROM ?? env.AUTH_RESEND_FROM,
      to: args.to,
      subject,
      html,
      text,
      // RFC 8058 one-click unsubscribe: required by Gmail/Yahoo bulk-sender rules,
      // and it lets the mail client show a native Unsubscribe control.
      headers: {
        "List-Unsubscribe": `<${args.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) {
    // The claim row stays (we won't retry this user on the next tick); surface the
    // error so the cron logs it. Re-throw so a systemic Resend outage is visible.
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* non-JSON body */
    }
    throw new Error(`Resend (lifecycle ${args.sequence}) error: ${detail}`);
  }
  return "sent";
}
