// Public /tools hub — the index of OTD EE calculators. Static, crawlable.
// Emits ItemList + Breadcrumb JSON-LD and links each tool by slug. New tools
// appear here automatically by adding to the TOOLS registry.
import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { courseListJsonLd, breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { TOOLS } from "@/lib/tools/registry";

const TITLE = "EE calculators and tools";
const SUMMARY =
  "Free electronics calculators from One Thousand Drones, each worked from a real board: battery runtime, LED-strip power, and more.";

export function generateMetadata(): Metadata {
  const url = `${siteUrl()}/tools`;
  return {
    title: TITLE,
    description: SUMMARY,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: SUMMARY, type: "website", url },
    twitter: { card: "summary", title: TITLE, description: SUMMARY },
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

      <PageHeader eyebrow="TOOLS" title={TITLE} lead={SUMMARY} />

      <ul className="grid gap-4">
        {TOOLS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/tools/${t.slug}`}
              className="block rounded-lg border border-panel-border bg-navy-dark/40 p-5 transition-colors hover:border-command-gold/50"
            >
              <p className="text-lg font-semibold text-command-gold">{t.title}</p>
              <p className="mt-1 text-sm text-gray-2">{t.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
