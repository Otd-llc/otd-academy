// Send ONE subscription dunning email. Transactional (a billing-failure notice), so it is
// NOT emailConsent-gated — same class as the magic-link / field-guide senders. Fired by
// the Stripe webhook AFTER the event claim commits (post-commit, like capture() telemetry,
// so a network call never holds the txn connection open).
//
// It LOGS on failure and RETURNS (never throws): the webhook's ProcessedStripeEvent claim
// has already committed, so a thrown error would make Stripe retry the event, hit the
// claim's P2002, no-op, and never resend anyway. Throwing would only misreport the webhook
// as failing. (This is the OPPOSITE of lifecycle-send.ts, which throws because its ledger
// row is the only guard.) `resendFetch` is injectable so tests never touch the network.
import { env } from "@/env";
import { siteUrl } from "@/lib/seo/jsonld";
import { subscriptionPaymentFailedEmail } from "@/lib/subscription-dunning-email";

export async function sendPaymentFailedEmail(
  args: { toEmail: string },
  resendFetch: typeof fetch = fetch,
): Promise<void> {
  const base = siteUrl();
  const accountUrl = `${base}/account`;
  const host = new URL(base).host;
  const { subject, html, text } = subscriptionPaymentFailedEmail({ accountUrl, host });

  try {
    const res = await resendFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.AUTH_RESEND_FROM,
        to: args.toEmail,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* non-JSON body */
      }
      console.error(`[dunning] Resend error for ${args.toEmail}: ${detail}`);
    }
  } catch (e) {
    console.error(
      `[dunning] send failed for ${args.toEmail}:`,
      e instanceof Error ? e.message : e,
    );
  }
}
