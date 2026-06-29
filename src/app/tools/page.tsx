// Public /tools hub — the index of OTD EE calculators. Static, crawlable.
// Emits ItemList + Breadcrumb JSON-LD and links each tool by slug. New tools
// appear here automatically by adding to the TOOLS registry.
import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { courseListJsonLd, breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { TOOLS } from "@/lib/tools/registry";

// HERO is the on-page H1 (short, so the Bebas hero doesn't balloon). TITLE is the
// longer, keyworded <title>/SERP string; LEAD is the Lora subhead differentiator.
const HERO = "Electronics calculators";
const TITLE = "Electronics calculators, worked from real boards";
const LEAD =
  "Free calculators for hardware builders. Each one is worked from a real OTD board, with the formula and a cited source.";

export function generateMetadata(): Metadata {
  const url = `${siteUrl()}/tools`;
  return {
    title: TITLE,
    description: LEAD,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: LEAD, type: "website", url },
    twitter: { card: "summary", title: TITLE, description: LEAD },
  };
}

export default function ToolsHubPage() {
  const base = siteUrl();
  const listLd = courseListJsonLd(
    TOOLS.map((t) => ({ name: t.title, url: `${base}/tools/${t.slug}` })),
  );
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Tools", url: `${base}/tools` },
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={listLd} />
      <JsonLd data={crumbLd} />

      <PageHeader eyebrow="TOOLS" title={HERO} lead={LEAD} />

      <ul className="border-t border-panel-border/60">
        {TOOLS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/tools/${t.slug}`}
              className="group flex flex-col gap-1.5 border-b border-panel-border/60 py-6 transition-colors hover:bg-command-gold/[0.04]"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                <span aria-hidden="true">▸ </span>Calculator
              </span>
              <span className="font-display text-2xl tracking-wide text-text transition-colors group-hover:text-gold-light">
                {t.title}
              </span>
              <span className="text-sm leading-snug text-muted">{t.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
