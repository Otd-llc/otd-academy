"use client";

// Route-group error boundary for the CHROMELESS pages. Sibling of
// (chrome)/error.tsx, which the chromed half has had; this group had none, so a
// render fault anywhere in it escalated straight to global-error.tsx -- which
// replaces the entire document, styles and all.
//
// That mattered most on /sign-in. It lives in this group, and it is where a
// Resend outage or a database fault is MOST likely to surface: a fault there
// blanked the whole page for someone mid-login, with no way back other than the
// browser's back button.
//
// The other three routes in the group are /c/[shareCode] (a public shared build,
// often opened from a printed QR code), /embed/[slug] (rendered inside an
// iframe on another site, where a blank document is indistinguishable from a
// broken embed) and /film-render/[cut].
//
// No chrome here by definition, so this paints its own centred panel rather than
// assuming a header above it. Token classes still apply -- globals.css comes
// from the ROOT layout, above both route groups -- so unlike global-error.tsx
// this does not have to inline its styles. Reads no session and no database, so
// it cannot fail for the same reason the page did.
import Link from "next/link";

export default function BareError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
        ▸ Fault
      </p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-wide text-title">
        Something failed on our side
      </h1>
      <p className="mt-3 max-w-sm font-serif text-sm leading-relaxed text-muted">
        Nothing you did caused this and nothing was lost. Try again; if it keeps
        happening, come back in a few minutes.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded border border-command-gold bg-deep-space px-6 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          Retry
        </button>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-text"
        >
          Home →
        </Link>
      </div>
    </main>
  );
}
