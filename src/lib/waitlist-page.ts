// The tiny pages behind the confirm and remove links. Shared by the two routes.
//
// SHOW ON GET, ACT ON POST. Mail scanners, link previewers and corporate
// gateways fetch every URL in a message before the person sees it. A GET that
// confirmed would subscribe addresses whose owners never clicked anything, and
// a GET that removed would unsubscribe people the moment their mail was
// scanned. So a GET renders one button and the button POSTs. The remove route
// additionally accepts RFC 8058 one-click POSTs from the mail client's own
// Unsubscribe control.
//
// `Referrer-Policy: no-referrer` because the token is in the URL and must not
// leak into a third party's logs from the "Back to OTD Academy" link;
// `Cache-Control: no-store` because the page is about one address.
import { env } from "@/env";

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
} as const;

export const PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
} as const;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(heading: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="referrer" content="no-referrer" />
    <title>${esc(heading)} · OTD Academy</title>
  </head>
  <body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
    <div style="max-width:480px;margin:0 auto;padding:64px 20px;font-family:${SANS};">
      <div style="background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
        <div style="height:2px;background-color:${COMMAND_GOLD};"></div>
        <div style="padding:34px;">
          <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
            OTD <span style="color:${COMMAND_GOLD};">Academy</span>
          </div>
          <h1 style="margin:24px 0 0;font-size:20px;color:${GRAY_1};">${esc(heading)}</h1>
          ${inner}
          <p style="margin:28px 0 0;font-size:14px;">
            <a href="https://academy.onethousanddrones.com" style="color:${COMMAND_GOLD};text-decoration:none;">Back to OTD Academy &#8594;</a>
          </p>
        </div>
      </div>
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#6b7080;text-align:center;">${esc(env.LIFECYCLE_POSTAL_ADDRESS)}</p>
    </div>
  </body>
</html>`;
}

/** GET: the question and one button that POSTs back to the same URL. */
export function askPage(args: {
  heading: string;
  message: string;
  button: string;
}): Response {
  const inner = `
          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${esc(args.message)}</p>
          <form method="post" style="margin:26px 0 0;">
            <button type="submit" style="padding:12px 22px;background-color:${COMMAND_GOLD};color:${DEEP_SPACE};font-weight:700;border:0;border-radius:6px;font-size:15px;cursor:pointer;">${esc(args.button)}</button>
          </form>`;
  return new Response(shell(args.heading, inner), {
    status: 200,
    headers: PAGE_HEADERS,
  });
}

/** POST result, or an invalid link on either method. */
export function resultPage(args: {
  ok: boolean;
  heading: string;
  message: string;
}): Response {
  const inner = `
          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${esc(args.message)}</p>`;
  return new Response(shell(args.heading, inner), {
    status: args.ok ? 200 : 400,
    headers: PAGE_HEADERS,
  });
}

export const INVALID_LINK = {
  ok: false,
  heading: "Link not valid",
  message:
    "This link is invalid, has expired, or has been tampered with. If you keep getting email you don't want, reply to one and we'll remove you.",
} as const;
