// Double opt-in confirmation (plan P.5). The signed token in the path is the
// gate; the recipient has no account. Public in proxy.ts isPublicPath.
//
// GET shows the question and a button; POST confirms. Never confirm on GET:
// mail scanners follow links (see waitlist-page.ts). A confirm token expires
// with the unconfirmed row it points at (7 days), so an old link is "not
// valid" rather than a late subscription.
import { db } from "@/lib/db";
import { confirmWaitlistRow } from "@/lib/waitlist-confirm";
import { askPage, INVALID_LINK, resultPage } from "@/lib/waitlist-page";
import { verifyWaitlistToken } from "@/lib/waitlist-token";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const claims = verifyWaitlistToken(token, "confirm");
  if (!claims) return resultPage(INVALID_LINK);
  return askPage({
    heading: "Confirm this address",
    message: `Press the button to confirm ${claims.email} for this list. We'll email it once, when there is something to say, and nothing else.`,
    button: "Confirm",
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const claims = verifyWaitlistToken(token, "confirm");
  if (!claims) return resultPage(INVALID_LINK);
  const outcome = await confirmWaitlistRow(db, claims);
  if (outcome === "gone") {
    return resultPage({
      ok: false,
      heading: "Nothing to confirm",
      message:
        "This address is no longer on the list. It may have been removed, or the unconfirmed signup expired. You can sign up again from the page you started on.",
    });
  }
  return resultPage({
    ok: true,
    heading: outcome === "already" ? "Already confirmed" : "Confirmed",
    message: `${claims.email} is on the list. You'll get one email when there is something to say, with a link to remove yourself.`,
  });
}
