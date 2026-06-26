// Public briefs index — /briefs.
//
// A capability-dossier cover for the academy: the hero, the academy's headline
// numbers (PROOF_STATS), the curriculum system map (ESP32-S3 fanning to four
// tracks and two capstones), then the public briefs as dossier sections. Each
// brief links to its full HTML page (which doubles as the downloadable PDF via
// print). Static, gate-less, crawlable. No database. Copy is verbatim from the
// academy sales kit; OTD is SAM-registered (CAGE 1ZYS4), so "capability brief"
// is literal, not a metaphor.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { CommandFrame } from "@/components/CommandFrame";
import { breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import {
  BRIEFS,
  BRIEF_KEYS,
  PROOF_STATS,
  SYSTEM_MAP,
} from "@/lib/brief-pages";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const url = `${base}/briefs`;
  const title = "Briefs · One Thousand Drones Academy";
  const description =
    "Short briefs on One Thousand Drones Academy: a project-based PCB engineering school where you design real boards on the ESP32-S3 in KiCad 10 and advance only by passing a clean design-rule check.";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "One Thousand Drones Academy",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function BriefsIndexPage() {
  const base = siteUrl();
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Briefs", url: `${base}/briefs` },
  ]);

  return (
    <main className="relative isolate overflow-hidden">
      <CommandFrame />
      <JsonLd data={crumbLd} />

      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
        <PageHeader
          eyebrow="CAPABILITY BRIEFS"
          title="One mind. Many machines."
          accentWord="machines."
          lead="Short reads on what the academy is, who it is for, and why it is built the way it is. You design real boards on the ESP32-S3 in KiCad 10 and advance only by passing a clean design-rule check."
        />

        {/* ── By the numbers — the academy's headline facts as an instrument
            readout. The signature element: oversized Bebas figures over a
            one-line plain-language gloss. ── */}
        <section aria-label="By the numbers" className="mt-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-panel-border bg-panel-border/40 lg:grid-cols-4">
            {PROOF_STATS.map((s) => (
              <div key={s.value} className="flex flex-col bg-deep-space/85 px-5 py-7">
                <dt className="order-2 mt-2.5 font-mono text-[11px] leading-snug tracking-[0.04em] text-muted">
                  {s.label}
                </dt>
                <dd className="order-1 font-display text-[2.75rem] leading-[0.85] tracking-wide text-command-gold">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── The system map — one platform fanning to four tracks and two
            capstones. A clean responsive cluster, not a PCB graphic. ── */}
        <section aria-labelledby="system-map-h" className="mt-16">
          <p
            id="system-map-h"
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-command-gold"
          >
            The system
          </p>
          <div className="mt-5 glass-card p-6 sm:p-8">
            {/* Root platform */}
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-baseline gap-3 rounded-md border border-command-gold/50 bg-command-gold/10 px-4 py-2">
                <span className="font-display text-2xl tracking-wide text-title">
                  {SYSTEM_MAP.root.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {SYSTEM_MAP.root.sub}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="my-4 h-6 w-px bg-gradient-to-b from-command-gold/50 to-panel-border"
              />
            </div>

            {/* Four tracks */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SYSTEM_MAP.tracks.map((t) => (
                <li
                  key={t.code}
                  className="rounded-md border border-panel-border bg-deep-space/60 p-4"
                >
                  <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-signal-blue">
                    {t.code}
                  </p>
                  <p className="mt-1.5 font-serif text-sm leading-snug text-muted">
                    {t.blurb}
                  </p>
                </li>
              ))}
            </ul>

            {/* Converge to capstones */}
            <div className="mt-3 flex flex-col items-center">
              <span
                aria-hidden="true"
                className="my-4 h-6 w-px bg-gradient-to-b from-panel-border to-command-gold/50"
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                Converging on
              </p>
              <ul className="mt-3 flex flex-wrap justify-center gap-3">
                {SYSTEM_MAP.capstones.map((c) => (
                  <li
                    key={c.code}
                    className="gold-glow flex items-baseline gap-2.5 rounded-md border border-command-gold/60 bg-command-gold/10 px-4 py-2.5"
                  >
                    <span className="font-display text-xl tracking-wide text-command-gold">
                      {c.code}
                    </span>
                    <span className="font-serif text-sm italic text-muted">
                      {c.blurb}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── The briefs themselves — dossier sections. ── */}
        <section aria-labelledby="briefs-h" className="mt-16">
          <p
            id="briefs-h"
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-command-gold"
          >
            Read the briefs
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {BRIEF_KEYS.map((key) => {
              const brief = BRIEFS[key];
              return (
                <li key={key}>
                  <Link
                    href={`/briefs/${key}`}
                    className="group relative flex h-full flex-col gap-3 glass-card p-6 transition-colors hover:border-command-gold/55"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-command-gold/40 transition-colors group-hover:border-command-gold"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                      {brief.briefLabel}
                    </span>
                    <span className="title-card group-hover:text-command-gold">
                      {brief.title}
                    </span>
                    <span className="font-serif text-sm leading-snug text-muted">
                      {brief.seoDescription}
                    </span>
                    <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      {brief.meta.map((m) => (
                        <div key={m.label} className="flex gap-1.5">
                          <dt className="text-command-gold">{m.label}</dt>
                          <dd>{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="mt-auto pt-1 font-mono text-xs uppercase tracking-wider text-command-gold">
                      Read the brief →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 max-w-2xl font-serif text-sm italic text-muted">
            These two cuts are public. The full set spans overview, learners,
            educators, vendors, investors, defense, sponsors, press, talent, and
            pipeline.
          </p>
        </section>
      </div>
    </main>
  );
}
