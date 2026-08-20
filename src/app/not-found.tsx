// The 404 body, for every `notFound()` in the app.
//
// There was no not-found.tsx anywhere, so every one of them -- on /library/[slug],
// /courses/[slug], /parts/[id], /tools/[slug] and the rest -- rendered Next's
// unstyled built-in: black Helvetica on white, no header, no way onward. On the
// public content routes that is the page a search engine or a stale bookmark
// lands on.
//
// This file sits at the ROOT, above both route groups, so it covers the
// chromeless half too. That is deliberate rather than duplicating it per group:
// a 404 is the same answer everywhere, and a root file cannot be forgotten when
// a new group is added.
//
// A SERVER component, and it reads nothing. It must be able to render when the
// reason for the 404 is that a lookup failed, so it takes no props, touches no
// database and consults no session -- there is nothing here that can 404 again.
//
// Note on status: this renders the 404 BODY, and Next sets the 404 STATUS for a
// route that is rendered dynamically. On a PRERENDERED route the status belongs
// to the shell that was already committed, so those serve this body with a 200.
// That is a routing-layer problem, not something a not-found file can fix -- see
// src/lib/dev-only-routes.ts, where the same limitation forced a middleware gate.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
        ▸ 404
      </p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-wide text-title">
        No such page
      </h1>
      <p className="mt-3 max-w-sm font-serif text-sm leading-relaxed text-muted">
        The link may be out of date, or the page may have moved. The library and
        the course index below are the two places most things can be found from.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/library"
          className="rounded border border-command-gold bg-deep-space px-6 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          Library
        </Link>
        <Link
          href="/courses"
          className="font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-text"
        >
          Courses →
        </Link>
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
