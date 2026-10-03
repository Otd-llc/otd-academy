// Double opt-in for the anonymous email captures (plan P.5, owner R2-4 / R3-7).
//
// Three lists take an address with no account: the per-course waitlist
// (WaitlistSignup), the All-Access Pass waitlist (PassWaitlist) and the Hex
// Cluster release notice (HexReleaseNotify). Anyone can type anyone's address
// into those forms, so a new row is UNCONFIRMED until the person submits the
// page behind the confirmation link. Until then: one confirmation mail and
// nothing else, deleted after 7 days by the lifecycle sweep, excluded from
// every send and from any union across the lists.
//
// What lives here, and why in one module:
//   confirmationEmail       the template, one shape for all three lists.
//   sendWaitlistConfirmation  the INLINE send the actions call after their
//                           upsert, behind the `waitlist:email:day` rule and
//                           the confirmSentAt ledger (a repeat submit within a
//                           day re-sends nothing). The row stays unconfirmed
//                           if Resend fails; the ledger is released so the
//                           next submit may try again.
//   confirmWaitlistRow / removeWaitlistRow   what the routes do on POST.
//   sweepWaitlists          the cron arm: unconfirmed > 7 d and notified
//                           > 12 months are deleted. Runs BEFORE the lifecycle
//                           kill switch so pausing marketing never pauses the
//                           retention promise.
//   doubleOptInEnabled      the feature-off switch (WAITLIST_DOUBLE_OPT_IN).
//                           Off: new rows confirm at creation, no mail, the
//                           pre-P.5 behaviour. Read live from process.env so a
//                           test can flip it without rebuilding `env`.
//
// PLAIN module (no "use server"): the actions import it, the cron imports it,
// and the tests call it with an injected fetch.
import type { PrismaClient } from "@prisma/client";

import { env } from "@/env";
import { enforce } from "@/lib/abuse-limit";
import { waitlistEmailCheck } from "@/lib/abuse-policy";
import { siteUrl } from "@/lib/seo/jsonld";
import {
  signWaitlistToken,
  type WaitlistClaims,
  type WaitlistTable,
} from "@/lib/waitlist-token";

export const UNCONFIRMED_TTL_DAYS = 7;
export const NOTIFIED_RETENTION_MONTHS = 12;
/** A repeat submit inside this window re-sends nothing; the first mail stands. */
export const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function doubleOptInEnabled(): boolean {
  const raw = process.env.WAITLIST_DOUBLE_OPT_IN;
  if (raw === undefined || raw === "") return true;
  return !/^(0|false|off|no)$/i.test(raw.trim());
}

export type WaitlistRowKey = {
  table: WaitlistTable;
  /** Lowercased. */
  email: string;
  /** WaitlistSignup only. */
  projectId?: string;
};

/** The thing the person is confirming, in words, for the subject and the body. */
export type WaitlistAbout = {
  /** e.g. "the Hex Cluster release notice", "the All-Access Pass waitlist",
   *  "the waitlist for ESP32 Breakout". Lowercase start; it follows "for". */
  list: string;
  /** e.g. "when the next release lands", "when the pass goes on sale",
   *  "the moment the course opens". Follows "we'll email you". */
  promise: string;
};

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
    .replace(/"/g, "&quot;");
}

export function confirmationEmail(args: {
  about: WaitlistAbout;
  confirmUrl: string;
  removeUrl: string;
  host: string;
  postalAddress: string;
}): { subject: string; html: string; text: string } {
  const subject = `Confirm: ${args.about.list}`;
  const paragraphs = [
    `Someone, we hope you, asked us to add this address to ${args.about.list} on OTD Academy.`,
    `Confirm it and we'll email you ${args.about.promise}. Do nothing and this address is deleted from the list in ${UNCONFIRMED_TTL_DAYS} days.`,
  ];
  const footer =
    "If this wasn't you, you can ignore this message. Confirming means exactly one more email from this list, when there is something to say.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${esc(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP_SPACE};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <div style="max-width:520px;margin:0 auto;font-family:${SANS};text-align:left;">
            <div style="background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
              <div style="height:2px;background-color:${COMMAND_GOLD};"></div>
              <div style="padding:34px;">
                <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
                  OTD <span style="color:${COMMAND_GOLD};">Academy</span>
                </div>
                ${paragraphs
                  .map(
                    (p) =>
                      `<p style="margin:22px 0 0;font-size:15px;line-height:1.65;color:#c5cad6;">${esc(p)}</p>`,
                  )
                  .join("\n                ")}
                <p style="margin:28px 0 0;">
                  <a href="${esc(args.confirmUrl)}" style="display:inline-block;padding:12px 22px;background-color:${COMMAND_GOLD};color:${DEEP_SPACE};font-weight:700;text-decoration:none;border-radius:6px;">Confirm this address</a>
                </p>
                <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#828896;">${esc(footer)}</p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#828896;">
                  Not you, or changed your mind? <a href="${esc(args.removeUrl)}" style="color:${COMMAND_GOLD};">Remove this address</a>.
                </p>
              </div>
            </div>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#6b7080;text-align:center;">
              One Thousand Drones Academy · ${esc(args.host)}<br />${esc(args.postalAddress)}
            </p>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    ...paragraphs,
    "",
    `Confirm this address: ${args.confirmUrl}`,
    "",
    footer,
    `Remove this address: ${args.removeUrl}`,
    "",
    `One Thousand Drones Academy · ${args.host}`,
    args.postalAddress,
  ].join("\n");

  return { subject, html, text };
}

export function waitlistLinks(key: WaitlistRowKey, now: Date = new Date()) {
  const base = siteUrl();
  const claims = {
    table: key.table,
    email: key.email,
    projectId: key.projectId,
  };
  return {
    confirmUrl: `${base}/email/confirm/${signWaitlistToken({ ...claims, kind: "confirm" }, now)}`,
    removeUrl: `${base}/email/remove/${signWaitlistToken({ ...claims, kind: "remove" }, now)}`,
    host: base.replace(/^https?:\/\//, ""),
  };
}

type Delegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select: { confirmedAt: true; confirmSentAt: true };
  }) => Promise<{
    confirmedAt: Date | null;
    confirmSentAt: Date | null;
  } | null>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  deleteMany: (args: {
    where: Record<string, unknown>;
  }) => Promise<{ count: number }>;
};

function delegate(db: PrismaClient, table: WaitlistTable): Delegate {
  switch (table) {
    case "WaitlistSignup":
      return db.waitlistSignup as unknown as Delegate;
    case "PassWaitlist":
      return db.passWaitlist as unknown as Delegate;
    case "HexReleaseNotify":
      return db.hexReleaseNotify as unknown as Delegate;
    case "HexPartWaitlist":
      return db.hexPartWaitlist as unknown as Delegate;
  }
}

function whereKey(key: WaitlistRowKey): Record<string, unknown> {
  return key.table === "WaitlistSignup"
    ? { email: key.email, projectId: key.projectId }
    : { email: key.email };
}

export type ConfirmationSendOutcome =
  | "sent"
  | "already-confirmed"
  | "cooldown"
  | "rate-limited"
  | "no-row"
  | "disabled";

/**
 * Send the confirmation for one freshly upserted row. Called inline by the
 * action, after its own IP rule and upsert. Never throws for a mail failure:
 * the submit already succeeded from the visitor's side and the row is in
 * place; a failure releases the ledger so the next submit retries.
 */
export async function sendWaitlistConfirmation(
  db: PrismaClient,
  key: WaitlistRowKey,
  about: WaitlistAbout,
  resendFetch: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<ConfirmationSendOutcome> {
  if (!doubleOptInEnabled()) return "disabled";
  const d = delegate(db, key.table);
  const row = await d.findFirst({
    where: whereKey(key),
    select: { confirmedAt: true, confirmSentAt: true },
  });
  if (!row) return "no-row";
  if (row.confirmedAt) return "already-confirmed";
  if (
    row.confirmSentAt &&
    now.getTime() - row.confirmSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return "cooldown";
  }
  // Per-ADDRESS rule, in front of the ledger: the ledger protects one row, the
  // rule protects a stranger's inbox from being hit through three different
  // forms, or through the cooldown edge, by someone typing their address.
  const verdict = await enforce([waitlistEmailCheck(key.email)], "open");
  if (!verdict.ok) return "rate-limited";

  // Claim the ledger first so two concurrent submits send once.
  const claimed = await d.updateMany({
    where: {
      ...whereKey(key),
      confirmedAt: null,
      confirmSentAt: row.confirmSentAt,
    },
    data: { confirmSentAt: now },
  });
  if (claimed.count === 0) return "cooldown";

  const links = waitlistLinks(key, now);
  const mail = confirmationEmail({
    about,
    confirmUrl: links.confirmUrl,
    removeUrl: links.removeUrl,
    host: links.host,
    postalAddress: env.LIFECYCLE_POSTAL_ADDRESS,
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
        to: key.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: {
          "List-Unsubscribe": `<${links.removeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    ok = res.ok;
    if (!ok) {
      console.error(`[waitlist-confirm] Resend ${res.status} for ${key.table}`);
    }
  } catch (err) {
    console.error("[waitlist-confirm] Resend call failed", err);
  }
  if (!ok) {
    // Release the ledger: the next submit may try again.
    await d.updateMany({
      where: { ...whereKey(key), confirmSentAt: now },
      data: { confirmSentAt: row.confirmSentAt },
    });
    throw new Error("confirmation send failed");
  }
  return "sent";
}

/** The confirm route's POST. Idempotent: a second submit re-confirms nothing and still succeeds. */
export async function confirmWaitlistRow(
  db: PrismaClient,
  claims: WaitlistClaims,
  now: Date = new Date(),
): Promise<"confirmed" | "already" | "gone"> {
  const key = {
    table: claims.table,
    email: claims.email,
    projectId: claims.projectId,
  };
  const d = delegate(db, claims.table);
  const row = await d.findFirst({
    where: whereKey(key),
    select: { confirmedAt: true, confirmSentAt: true },
  });
  if (!row) return "gone";
  if (row.confirmedAt) return "already";
  await d.updateMany({
    where: { ...whereKey(key), confirmedAt: null },
    data: { confirmedAt: now },
  });
  return "confirmed";
}

/** The remove route's POST (form or RFC 8058 one-click). Deletes the row outright. */
export async function removeWaitlistRow(
  db: PrismaClient,
  claims: WaitlistClaims,
): Promise<"removed" | "gone"> {
  const key = {
    table: claims.table,
    email: claims.email,
    projectId: claims.projectId,
  };
  const res = await delegate(db, claims.table).deleteMany({
    where: whereKey(key),
  });
  return res.count > 0 ? "removed" : "gone";
}

/**
 * The retention arm of the lifecycle cron. Two promises, both from /privacy
 * section 5: an unconfirmed address is deleted after 7 days; a confirmed
 * address is deleted 12 months after the one email it was confirmed for.
 */
export async function sweepWaitlists(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<{ unconfirmed: number; expired: number }> {
  const staleBefore = new Date(
    now.getTime() - UNCONFIRMED_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const retainedBefore = new Date(now);
  retainedBefore.setMonth(
    retainedBefore.getMonth() - NOTIFIED_RETENTION_MONTHS,
  );

  let unconfirmed = 0;
  let expired = 0;
  for (const table of [
    "WaitlistSignup",
    "PassWaitlist",
    "HexReleaseNotify",
    "HexPartWaitlist",
  ] as const) {
    const d = delegate(db, table);
    unconfirmed += (
      await d.deleteMany({
        where: { confirmedAt: null, createdAt: { lt: staleBefore } },
      })
    ).count;
    if (table !== "PassWaitlist") {
      // PassWaitlist has no digest yet (the pass is not on sale), so nothing
      // starts its 12-month clock. The other two carry notifiedAt.
      expired += (
        await d.deleteMany({
          where: {
            confirmedAt: { not: null },
            notifiedAt: { not: null, lt: retainedBefore },
          },
        })
      ).count;
    }
  }
  return { unconfirmed, expired };
}
