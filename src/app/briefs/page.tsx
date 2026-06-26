// Public briefs index — /briefs.
//
// A clean index of the public briefs, nothing more: the index lists what's
// available and hands off; the facts, numbers, and system map live INSIDE each
// brief, so they are not recapped here. Each card links to the full HTML brief
// page (which doubles as the downloadable PDF via print). Static, gate-less,
// crawlable. No database. Copy is verbatim from the academy sales kit.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { CommandFrame } from "@/components/CommandFrame";
import { breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEFS, BRIEF_KEYS } from "@/lib/brief-pages";

export const dynamic = "force-static";

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

      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <PageHeader
          eyebrow="CAPABILITY BRIEFS"
          title="One mind. Many machines."
          accentWords={["mind", "machines"]}
          lead="Short reads on what the academy is, who it is for, and why it is built the way it is. Pick a cut."
        />

        <ul className="grid gap-4 sm:grid-cols-2">
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
                  <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                    Read the brief
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
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
      </div>
    </main>
  );
}
