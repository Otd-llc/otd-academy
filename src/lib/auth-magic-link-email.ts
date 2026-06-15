// Branded magic-link email for the Auth.js Resend provider, in place of the
// bland built-in template. Pure function → unit-testable; auth.ts's
// sendVerificationRequest builds this and POSTs it to Resend.
//
// Design intent: a QUIET utility note that happens to be on-brand — the bar is
// Stripe/Linear/GitHub magic links, not a product launch. Restraint is the whole
// point: a small wordmark (not a hero), ONE sentence, ONE modest action, expiry
// stated once, left-aligned. Over-decoration reads as marketing → spam, so less
// ornament both looks premium AND scores better with spam filters.
//
// Email constraints: a typographic wordmark (Gmail strips inline SVG), table
// layout + INLINE styles (classes/<style> aren't reliable and a <style>/@import
// block is a minor spam penalty Gmail ignores anyway — so we use plain system
// fonts), a bulletproof <table> button, no hidden preheader (that triple-hidden
// pattern got it filed as spam in testing), and a real text/plain alternative.
// Colors are the academy tokens from globals.css.

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

/** Escape the five HTML-significant characters for safe embedding in markup/attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function magicLinkEmail({ url, host }: { url: string; host: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const safeUrl = esc(url);
  const subject = "Sign in to OTD Academy";

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
            <!-- thin gold hairline: the single brand accent -->
            <tr>
              <td style="height:2px;line-height:2px;font-size:0;background-color:${COMMAND_GOLD};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 34px 36px;font-family:${SANS};">
                <!-- small wordmark, not a hero -->
                <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
                  OTD <span style="color:${COMMAND_GOLD};">Academy</span>
                </div>

                <p style="margin:26px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">
                  Click below to sign in to OTD Academy. This link works once and
                  expires in 24&nbsp;hours.
                </p>

                <!-- one modest action; block-level (no float) so content stacks below -->
                <div style="margin:24px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                    <tr>
                      <td bgcolor="${COMMAND_GOLD}" style="border-radius:6px;">
                        <a href="${safeUrl}" target="_blank"
                           style="display:inline-block;padding:12px 30px;font-family:${SANS};font-size:14px;font-weight:700;color:${DEEP_SPACE};text-decoration:none;border-radius:6px;">
                          Sign in &#8594;
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
    "Sign in to OTD Academy",
    "",
    "Click below to sign in. This link works once and expires in 24 hours:",
    "",
    url,
    "",
    "Didn't request this? You can safely ignore this email.",
    "",
    "OTD Academy — " + host,
  ].join("\n");

  return { subject, html, text };
}
