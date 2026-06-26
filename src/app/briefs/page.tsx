// Public briefs index — /briefs.
//
// A capability-dossier cover. The two public briefs are the product, so they
// lead and dominate; the academy's hard numbers sit in one thin fact ribbon and
// the curriculum shape in one compact system line, both supporting, neither a
// hollow panel. Each brief links to its full HTML page (which doubles as the
// downloadable PDF via print). Static, gate-less, crawlable. No database. Copy
// is verbatim from the academy sales kit; OTD is SAM-registered (CAGE 1ZYS4),
// so "capability brief" is literal, not a metaphor.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { CommandFrame } from "@/components/CommandFrame";
import { breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEFS, BRIEF_KEYS, SYSTEM_MAP } from "@/lib/brief-pages";

export const dynamic = "force-static";

// Tight, punchy facts for the ribbon (short labels, not the sales-kit
// sentences). Value carries the weight; the label is one or two words.
const FACTS: { value: string; label: string }[] = [
  { value: "22", label: "boards" },
  { value: "8", label: "stages each" },
  { value: "DRC = 0", label: "the real gate" },
  { value: "$0", label: "to start" },
];

// Short card heading per brief, so the cards don't echo the hero line (which is
// itself the overview brief's title).
const CARD_HEADING: Record<string, string> = {
  overview: "The overview",
  learner: "For learners",
};

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

        {/* Fact ribbon — the hard numbers in one slim, dense strip. */}
        <dl className="-mt-2 flex flex-wrap divide-x divide-panel-border overflow-hidden rounded-md border border-panel-border bg-bg-2/30">
          {FACTS.map((f) => (
            <div
              key={f.value}
              className="flex min-w-[7.5rem] flex-1 items-baseline gap-2 px-5 py-3.5"
            >
              <dd className="font-display text-2xl leading-none tracking-wide text-command-gold">
                {f.value}
              </dd>
              <dt className="font-mono text-[10px] uppercase leading-tight tracking-[0.16em] text-muted">
                {f.label}
              </dt>
            </div>
          ))}
        </dl>

        {/* The briefs — the product. Two prominent dossier cards. */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {BRIEF_KEYS.map((key, i) => {
            const brief = BRIEFS[key];
            // The first/overview card is the master; give it the stronger rim.
            const primary = i === 0;
            return (
              <li key={key}>
                <Link
                  href={`/briefs/${key}`}
                  className={`group relative flex h-full flex-col glass-card p-6 transition-colors hover:border-command-gold/60 sm:p-7 ${
                    primary ? "border-command-gold/45" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-command-gold/40 transition-colors group-hover:border-command-gold"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                    {brief.briefLabel}
                  </span>
                  <h2 className="title-section mt-3 group-hover:text-command-gold">
                    {CARD_HEADING[key] ?? brief.title}
                  </h2>
                  <p className="mt-3 font-serif text-[15px] leading-relaxed text-text">
                    {brief.seoDescription}
                  </p>
                  <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-panel-border pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {brief.meta.map((m) => (
                      <div key={m.label} className="flex gap-1.5">
                        <dt className="text-command-gold">{m.label}</dt>
                        <dd>{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                    Read the brief
                    <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* System line — one platform, four tracks, two capstones, in a single
            compact ruled row rather than a panel of empty boxes. */}
        <section aria-labelledby="system-h" className="mt-10">
          <div className="flex flex-col gap-3 rounded-md border border-panel-border bg-bg-2/30 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
            <p
              id="system-h"
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold"
            >
              The system
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em]">
              <span className="rounded border border-command-gold/40 bg-command-gold/10 px-2 py-1 font-bold text-command-gold">
                {SYSTEM_MAP.root.label}
              </span>
              <span aria-hidden="true" className="text-gray-3">
                →
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-signal-blue">
                {SYSTEM_MAP.tracks.map((t, i) => (
                  <span key={t.code} className="flex items-center gap-2">
                    {i > 0 ? (
                      <span aria-hidden="true" className="text-gray-3">
                        ·
                      </span>
                    ) : null}
                    {t.code}
                  </span>
                ))}
              </span>
              <span aria-hidden="true" className="text-gray-3">
                →
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gold-light">
                {SYSTEM_MAP.capstones.map((c, i) => (
                  <span key={c.code} className="flex items-center gap-2">
                    {i > 0 ? (
                      <span aria-hidden="true" className="text-gray-3">
                        ·
                      </span>
                    ) : null}
                    {c.code}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </section>

        <p className="mt-8 max-w-2xl font-serif text-sm italic text-muted">
          These two cuts are public. The full set spans overview, learners,
          educators, vendors, investors, defense, sponsors, press, talent, and
          pipeline.
        </p>
      </div>
    </main>
  );
}
