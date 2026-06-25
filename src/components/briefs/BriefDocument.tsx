// The capability-brief document, in real HTML. This is the single source of
// truth for a brief: it renders as the crawlable web page (good SEO) AND, via
// the print stylesheet (globals.css @media print), prints to the downloadable
// PDF. There is no separate PDF artifact to keep in sync. Matches the designed
// one-pager: header bar, the alternating-gold headline, the system-spec block,
// the sub-headline + body, the Brain-to-Swarm system map, the four stats, and
// the CTA + registration footer.
//
// Uses <div> (not <header>/<footer>) for its internal bars so the print
// stylesheet can hide the SITE header/footer without hiding the document's own.

import Link from "next/link";

import { BriefSystemMap } from "@/components/briefs/BriefSystemMap";
import { SYSTEM_SPEC, type BriefData } from "@/lib/brief-pages";

export function BriefDocument({ brief }: { brief: BriefData }) {
  return (
    <article className="brief-doc mx-auto max-w-5xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-command-gold/30 pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-gray-2">
          One Thousand Drones <span className="text-command-gold">// Academy</span>
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          {brief.briefLabel}
        </p>
      </div>

      {/* Hero: headline + system spec */}
      <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_18rem] lg:items-start">
        <h1 className="font-display text-5xl leading-[0.85] tracking-tight text-white sm:text-7xl">
          One <span className="text-command-gold">mind.</span>
          <br />
          Many <span className="text-command-gold">machines.</span>
        </h1>

        <dl className="overflow-hidden rounded-lg border border-command-gold/30">
          <div className="border-b border-command-gold/30 bg-command-gold/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-command-gold">
            System spec
          </div>
          <div className="divide-y divide-panel-border">
            {SYSTEM_SPEC.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-4 px-4 py-2"
              >
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  {s.label}
                </dt>
                <dd className="font-mono text-[11px] uppercase tracking-wider text-gray-1">
                  {s.value}
                </dd>
              </div>
            ))}
          </div>
        </dl>
      </div>

      {/* Sub-headline */}
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-command-gold sm:text-sm">
        {brief.subhead}
      </p>

      {/* Body */}
      <p className="mt-4 max-w-3xl font-serif text-base leading-relaxed text-gray-1 sm:text-lg">
        {brief.lead}
      </p>

      {/* System map */}
      <figure className="mt-8 overflow-hidden rounded-xl border border-panel-border bg-bg-2/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
          <span>System map · the Brain-to-Swarm curriculum</span>
          <span className="text-muted">22 boards / 4 tracks / 2 capstones</span>
        </div>
        <div className="px-4 py-7 sm:px-8 sm:py-9">
          <BriefSystemMap />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-panel-border px-5 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Live DigiKey pricing</span>
          <span>Fab-ready gerbers</span>
          <span>Sealed certificate at /verify</span>
        </div>
      </figure>

      {/* Stats */}
      <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-panel-border pt-8 sm:grid-cols-4">
        {brief.stats.map((s) => (
          <div key={s.value}>
            <dt className="font-display text-4xl tracking-wide text-command-gold sm:text-5xl">
              {s.value}
            </dt>
            <dd className="mt-1 font-mono text-[11px] uppercase tracking-wider text-white">
              {s.label}
            </dd>
            <dd className="mt-1.5 font-serif text-xs leading-snug text-muted">
              {s.desc}
            </dd>
          </div>
        ))}
      </dl>

      {/* CTA + registration footer */}
      <div className="mt-9 flex flex-col gap-5 border-t border-panel-border pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {brief.ctas.map((cta) => (
            <Link
              key={cta.href}
              href={cta.href}
              className={`glass-button inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider ${
                cta.primary ? "glass-button-cta" : ""
              }`}
            >
              {cta.label}
            </Link>
          ))}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:text-right">
          <p>academy.onethousanddrones.com</p>
          <p>Free · No subscription · Lifetime access</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <span>One Thousand Drones LLC</span>
        <span>CAGE 1ZYS4 · UEI WDQXD9L9UFH3</span>
      </div>
    </article>
  );
}
