// Branded email that delivers a gated Library field-guide download link. Pure
// function -> unit-testable. This is a TRANSACTIONAL message (the user asked for
// the guide), so it is NOT gated by emailConsent, same as the magic-link email.
//
// NOTE: nothing calls this today. It used to be built and POSTed to Resend by a
// `requestFieldGuide` server action, but that action had no callers of its own
// and was removed as dead code; this builder is kept because it is the finished,
// tested article and the delivery path is expected to return. If it is still
// unused next time someone reads this, delete it too.
//
// Same email constraints + quiet-on-brand bar as auth-magic-link-email.ts: table
// layout, inline styles, system fonts, a bulletproof button, a real text/plain
// alternative. Academy tokens from globals.css.

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The lead-magnet magic link: ONE email that both signs the reader in / creates
// their free account AND opens the guide (its `url` is the Auth.js magic link,
// which after verification redirects straight to the gated PDF). Copy makes the
// dual purpose clear; single-use + 24h like any magic link. Distinct from
// `fieldGuideEmail` below, which re-sends a durable link to an already-signed-in
// reader.
export function fieldGuideMagicLinkEmail({
  url,
  guideLabel,
  host,
}: {
  url: string;
  guideLabel: string;
  host: string;
}): { subject: string; html: string; text: string } {
  const safeUrl = esc(url);
  const safeLabel = esc(guideLabel);
  const subject = `Your download: ${guideLabel}`;
  const lead =
    `Click below to open <strong style="color:${GRAY_1};">${safeLabel}</strong>. ` +
    `The same click sets up your free OTD Academy account. This link works once and expires in 24&nbsp;hours.`;
  const textLead = `Click below to open ${guideLabel}. The same click sets up your free OTD Academy account. This link works once and expires in 24 hours:`;
  return buildFieldGuideEmail({ safeUrl, url, subject, lead, textLead, host, cta: "Open the field guide" });
}

export function fieldGuideEmail({
  url,
  guideLabel,
  host,
}: {
  url: string;
  guideLabel: string;
  host: string;
}): { subject: string; html: string; text: string } {
  const safeUrl = esc(url);
  const safeLabel = esc(guideLabel);
  const subject = `Your download: ${guideLabel}`;
  const lead =
    `Here is your download for <strong style="color:${GRAY_1};">${safeLabel}</strong>. ` +
    `The link is tied to your account and expires in 7&nbsp;days.`;
  const textLead = `Here is your download for ${guideLabel}. The link is tied to your account and expires in 7 days:`;
  return buildFieldGuideEmail({ safeUrl, url, subject, lead, textLead, host, cta: "Download the PDF" });
}

function buildFieldGuideEmail({
  safeUrl,
  url,
  subject,
  lead,
  textLead,
  host,
  cta,
}: {
  safeUrl: string;
  url: string;
  subject: string;
  lead: string;
  textLead: string;
  host: string;
  cta: string;
}): { subject: string; html: string; text: string } {

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
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
            <tr>
              <td style="height:2px;line-height:2px;font-size:0;background-color:${COMMAND_GOLD};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 34px 36px;font-family:${SANS};">
                <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
                  OTD <span style="color:${COMMAND_GOLD};">Academy</span>
                </div>

                <p style="margin:26px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">
                  ${lead}
                </p>

                <div style="margin:24px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                    <tr>
                      <td bgcolor="${COMMAND_GOLD}" style="border-radius:6px;">
                        <a href="${safeUrl}" target="_blank"
                           style="display:inline-block;padding:12px 30px;font-family:${SANS};font-size:14px;font-weight:700;color:${DEEP_SPACE};text-decoration:none;border-radius:6px;">
                          ${cta} &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>

                <p style="margin:30px 0 0;font-size:12px;line-height:1.5;color:#828896;">
                  Or paste this link into your browser:
                </p>
                <p style="margin:6px 0 0;font-size:12px;line-height:1.6;">
                  <a href="${safeUrl}" target="_blank" style="font-family:${MONO};color:#9aa0ae;text-decoration:none;word-break:break-all;">${safeUrl}</a>
                </p>

                <div style="height:1px;background-color:rgba(232,232,232,0.08);margin:28px 0 0;"></div>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.55;color:#6f7585;">
                  Didn't request this? You can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>

          <div style="max-width:460px;margin:16px auto 0;font-family:${SANS};font-size:11px;color:#5a6070;text-align:center;">
            OTD Academy &middot; ${esc(host)}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    subject,
    "",
    textLead,
    "",
    url,
    "",
    "Didn't request this? You can safely ignore this email.",
    "",
    "OTD Academy — " + host,
  ].join("\n");

  return { subject, html, text };
}
