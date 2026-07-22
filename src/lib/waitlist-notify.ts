// Waitlist launch notification (audit Phase 3 / Task 3.4).
//
// The course pages promise "we'll email you the moment it goes live"
// (courses/[slug] waitlist form), but WaitlistSignup was a dead store: no send
// path ever read it, so the built demand list converted nobody at launch. This
// module fulfills the promise: when a waitlisted course has a published
// revision, each signup gets ONE email and its row is stamped notifiedAt.
//
// Consent basis: the signup itself — an explicit request for exactly this
// notification. It is a single fulfillment send, not a sequence, so there is
// no recurring-mail unsubscribe plumbing (many signups are anonymous and have
// no User row to key a token to); the footer says plainly that this is the
// one email and we will not mail them again.
//
// Claim-first + release-on-failure, same shape as lifecycle-send: the
// conditional notifiedAt stamp is the once-only ledger; a failed Resend call
// releases it so the next daily tick retries. PLAIN module.
import type { PrismaClient } from "@prisma/client";
import { env } from "@/env";
import { siteUrl } from "@/lib/seo/jsonld";
import { capture } from "@/lib/analytics";

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function courseLiveEmail(args: {
  courseName: string;
  courseUrl: string;
  host: string;
  postalAddress: string;
}): { subject: string; html: string; text: string } {
  const subject = `${args.courseName} is open`;
  const paragraphs = [
    `${args.courseName} just went live on OTD Academy.`,
    "You asked us to tell you the moment it opened. This is that email.",
  ];
  const footer =
    "You're receiving this one email because you joined the waitlist for this course. We won't email you again.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark only" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${esc(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP_SPACE};">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
            <tr>
              <td style="height:2px;line-height:2px;font-size:0;background-color:${COMMAND_GOLD};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 34px 36px;font-family:${SANS};">
                <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
                  OTD <span style="color:${COMMAND_GOLD};">Academy</span>
                </div>
                ${paragraphs
                  .map(
                    (p) =>
                      `<p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${esc(p)}</p>`,
                  )
                  .join("\n")}
                <div style="margin:28px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                    <tr>
                      <td bgcolor="${COMMAND_GOLD}" style="border-radius:6px;">
                        <a href="${esc(args.courseUrl)}" target="_blank"
                           style="display:inline-block;padding:12px 30px;font-family:${SANS};font-size:14px;font-weight:700;color:${DEEP_SPACE};text-decoration:none;border-radius:6px;">
                          Start the course &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
                <div style="height:1px;background-color:rgba(232,232,232,0.08);margin:28px 0 0;"></div>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.55;color:#6f7585;">${esc(footer)}</p>
              </td>
            </tr>
          </table>
          <div style="max-width:480px;margin:16px auto 0;font-family:${SANS};font-size:11px;line-height:1.7;color:#5a6070;text-align:center;">
            One Thousand Drones Academy &middot; ${esc(args.host)}<br />
            ${esc(args.postalAddress)}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    ...paragraphs,
    "",
    `Start the course: ${args.courseUrl}`,
    "",
    footer,
    `One Thousand Drones Academy · ${args.host}`,
    args.postalAddress,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Send the promised launch email to every un-notified signup whose course now
 * has a published revision. Called by the lifecycle cron each tick. Returns
 * counts for the cron's JSON summary.
 */
export async function notifyWaitlist(
  db: PrismaClient,
  resendFetch: typeof fetch = fetch,
): Promise<{ sent: number; failed: number }> {
  const base = siteUrl();
  const host = base.replace(/^https?:\/\//, "");
  const postalAddress = env.LIFECYCLE_POSTAL_ADDRESS;

  const due = await db.waitlistSignup.findMany({
    where: {
      notifiedAt: null,
      project: { publishedRevisionId: { not: null }, archivedAt: null },
    },
    select: {
      id: true,
      email: true,
      project: { select: { name: true, slug: true } },
    },
  });

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    // Claim (once-only): only the run that flips null → now owns the send.
    const claimed = await db.waitlistSignup.updateMany({
      where: { id: row.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claimed.count === 0) continue; // another run beat us

    const email = courseLiveEmail({
      courseName: row.project.name,
      courseUrl: `${base}/learn/${row.project.slug}`,
      host,
      postalAddress,
    });
    let ok = false;
    try {
      const res = await resendFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.LIFECYCLE_RESEND_FROM ?? env.AUTH_RESEND_FROM,
          to: row.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    if (ok) {
      sent++;
    } else {
      // Release the claim so the next tick retries; surface in telemetry.
      await db.waitlistSignup.updateMany({
        where: { id: row.id },
        data: { notifiedAt: null },
      });
      capture("waitlist_notify_failed", { projectSlug: row.project.slug });
      failed++;
    }
  }
  return { sent, failed };
}
