// The "set up once" region — rendered as the first hands-on DO step (guide-pacing
// plan Task 5, revised 2026-07-22). It wraps the derived setup range: a
// `Setup · …` callout + the blocks up to the next structural break (a mode band,
// a numbered section, another setup, or the end of the card).
//
// Owner call (2026-07-22): the KiCad + starter setup is the FIRST thing a learner
// DOES, so it must always be visible and read as a DO step. It used to render as a
// collapsible <details> that auto-collapsed for RETURNING visitors — now it is a
// framed, always-open section carrying the gold "Do ·" kicker motif (the same
// Design-Stages kicker as ActionCalloutBlock), so it can't be hidden and reads as
// build step 1.
//
// Purely a render-time grouping — the block list stays flat, so readiness
// counters and the PDF export are unaffected. No client state, so this is a plain
// server component (was "use client" only for the old collapse memory).

import type { ReactNode } from "react";

export function SetupBand({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-y border-command-gold/30 py-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
          Do · {title}
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-command-gold/30 to-transparent" />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">set up once</span>
      </div>
      <div className="space-y-5 pt-3">{children}</div>
    </section>
  );
}
