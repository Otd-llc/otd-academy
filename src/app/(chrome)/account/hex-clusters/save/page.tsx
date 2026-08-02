import type { Metadata } from "next";
import { auth } from "@/auth";
import { SaveHexClusterForm } from "@/components/hex/SaveHexClusterForm";
import { SaveSignInGate } from "@/components/hex/SaveSignInGate";

// The hand-off target for "Save" in the hex configurator.
//
// PUBLIC-ELIGIBLE, gated HERE rather than in middleware. The build being saved
// arrives in the URL FRAGMENT, and a client island has to stash it across the
// magic-link round trip; middleware would redirect before any page JS runs, so
// the island would never mount. isPublicPath names this route for the same
// reason.
//
// The anonymous branch RENDERS A CLIENT GATE instead of calling redirect().
// This route has a cached shell, so a Server Component redirect() here is
// delivered after a 200 body and run by the client router — a scripted
// navigation, which inherits no fragment. Measured: this document loads with
// the fragment intact and /sign-in's location.hash is empty, while a
// middleware 307 (/account) does inherit it. The gate reads the envelope in
// THIS document, stashes it, and only then navigates.
//
// The search string is carried into callbackUrl and ENCODED: since the user
// picks the save mode at the configurator's Save control, that choice lives
// only in the query, and an unencoded `&share=` would split off the
// callbackUrl parameter and turn a revision save into a modeless one.

export const metadata: Metadata = {
  title: "Save build",
  robots: { index: false, follow: false },
};

export default async function SaveHexClusterPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; share?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    const query = new URLSearchParams();
    if (params.mode) query.set("mode", params.mode);
    if (params.share) query.set("share", params.share);
    const target = `/account/hex-clusters/save${query.size ? `?${query}` : ""}`;
    return <SaveSignInGate target={target} />;
  }

  const mode = params.mode === "rev" ? "rev" : "new";
  return <SaveHexClusterForm mode={mode} share={params.share ?? null} />;
}
