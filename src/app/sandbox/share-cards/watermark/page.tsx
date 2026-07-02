// Share-card sandbox — F-family watermark round (Task 2 convergence gate).
//
// Josh picked the F split-panel direction and asked to see F carrying a large
// brand-mark watermark in the Field Guide style. Ten variations, rendered at the
// short title (the mark is the variable; base F already proved long-title wrap).
// Dev-only: notFound() in production.

import { notFound } from "next/navigation";
import { WATERMARK_OPTIONS } from "../watermark-options";

export const dynamic = "force-dynamic";

export default function WatermarkRound() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="border-b border-panel-border/60 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Sandbox · F convergence
        </p>
        <h1 className="title-hero mt-3">F + brand-mark watermark</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The F split panel carrying the One Thousand Drones mark in the Field
          Guide style (the drone-bee mark, gold, low opacity, behind the content).
          Ten treatments. Pick one (mix-and-match welcome) and I lock it, then
          stress it at a long title before wiring the real routes. Click any card
          for full 1200&times;630.
        </p>
        <p className="mt-6 border-l-2 border-command-gold pl-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-gold-light">
          Baked dark artifacts · shown at the short title · long-title wrap
          available on the winner.
        </p>
      </header>

      {WATERMARK_OPTIONS.map((opt) => (
        <section key={opt.id} className="mt-12 border-b border-panel-border/60 pb-12">
          <div className="flex items-baseline gap-3">
            <span className="font-numeral text-2xl tabular-nums text-command-gold">
              {opt.id}
            </span>
            <h2 className="title-card">{opt.label}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted">{opt.blurb}</p>

          <div className="mt-5 flex flex-wrap gap-8">
            <figure className="flex flex-col gap-2">
              <a
                href={`/sandbox/share-cards/img/${opt.id}-short`}
                target="_blank"
                rel="noreferrer"
                className="block border border-panel-border/60 transition-colors hover:border-command-gold focus-visible:border-command-gold focus-visible:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/sandbox/share-cards/img/${opt.id}-short`}
                  alt={`${opt.id} ${opt.label}`}
                  width={720}
                  height={378}
                  className="block"
                />
              </a>
            </figure>
          </div>
        </section>
      ))}
    </main>
  );
}
