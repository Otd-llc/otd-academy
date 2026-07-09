// Access gate for the downloadable Library field guides (per-cluster + the
// combined book). Field guides are free but account-gated: the compiled book is
// the lead magnet, the per-lesson PDFs stay open as the quality sample. A request
// is authorized when EITHER a signed-in session exists (any account) OR the URL
// carries a valid, unexpired signed token for THIS guide (the portable link we
// email, so it opens on any device without a second sign-in).
import { auth } from "@/auth";
import { verifyFieldGuideToken } from "@/lib/field-guide-token";

export async function isFieldGuideAuthorized(req: Request, guide: string): Promise<boolean> {
  const token = new URL(req.url).searchParams.get("t");
  if (token) {
    const claims = verifyFieldGuideToken(token);
    if (claims && claims.guide === guide) return true;
  }
  const session = await auth();
  return Boolean(session?.user);
}

// Where an unauthorized direct hit (pasted URL, expired emailed link) is sent:
// back to the Library with a marker the page uses to auto-open the free-account
// prompt for that guide. A present-but-rejected token means an emailed link that
// EXPIRED (or was tampered) — flag it so the prompt can say "link expired, sign
// in for a fresh one" instead of the generic first-time copy.
export function fieldGuideGateRedirect(req: Request, guide: string): Response {
  const hadToken = new URL(req.url).searchParams.has("t");
  const query = `gate=${encodeURIComponent(guide)}${hadToken ? "&expired=1" : ""}`;
  return Response.redirect(new URL(`/library?${query}`, req.url), 307);
}
