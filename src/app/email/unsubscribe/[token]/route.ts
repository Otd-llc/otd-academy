// One-click lifecycle-email unsubscribe. The signed token in the path IS the gate
// (verified here — no session needed; an opted-out user has no reason to be logged
// in), so this route is reachable signed-out (proxy.ts isPublicPath allows
// /email/unsubscribe/*). A GET flips emailConsent → false and stamps
// emailConsentUpdatedAt, then renders a tiny confirmation page. Idempotent: a
// second click just re-confirms.
//
// CAN-SPAM allows opt-out via a single click with no further action, which is what
// this does. Transactional mail (magic-link sign-in) is unaffected — only
// lifecycle sends are gated by emailConsent.
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function page({ ok, message }: { ok: boolean; message: string }): Response {
  const heading = ok ? "You're unsubscribed" : "Link not valid";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${heading} · OTD Academy</title>
  </head>
  <body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
    <div style="max-width:480px;margin:0 auto;padding:64px 20px;font-family:${SANS};">
      <div style="background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
        <div style="height:2px;background-color:${COMMAND_GOLD};"></div>
        <div style="padding:34px;">
          <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
            OTD <span style="color:${COMMAND_GOLD};">Academy</span>
          </div>
          <h1 style="margin:24px 0 0;font-size:20px;color:${GRAY_1};">${heading}</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${message}</p>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#828896;">
            This only affects lifecycle and product emails. You'll still receive sign-in
            links and other account messages.
          </p>
          <p style="margin:18px 0 0;font-size:14px;">
            <a href="https://academy.onethousanddrones.com" style="color:${COMMAND_GOLD};text-decoration:none;">Back to OTD Academy &#8594;</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Flip emailConsent → false for the token's user. Shared by GET (a human clicks
// the footer link) and POST (RFC 8058 one-click, fired by the mail client from the
// List-Unsubscribe-Post header). updateMany so a token for a deleted user is a
// clean no-op (count 0) rather than a thrown "record not found".
async function unsubscribe(token: string): Promise<{ ok: boolean; message: string }> {
  const claims = verifyUnsubscribeToken(token);
  if (!claims) {
    return {
      ok: false,
      message:
        "This unsubscribe link is invalid or has been tampered with. If you keep getting emails you don't want, reply to one and we'll remove you.",
    };
  }
  const result = await db.user.updateMany({
    where: { id: claims.userId },
    data: { emailConsent: false, emailConsentUpdatedAt: new Date() },
  });
  if (result.count === 0) {
    return {
      ok: false,
      message:
        "We couldn't find this account. It may have already been removed. If you keep getting emails you don't want, reply to one and we'll remove you.",
    };
  }
  return {
    ok: true,
    message: "You won't receive any more lifecycle or product emails from OTD Academy.",
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  return page(await unsubscribe(token));
}

// One-click (RFC 8058): the mail client POSTs here from List-Unsubscribe-Post. It
// does not render a page, so a 2xx with a tiny body is all it needs.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const { ok } = await unsubscribe(token);
  return new Response(ok ? "Unsubscribed" : "Invalid unsubscribe link", {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
