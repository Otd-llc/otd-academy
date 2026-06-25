// Mobile reflow of the capability brief. The desktop/PDF view is a fixed 816px
// letter sheet (BriefDocument) that would shrink to unreadable on a phone, so on
// small screens we render this single-column, properly-sized version instead.
// Same data source (brief-pages.ts), so the content never diverges; only the
// layout does. Hidden on print, where the letter sheet is used.

import Link from "next/link";

import { BriefSystemMapMobile } from "@/components/briefs/BriefSystemMapMobile";
import { DOC_CTA, SYSTEM_SPEC, type BriefData } from "@/lib/brief-pages";

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8963e' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

// Warm ivory the headline words, periods and spec values use (sampled from the
// original PDF); the gold words are command-gold, their periods are not.
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

export function BriefDocumentMobile({ brief }: { brief: BriefData }) {
  return (
    <article
      className="relative overflow-hidden rounded-lg border border-panel-border px-5 py-7 text-white"
      style={{
        backgroundColor: "var(--color-deep-space)",
        backgroundImage: HONEYCOMB,
        backgroundSize: "92px auto",
      }}
    >
      {/* Header */}
      <div className="font-mono text-[10px] uppercase tracking-[0.24em]">
        <span style={{ color: IVORY }}>
          One Thousand Drones{" "}
          <span className="font-bold text-command-gold">// Academy</span>
        </span>
        <p className="mt-1 text-muted">{brief.briefLabel}</p>
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

      {/* Headline */}
      <h1
        className="mt-6 font-display text-[clamp(44px,13vw,62px)] leading-[0.82] tracking-tight"
        style={{
          color: IVORY,
          WebkitTextStrokeWidth: "1px",
          WebkitTextStrokeColor: "currentColor",
        }}
      >
        One <span className="text-command-gold">mind</span>.
        <br />
        Many <span className="text-command-gold">machines</span>.
      </h1>

      {/* Sub-headline */}
      <p className="mt-5 font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-command-gold">
        {brief.subhead}
      </p>

      {/* Body */}
      <p className="mt-3 font-serif text-[16px] leading-relaxed text-gray-1">
        <Body text={brief.docBody} emphasis={brief.docEmphasis} />
      </p>

      {/* System spec */}
      <dl className="mt-6 overflow-hidden rounded-md border border-command-gold/25">
        <div className="border-b border-panel-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-command-gold">
          System spec
        </div>
        <div className="divide-y divide-panel-border">
          {SYSTEM_SPEC.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
                {s.label}
              </dt>
              <dd
                className="text-right font-mono text-[13px] font-bold tracking-[0.02em]"
                style={{ color: IVORY }}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </div>
      </dl>

      {/* System map */}
      <figure className="mt-6 overflow-hidden rounded-md border border-panel-border bg-bg-2/30">
        <div className="border-b border-panel-border px-4 py-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-command-gold">
          System map · the Brain-to-Swarm curriculum
        </div>
        <div className="px-4 py-4">
          <BriefSystemMapMobile />
        </div>
        <div className="border-t border-panel-border px-4 py-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          22 boards / 4 tracks / 2 capstones
        </div>
      </figure>

      {/* Stats */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-panel-border pt-6">
        {brief.stats.map((s) => (
          <div key={s.value}>
            <dt className="font-display text-[34px] leading-none tracking-wide text-command-gold">
              {s.value}
            </dt>
            <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
              {s.label}
            </dd>
            <dd className="mt-1 font-serif text-[12px] leading-snug text-muted">
              {s.desc}
            </dd>
          </div>
        ))}
      </dl>

      {/* CTA + registration */}
      <div className="mt-6 border-t border-panel-border pt-6">
        <Link
          href={DOC_CTA.href}
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-command-gold px-5 py-3 font-mono text-[13px] font-bold tracking-[0.06em] text-deep-space transition-colors hover:bg-gold-light"
        >
          {DOC_CTA.label}
          <span aria-hidden="true">→</span>
        </Link>
        <p className="mt-3 text-center font-mono text-[10px] tracking-[0.12em] text-command-gold">
          <Link href="/" className="underline-offset-2 hover:underline">
            academy.onethousanddrones.com
          </Link>
        </p>
        <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Free · No subscription · Lifetime access
        </p>
        <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
          One Thousand Drones LLC · CAGE 1ZYS4 · UEI WDQXD9L9UFH3
        </p>
      </div>
    </article>
  );
}
