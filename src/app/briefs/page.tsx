// Public briefs index — /briefs.
//
// Lists the public web briefs (overview + learner). Each links to its full HTML
// brief page (which doubles as the downloadable PDF via print). Static,
// gate-less, crawlable. No database. Copy is verbatim from the academy sales kit.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEFS, BRIEF_KEYS } from "@/lib/brief-pages";

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
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={crumbLd} />

      <PageHeader
        eyebrow="BRIEFS"
        title="One mind. Many machines."
        accentWord="machines."
        lead="Short reads on what the academy is, who it is for, and why it is built the way it is. You design real boards on the ESP32-S3 in KiCad 10 and advance only by passing a clean design-rule check."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {BRIEF_KEYS.map((key) => {
          const brief = BRIEFS[key];
          return (
            <li key={key}>
              <Link
                href={`/briefs/${key}`}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-panel-border bg-bg-2/30 p-6 transition-colors hover:border-command-gold/50"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                  {brief.eyebrow}
                </span>
                <span className="font-display text-2xl leading-tight tracking-wide text-white group-hover:text-command-gold">
                  {brief.title}
                </span>
                <span className="font-serif text-sm leading-snug text-muted">
                  {brief.seoDescription}
                </span>
                <span className="mt-auto pt-2 font-mono text-xs uppercase tracking-wider text-command-gold">
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
    </main>
  );
}
