"use client";

// The ask that only appears once the files are already on their way.
//
// It wraps the download rows rather than sitting beside them, because the whole
// point is the ORDER: the anchor's default action is never touched, the browser
// starts the download, and only then does a field appear underneath. Nothing
// here can delay or block a download — there is no preventDefault, no fetch in
// front of it, no disabled state on the link.
//
// Rendered collapsed and inert until that first click, so a visitor who came for
// the files and nothing else never sees a form at all.

import { useState } from "react";

import { notifyOnHexRelease } from "@/lib/actions/hex-release-notify";
import { InlineBanner } from "@/components/InlineBanner";

type Phase = "idle" | "asking" | "sending" | "done" | "error";

export function ReleaseNotify({
  release,
  children,
}: {
  release: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  return (
    <div
      // Capture phase, so a click on any download anchor inside is seen without
      // this having to know which children it was given. Deliberately NOT a
      // handler on the anchors themselves: those are server-rendered rows, and
      // wiring each one would make the whole list a client component.
      onClickCapture={(e) => {
        const el = e.target as HTMLElement | null;
        if (!el?.closest("a[download]")) return;
        // The click is NOT intercepted. The browser is already fetching.
        setPhase((p) => (p === "idle" ? "asking" : p));
      }}
    >
      {children}

      {phase !== "idle" && (
        <div className="mt-5 border-t border-command-gold/40 pt-4">
          {phase === "done" ? (
            <p className="font-serif text-sm leading-relaxed text-text">
              Done. One email when the next release lands, and nothing else.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPhase("sending");
                setError("");
                void notifyOnHexRelease({ email, release }).then(
                  (res) => {
                    if (res.ok) {
                      setPhase("done");
                    } else {
                      setError(res.error);
                      setPhase("error");
                    }
                  },
                  () => {
                    setError("That did not reach us. Try again.");
                    setPhase("error");
                  },
                );
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                &#9656; Your download is starting
              </p>
              <p className="mt-2 max-w-md font-serif text-sm leading-relaxed text-muted">
                Want to know when the geometry changes? One email per release.
                No course pitches, no list.
              </p>

              {phase === "error" && (
                <div className="mt-3 max-w-md">
                  <InlineBanner variant="error">{error}</InlineBanner>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label htmlFor="hex-notify-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="hex-notify-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={phase === "sending"}
                  className="w-full max-w-xs border border-panel-border/60 bg-transparent px-3 py-2 font-serif text-sm text-title outline-none focus-visible:border-command-gold sm:w-auto"
                />
                <button
                  type="submit"
                  disabled={phase === "sending" || email.trim() === ""}
                  className="glass-button px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
                >
                  {phase === "sending" ? "Sending…" : "Notify me"}
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("done")}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-gold-light"
                >
                  No thanks
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
