// The capability-brief document, in real HTML, built to match the one-pager PDF.
// Single source of truth: it renders as the crawlable web page (SEO) AND prints
// to the downloadable PDF (globals.css @media print).
//
// A fixed 816px letter-width sheet (8.5in), tuned to the original's density so it
// fits a single page. Honeycomb field, corner brackets, gold wordmark underline,
// the big alternating-gold headline, the system-spec block, sub-headline + body,
// the Brain-to-Swarm map, four stats, and the CTA + registration footer. Uses
// <div> (not <header>/<footer>) so the print stylesheet can hide the SITE chrome.

import Link from "next/link";

import { BriefSystemMap } from "@/components/briefs/BriefSystemMap";
import { DOC_CTA, SYSTEM_SPEC, type BriefData } from "@/lib/brief-pages";

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8963e' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

// Warm ivory the headline words, periods, wordmark, and spec values use (sampled
// from the original PDF). The gold words are command-gold; their PERIODS are not.
const IVORY = "#f1ece0";

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
      className="brief-doc relative w-full px-10 py-5 text-white"
      style={{
        backgroundColor: "var(--color-deep-space)",
        backgroundImage: HONEYCOMB,
        backgroundSize: "104px auto",
      }}
    >
      {/* Corner-bracket accents (the four sheet corners). */}
      <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-5 w-5 border-l border-t border-command-gold/45" />
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 h-5 w-5 border-r border-t border-command-gold/45" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 left-2.5 h-5 w-5 border-b border-l border-command-gold/45" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 right-2.5 h-5 w-5 border-b border-r border-command-gold/45" />

      {/* Header bar */}
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.28em]">
        <span style={{ color: IVORY }}>
          One Thousand Drones{" "}
          <span className="font-bold text-command-gold">// Academy</span>
        </span>
        <span className="text-muted">{brief.briefLabel}</span>
      </div>
      <div className="relative mt-2 h-px w-full bg-panel-border">
        <div
          aria-hidden="true"
          className="absolute -top-px left-0 h-[2px] w-3/5"
          style={{
            background:
              "linear-gradient(to right, #c8963e 0%, #c8963e 38%, rgba(200,150,62,0) 100%)",
          }}
        />
      </div>

      {/* Hero: the two-line headline beside the system spec (top-right), matching
          the original one-pager. The spec box's row height tracks the headline so
          its bottom lands near the headline's, leaving no dead space. */}
      <div className="mt-5 flex items-start justify-between gap-7">
        <h1
          className="font-display text-[84px] leading-[0.8] tracking-tight"
          style={{
            color: IVORY,
            // Bebas Neue ships a single weight, so font-weight can't bolden it.
            // Thicken the glyph strokes directly (each part strokes its own color).
            WebkitTextStrokeWidth: "1.4px",
            WebkitTextStrokeColor: "currentColor",
          }}
        >
          One <span className="text-command-gold">mind</span>.
          <br />
          Many <span className="text-command-gold">machines</span>.
        </h1>

        <dl className="w-[252px] shrink-0 overflow-hidden rounded-sm border border-command-gold/25">
          <div className="border-b border-panel-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-command-gold">
            System spec
          </div>
          <div className="divide-y divide-panel-border">
            {SYSTEM_SPEC.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-3 px-4 py-1.5"
              >
                <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
                  {s.label}
                </dt>
                <dd
                  className="whitespace-nowrap font-mono text-[12px] font-bold tracking-[0.02em]"
                  style={{ color: IVORY }}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </div>
        </dl>
      </div>

      {/* Sub-headline */}
      <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em] text-command-gold">
        {brief.subhead}
      </p>

      {/* Body */}
      <p className="mt-3 max-w-[88%] font-serif text-[14px] leading-relaxed text-gray-1">
        <Body text={brief.docBody} emphasis={brief.docEmphasis} />
      </p>

      {/* System map */}
      <figure className="mt-3 overflow-hidden rounded-md border border-panel-border bg-bg-2/30">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
          <span>System map · the Brain-to-Swarm curriculum</span>
          <span>22 boards / 4 tracks / 2 capstones</span>
        </div>
        <div className="px-7 py-2">
          <div className="mx-auto max-w-[600px]">
            <BriefSystemMap />
          </div>
        </div>
        <div className="flex items-center justify-center gap-10 border-t border-panel-border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Live DigiKey pricing</span>
          <span>Fab-ready gerbers</span>
          <span>Sealed certificate at /verify</span>
        </div>
      </figure>

      {/* Stats */}
      <dl className="mt-3 grid grid-cols-4 gap-6 border-t border-panel-border pt-4">
        {brief.stats.map((s) => (
          <div key={s.value}>
            <dt className="font-display text-[38px] leading-none tracking-wide text-command-gold">
              {s.value}
            </dt>
            <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
              {s.label}
            </dd>
            <dd className="mt-1 font-serif text-[11px] leading-snug text-muted">
              {s.desc}
            </dd>
          </div>
        ))}
      </dl>

      {/* CTA + registration footer */}
      <div className="mt-3 flex items-end justify-between gap-8 border-t border-panel-border pt-4">
        <div>
          <Link
            href={DOC_CTA.href}
            className="inline-flex items-center gap-2 rounded-sm bg-command-gold px-5 py-2.5 font-mono text-[13px] font-bold tracking-[0.06em] text-deep-space transition-colors hover:bg-gold-light"
          >
            {DOC_CTA.label}
            <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-command-gold">
            academy.onethousanddrones.com
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Free · No subscription · Lifetime access
          </p>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          <p>One Thousand Drones LLC</p>
          <p className="mt-1">CAGE 1ZYS4 · UEI WDQXD9L9UFH3</p>
        </div>
      </div>
    </article>
  );
}
