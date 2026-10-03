// Removal from an anonymous email capture (plan P.5). The signed token in the
// path is the gate; it never expires, because a removal request is honoured
// whenever it arrives. Public in proxy.ts isPublicPath.
//
// GET shows the question and a button; POST removes the row. The POST also
// serves RFC 8058 one-click: every mail from these lists carries
// List-Unsubscribe pointing here with List-Unsubscribe-Post, so the mail
// client's own Unsubscribe control lands here with a form body of
// `List-Unsubscribe=One-Click`. Either body, or none, removes. A GET must not,
// for the reason in waitlist-page.ts.
import { db } from "@/lib/db";
import { removeWaitlistRow } from "@/lib/waitlist-confirm";
import {
  askPage,
  INVALID_LINK,
  PLAIN_HEADERS,
  resultPage,
} from "@/lib/waitlist-page";
import { verifyWaitlistToken } from "@/lib/waitlist-token";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const claims = verifyWaitlistToken(token, "remove");
  if (!claims) return resultPage(INVALID_LINK);
  return askPage({
    heading: "Remove this address",
    message: `Press the button to take ${claims.email} off this list. The row is deleted, not marked; signing up again later starts over.`,
    button: "Remove",
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const claims = verifyWaitlistToken(token, "remove");
  const oneClick = /List-Unsubscribe=One-Click/i.test(
    (await req.text().catch(() => "")) || "",
  );
  if (!claims) {
    return oneClick
      ? new Response("Invalid link", { status: 400, headers: PLAIN_HEADERS })
      : resultPage(INVALID_LINK);
  }
  const outcome = await removeWaitlistRow(db, claims);
  if (oneClick) {
    // A mail client, not a person: a 2xx with a tiny body is all it needs.
    return new Response(outcome === "removed" ? "Removed" : "Already removed", {
      status: 200,
      headers: PLAIN_HEADERS,
    });
  }
  return resultPage({
    ok: true,
    heading: outcome === "removed" ? "Removed" : "Already removed",
    message: `${claims.email} is no longer on this list. You will not hear from it again.`,
  });
}
