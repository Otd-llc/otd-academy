// The capability-brief document, in real HTML, built to match the one-pager PDF
// pixel for pixel. It is the single source of truth: it renders as the crawlable
// web page (SEO) AND prints to the downloadable PDF (globals.css @media print).
//
// A fixed 816px letter-width "sheet" (scaled to fit on mobile by SheetScaler) so
// the layout never reflows away from the design. Honeycomb field, the gold
// wordmark underline, the alternating-gold headline, the system-spec block, the
// sub-headline + body, the Brain-to-Swarm map, the four stats, and the CTA +
// registration footer. Uses <div> (not <header>/<footer>) so the print
// stylesheet can hide the SITE chrome without hiding the document's own bars.

import Link from "next/link";

import { BriefSystemMap } from "@/components/briefs/BriefSystemMap";
import { DOC_CTA, SYSTEM_SPEC, type BriefData } from "@/lib/brief-pages";

// Hero Patterns "Hexagons" — a seamless honeycomb, command-gold at low opacity.
const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8963e' fill-opacity='0.05'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

function Body({ text, emphasis }: { text: string; emphasis: string }) {
  const i = text.indexOf(emphasis);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <em className="italic text-gray-2">{emphasis}</em>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export function BriefDocument({ brief }: { brief: BriefData }) {
  return (
    <article
      className="brief-doc relative w-full px-11 py-9 text-white"
      style={{
        backgroundColor: "var(--color-deep-space)",
        backgroundImage: HONEYCOMB,
        backgroundSize: "46px auto",
      }}
    >
      {/* Corner-bracket accents (the four sheet corners). */}
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-command-gold/55" />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-command-gold/55" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-command-gold/55" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-command-gold/55" />

      {/* Header bar */}
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.28em]">
        <span className="text-gray-2">
          One Thousand Drones <span className="text-command-gold">// Academy</span>
        </span>
        <span className="text-muted">{brief.briefLabel}</span>
      </div>
      <div className="relative mt-2.5 h-px w-full bg-panel-border">
        <span className="absolute -top-px left-0 h-[3px] w-32 bg-command-gold" />
      </div>

      {/* Hero: headline + system spec */}
      <div className="mt-7 flex items-start justify-between gap-8">
        <h1 className="font-display text-[66px] leading-[0.82] tracking-tight text-white">
          One <span className="text-command-gold">mind.</span>
          <br />
          Many <span className="text-command-gold">machines.</span>
        </h1>

        <dl className="w-[256px] shrink-0 overflow-hidden rounded-sm border border-command-gold/40">
          <div className="border-b border-command-gold/40 bg-command-gold/[0.07] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-command-gold">
            System spec
          </div>
          <div className="divide-y divide-panel-border">
            {SYSTEM_SPEC.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-3 px-3 py-[7px]"
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {s.label}
                </dt>
                <dd className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gray-1">
                  {s.value}
                </dd>
              </div>
            ))}
          </div>
        </dl>
      </div>

      {/* Sub-headline */}
      <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.18em] text-command-gold">
        {brief.subhead}
      </p>

      {/* Body */}
      <p className="mt-3.5 max-w-[80%] font-serif text-[15px] leading-relaxed text-gray-1">
        <Body text={brief.docBody} emphasis={brief.docEmphasis} />
      </p>

      {/* System map */}
      <figure className="mt-7 overflow-hidden rounded-md border border-panel-border bg-bg-2/30">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
          <span>System map · the Brain-to-Swarm curriculum</span>
          <span>22 boards / 4 tracks / 2 capstones</span>
        </div>
        <div className="px-8 py-6">
          <BriefSystemMap />
        </div>
        <div className="flex items-center justify-center gap-10 border-t border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Live DigiKey pricing</span>
          <span>Fab-ready gerbers</span>
          <span>Sealed certificate at /verify</span>
        </div>
      </figure>

      {/* Stats */}
      <dl className="mt-7 grid grid-cols-4 gap-6 border-t border-panel-border pt-6">
        {brief.stats.map((s) => (
          <div key={s.value}>
            <dt className="font-display text-[40px] leading-none tracking-wide text-command-gold">
              {s.value}
            </dt>
            <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
              {s.label}
            </dd>
            <dd className="mt-1.5 font-serif text-[11px] leading-snug text-muted">
              {s.desc}
            </dd>
          </div>
        ))}
      </dl>

      {/* CTA + registration footer */}
      <div className="mt-7 flex items-end justify-between gap-8 border-t border-panel-border pt-6">
        <div>
          <Link
            href={DOC_CTA.href}
            className="inline-flex items-center gap-2 rounded-sm bg-command-gold px-5 py-2.5 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-deep-space transition-colors hover:bg-gold-light"
          >
            {DOC_CTA.label}
            <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold">
            academy.onethousanddrones.com
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Free · No subscription · Lifetime access
          </p>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          <p>One Thousand Drones LLC</p>
          <p className="mt-1">CAGE 1ZYS4 · UEI WDQXD9L9UFH3</p>
        </div>
      </div>
    </article>
  );
}
