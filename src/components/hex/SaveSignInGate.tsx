"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { HEX_STASH_KEY, type HexStash } from "@/components/hex/hex-stash";

/**
 * The anonymous branch of the save page: stash the build, then go to sign-in.
 *
 * A CLIENT gate rather than the obvious Server Component redirect(). The build
 * lives in the URL FRAGMENT, and the server redirect on this route is delivered
 * after a 200 shell and executed by the client router — a scripted navigation,
 * which carries no fragment. Measured: the save page's document loads with the
 * fragment intact and /sign-in's location.hash is empty, while a middleware 307
 * on /account does inherit it. So the only place the envelope can still be read
 * is here, in this document, before anything navigates.
 *
 * It reads the LIVE location rather than props: the fragment is unavailable to
 * the server by definition, and the query is right there next to it.
 *
 * Renders a real message, not null. The stash write and the navigation both
 * happen in an effect, so there is a frame where this is what the user is
 * looking at — and if JavaScript is off, the link is the only way onward.
 */
export function SaveSignInGate({ target }: { target: string }) {
  const signInUrl = `/sign-in?callbackUrl=${encodeURIComponent(target)}`;

  useEffect(() => {
    const envelope = window.location.hash.replace(/^#/, "");
    if (envelope) {
      try {
        const stash: HexStash = {
          envelope,
          search: window.location.search,
          at: Date.now(),
        };
        window.localStorage.setItem(HEX_STASH_KEY, JSON.stringify(stash));
      } catch {
        // Private mode, quota, blocked storage. The save page tells the user
        // their build could not be carried through sign-in and to press Save
        // again — recoverable, unlike a silent empty form.
      }
    }
    // replace, not assign: Back from /sign-in should return to the
    // configurator, not bounce through this gate again.
    window.location.replace(signInUrl);
  }, [signInUrl]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="SAVED BUILDS"
        title="Sign in to save."
        lead="Your build is being carried over. Taking you to sign in…"
      />
      <p className="mt-8 border-t border-panel-border/60 pt-6 font-serif text-sm text-muted">
        <a
          href={signInUrl}
          className="text-command-gold underline underline-offset-4"
        >
          Continue to sign in
        </a>
      </p>
    </main>
  );
}
