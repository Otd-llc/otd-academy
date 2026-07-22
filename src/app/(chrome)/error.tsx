"use client";

// Route-group error boundary for every chromed page (audit Phase 6): a DB
// timeout or transaction conflict on a learner surface renders THIS branded
// retry instead of Next's unstyled default. The header/chrome above survives
// (only the page segment is replaced), so token classes are available — unlike
// global-error.tsx, which must inline everything. Reads no session/DB.
import Link from "next/link";

export default function ChromeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
        ▸ Fault
      </p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-wide text-title">
        Something failed on our side
      </h1>
      <p className="mt-3 max-w-sm font-serif text-sm leading-relaxed text-muted">
        Your progress is saved on the server. Try again; if this keeps
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
