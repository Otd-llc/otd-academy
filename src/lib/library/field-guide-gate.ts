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
// back to the Library with a marker the page can use to prompt a free account.
export function fieldGuideGateRedirect(req: Request, guide: string): Response {
  return Response.redirect(new URL(`/library?gate=${encodeURIComponent(guide)}`, req.url), 307);
}
