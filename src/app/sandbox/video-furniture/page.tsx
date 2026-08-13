// Video furniture: the index.
//
//   /sandbox/video-furniture
//
// ROUND 1 STOOD HERE and has been deleted. A sandbox round is an audition
// surface: the old one goes once its direction is taken, because letting rounds
// pile up is how a sandbox becomes a second product with nobody owning it.
// Round 1 lives in the commits (`caa72f67`, `a69ca135`); what survived it is
// round 2.
//
// It was also the last place the banned hex entrance
// `scale(0.6..1) rotate(-12deg)` still existed - rotation is not in the
// permitted vocabulary - so deleting the round is what makes that line stop
// existing, rather than repairing it inside a round nobody opens again.
//
// WHY THIS ROUND EXISTS AT ALL. The guides carry 127 titled youtube slots with
// no video (audit 2026-08-13, `scripts/_verify-guide-render.ts`). Those are
// screencasts, and every one needs the same wrappers. Authoring furniture once
// and generating it 127 times only works if the treatment is decided by eye
// FIRST, which is what these pages are for.
//
// ASCII only.

import Link from "next/link";
import { notFound } from "next/navigation";
import { PIECES, PIECE_KEYS } from "./r2/variants";

export default function VideoFurnitureIndex() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; Sandbox
      </p>
      <h1 className="title-hero mt-2">Video furniture</h1>
      <p className="subhead mt-3">
        Round 2. Seven pieces, ten treatments each, judged on the grid and measured on the frame.
      </p>

      <ul className="mt-10 border-t border-panel-border/60">
        {PIECE_KEYS.map((key) => (
          <li key={key}>
            <Link
              href={`/sandbox/video-furniture/r2/${key}`}
              className="group flex flex-col gap-1.5 border-b border-panel-border/60 py-6 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                &#9656; {key}
              </span>
              <span className="title-card group-hover:text-gold-light">{PIECES[key].name}</span>
              <span className="text-sm text-muted">
                {PIECES[key].variants.length} treatments &middot; {PIECES[key].seconds}s
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-relaxed text-muted">
        The grid is for judging composition. Anything measured there is measured at a quarter
        scale and is therefore not measured: use{" "}
        <span className="font-mono text-xs text-text">/r2/frame?piece=&hellip;&amp;variant=&hellip;</span>
        , which renders one treatment at the delivery size and exposes{" "}
        <span className="font-mono text-xs text-text">window.__seek(t)</span>.
      </p>
    </main>
  );
}
