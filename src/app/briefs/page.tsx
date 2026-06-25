// Public briefs index — /briefs.
//
// Lists the two public web briefs (overview + learner) and links the
// downloadable one-pager set (PDFs in public/briefs/). Static, gate-less,
// crawlable. No database. Copy is verbatim from the academy sales kit.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEFS, BRIEF_KEYS, BRIEF_PDFS } from "@/lib/brief-pages";

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

      <section>
        <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
          <span className="h-px w-6 bg-command-gold/50" />
          Read a brief
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {BRIEF_KEYS.map((key) => {
            const brief = BRIEFS[key];
            return (
              <li key={key}>
                <Link
                  href={`/briefs/${key}`}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-panel-border bg-deep-space/40 p-5 transition-colors hover:border-command-gold/50"
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
                    Read →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
          <span className="h-px w-6 bg-command-gold/50" />
          Download the one-pagers
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted">
          The same briefs are available as one-page PDFs. The full set spans
          overview, learners, educators, vendors, investors, defense, sponsors,
          press, talent, and pipeline; the two public cuts are linked here.
        </p>
        <ul className="mt-5 space-y-2">
          {BRIEF_PDFS.map((pdf) => (
            <li key={pdf.file}>
              <a
                href={`/briefs/${pdf.file}`}
                className="inline-flex items-center gap-2 font-mono text-sm text-command-gold underline-offset-4 hover:underline"
              >
                {pdf.label} (PDF) ↓
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 font-serif text-sm italic text-muted">
        One Thousand Drones Academy is the talent and hardware pipeline beneath
        One Thousand Drones LLC and its Brain-to-Swarm program.
      </p>
    </main>
  );
}
