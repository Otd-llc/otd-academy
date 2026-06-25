// Public briefs index — /briefs.
//
// Lists the two public web briefs (overview + learner) and links the
// downloadable one-pager set (PDFs in public/briefs/). Static, gate-less,
// crawlable. No database. Copy is verbatim from the academy sales kit.

import type { Metadata } from "next";
import Image from "next/image";
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
          The briefs
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {BRIEF_KEYS.map((key, i) => {
            const brief = BRIEFS[key];
            const file = BRIEF_PDFS[i].file.replace(/\.pdf$/, "");
            return (
              <li key={key} className="flex flex-col">
                <Link
                  href={`/briefs/${key}`}
                  className="group block overflow-hidden rounded-2xl border border-panel-border transition-colors hover:border-command-gold/60"
                >
                  <Image
                    src={`/briefs/${file}.png`}
                    alt={brief.seoDescription}
                    width={1700}
                    height={2200}
                    className="h-auto w-full"
                  />
                </Link>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Link
                    href={`/briefs/${key}`}
                    className="font-mono text-xs uppercase tracking-wider text-command-gold underline-offset-4 hover:underline"
                  >
                    {brief.eyebrow} →
                  </Link>
                  <a
                    href={`/briefs/${file}.pdf`}
                    download
                    className="font-mono text-xs uppercase tracking-wider text-muted underline-offset-4 hover:text-command-gold hover:underline"
                  >
                    PDF ↓
                  </a>
                </div>
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

      <p className="mt-10 font-serif text-sm italic text-muted">
        One Thousand Drones Academy is the talent and hardware pipeline beneath
        One Thousand Drones LLC and its Brain-to-Swarm program.
      </p>
    </main>
  );
}
