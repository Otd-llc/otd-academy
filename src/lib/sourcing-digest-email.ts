import type { PrismaClient } from "@prisma/client";
import { env } from "@/env";
import { availabilityBadge } from "@/lib/part-availability";
import {
  digikeySubstitutesUrl,
  type BoardSourcingIssue,
} from "@/lib/active-bom-sourcing";

// The "a BOM part needs a substitute" digest. Pure builder (unit-testable) + a sender
// that POSTs to Resend exactly like the magic-link path. Branded but quiet: a wordmark,
// the boards grouped, each line with its status + an [open part] and [DigiKey] link to
// act on, and one button to the /admin/sourcing workspace.

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sourcingDigestEmail({
  issues,
  baseUrl,
}: {
  issues: BoardSourcingIssue[];
  baseUrl: string;
}): { subject: string; html: string; text: string } {
  const lineCount = issues.reduce((n, b) => n + b.lines.length, 0);
  const boardWord = issues.length === 1 ? "board" : "boards";
  const partWord = lineCount === 1 ? "part" : "parts";
  const subject = `${lineCount} BOM ${partWord} need a substitute (${issues.length} ${boardWord})`;
  const base = baseUrl.replace(/\/$/, "");

  const boardsHtml = issues
    .map((b) => {
      const rows = b.lines
        .map((l) => {
          const badge = availabilityBadge(l.status).label.toUpperCase();
          const partHref = `${base}/parts/${l.partId}`;
          const dkHref = digikeySubstitutesUrl(l);
          return `
          <tr>
            <td style="padding:6px 10px 6px 0;font-family:${MONO};font-size:13px;color:${GRAY_1};white-space:nowrap;">${esc(l.refDes)}</td>
            <td style="padding:6px 10px 6px 0;font-family:${MONO};font-size:12px;color:#c5cad6;">${esc(l.mpn)}<br><span style="color:#828896;">${esc(l.manufacturer)}</span></td>
            <td style="padding:6px 10px 6px 0;font-family:${SANS};font-size:11px;font-weight:700;color:#ef5350;white-space:nowrap;">${esc(badge)}</td>
            <td style="padding:6px 0;font-family:${SANS};font-size:12px;white-space:nowrap;">
              <a href="${esc(partHref)}" style="color:${COMMAND_GOLD};text-decoration:none;">open part</a>
              <span style="color:#4a4f5c;">&nbsp;&middot;&nbsp;</span>
              <a href="${esc(dkHref)}" style="color:#4a8fff;text-decoration:none;">substitutes &#8599;</a>
            </td>
          </tr>`;
        })
        .join("");
      return `
        <div style="margin:22px 0 0;">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${COMMAND_GOLD};">
            ${esc(b.projectName)} <span style="color:#6f7585;">&middot; rev ${esc(b.revisionLabel)}</span>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;">${rows}</table>
        </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="dark only" /><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP_SPACE};"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
      <tr><td style="height:2px;line-height:2px;font-size:0;background-color:${COMMAND_GOLD};">&nbsp;</td></tr>
      <tr><td style="padding:30px 34px 34px;font-family:${SANS};">
        <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">OTD <span style="color:${COMMAND_GOLD};">Academy</span> <span style="font-weight:400;font-size:13px;color:#828896;">&middot; Sourcing</span></div>
        <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">
          <strong style="color:${GRAY_1};">${lineCount} BOM ${partWord}</strong> across <strong style="color:${GRAY_1};">${issues.length} ${boardWord}</strong> can't be ordered right now and need a substitute.
        </p>
        ${boardsHtml}
        <div style="margin:28px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${COMMAND_GOLD}" style="border-radius:6px;">
            <a href="${esc(base + "/admin/sourcing")}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:14px;font-weight:700;color:${DEEP_SPACE};text-decoration:none;border-radius:6px;">Open sourcing dashboard &#8594;</a>
          </td></tr></table>
        </div>
        <p style="margin:24px 0 0;font-size:11px;line-height:1.55;color:#6f7585;">Pick an in-stock equivalent (match footprint + voltage + dielectric), swap the part, then Re-check the line. Sent only when a part newly goes unorderable.</p>
      </td></tr>
    </table>
    <div style="max-width:560px;margin:16px auto 0;font-family:${SANS};font-size:11px;color:#5a6070;text-align:center;">OTD Academy &middot; ${esc(base.replace(/^https?:\/\//, ""))}</div>
  </td></tr></table>
</body></html>`;

  const textLines = [subject, ""];
  for (const b of issues) {
    textLines.push(`${b.projectName} (rev ${b.revisionLabel})`);
    for (const l of b.lines) {
      textLines.push(
        `  ${l.refDes}  ${l.mpn} / ${l.manufacturer}  — ${availabilityBadge(l.status).label.toUpperCase()}`,
      );
      textLines.push(`     part: ${base}/parts/${l.partId}`);
      textLines.push(`     substitutes: ${digikeySubstitutesUrl(l)}`);
    }
    textLines.push("");
  }
  textLines.push(`Dashboard: ${base}/admin/sourcing`);

  return { subject, html, text: textLines.join("\n") };
}

async function adminEmails(db: PrismaClient): Promise<string[]> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter((e): e is string => !!e);
}

// Send the digest to every admin. No-op (returns false) when nothing to send or Resend
// isn't keyed; throws on a Resend API error so the cron can log it.
export async function sendSourcingDigest(
  db: PrismaClient,
  issues: BoardSourcingIssue[],
  baseUrl: string,
): Promise<boolean> {
  if (issues.length === 0) return false;
  const to = await adminEmails(db);
  if (to.length === 0) return false;
  const { subject, html, text } = sourcingDigestEmail({ issues, baseUrl });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.AUTH_RESEND_FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    throw new Error("Resend (sourcing digest) error: " + JSON.stringify(await res.json()));
  }
  return true;
}
