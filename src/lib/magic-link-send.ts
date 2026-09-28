// The magic-link email POST to Resend, extracted from the provider's
// `sendVerificationRequest` in `src/auth.ts` so its failure contract can be
// unit-tested without constructing NextAuth.
//
// THE CONTRACT (CLAUDE.md, "Signup abuse defense"): every failure THROWS A PLAIN
// `Error`. Never an AuthError (that 500s), never an early return (that reports a
// silent "sent"). A plain Error surfaces as `?error=Configuration`.
//
// Before throwing, the failure is recorded with `captureNow` — awaited, because
// the invocation is about to end in a throw and a batched event would never
// flush. It is recorded BEFORE the response body is read: a 5xx from a gateway
// often has a non-JSON body, and the old `await res.json()` threw a SyntaxError
// from inside the error path, so the one outage worth knowing about left no
// trace. The event carries the HTTP status only: no address, no body.
//
// A PLAIN module (not "use server").
import { captureNow } from "@/lib/analytics";

export const MAGIC_LINK_SEND_FAILED = "magic_link_send_failed";
const DISTINCT_ID = "server:auth";

export type MagicLinkMessage = {
  apiKey: string | undefined;
  from: string | undefined;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendMagicLinkEmail(msg: MagicLinkMessage): Promise<void> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${msg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
  } catch (e) {
    // Network failure, DNS, TLS, an abort: no status to report.
    await captureNow(MAGIC_LINK_SEND_FAILED, { status: "fetch_rejected" }, DISTINCT_ID);
    throw new Error(
      "Resend request failed: " + (e instanceof Error ? e.name : "unknown"),
    );
  }

  if (!res.ok) {
    await captureNow(MAGIC_LINK_SEND_FAILED, { status: res.status }, DISTINCT_ID);
    // The body is for the server log only, and is read defensively: it may be
    // HTML, empty, or already broken.
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      detail = "";
    }
    throw new Error(`Resend error ${res.status}: ${detail}`);
  }
}
