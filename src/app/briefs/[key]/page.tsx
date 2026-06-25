// Public brief page — /briefs/[key].
//
// The brief is real HTML (BriefDocument), so it is crawlable and matches the
// designed one-pager exactly. "Download PDF" prints this same page through the
// print stylesheet, so the PDF is the page: one source of truth, always in sync,
// nothing to regenerate. Static, gate-less; emits TechArticle + Breadcrumb
// JSON-LD. Copy/SEO text comes from src/lib/brief-pages.ts.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { BriefDocument } from "@/components/briefs/BriefDocument";
import { SheetScaler } from "@/components/briefs/SheetScaler";
import { PrintButton } from "@/components/briefs/PrintButton";
import { breadcrumbJsonLd, techArticleJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEF_KEYS, getBrief } from "@/lib/brief-pages";

// Pure static, no DB. Pre-render both keys at build time.
export const dynamic = "force-static";

export function generateStaticParams() {
  return BRIEF_KEYS.map((key) => ({ key }));
}

type Params = { key: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { key } = await params;
  const brief = getBrief(key);
  if (!brief) return {};
  const base = siteUrl();
  const url = `${base}/briefs/${brief.key}`;
  return {
    title: brief.seoTitle,
    description: brief.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      title: brief.seoTitle,
      description: brief.seoDescription,
      type: "article",
      url,
      siteName: "One Thousand Drones Academy",
    },
    twitter: {
      card: "summary_large_image",
      title: brief.seoTitle,
      description: brief.seoDescription,
    },
  };
}

export default async function BriefPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { key } = await params;
  const brief = getBrief(key);
  if (!brief) notFound();

  const base = siteUrl();
  const url = `${base}/briefs/${brief.key}`;

  const articleLd = techArticleJsonLd({
    headline: brief.seoTitle,
    description: brief.seoDescription,
    url,
    authorName: "One Thousand Drones",
  });
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Briefs", url: `${base}/briefs` },
    { name: brief.title, url },
  ]);

  return (
    <main className="briefs-print mx-auto max-w-[860px] px-4 py-8 sm:px-6">
      <JsonLd data={articleLd} />
      <JsonLd data={crumbLd} />

      {/* Page chrome (hidden from print). */}
      <div className="brief-chrome mx-auto mb-6 flex max-w-[816px] items-center justify-between gap-3">
        <Link
          href="/briefs"
          className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
        >
          ← Briefs
        </Link>
        <PrintButton className="glass-button glass-button-cta inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider" />
      </div>

      {/* The brief itself: a fixed letter-width sheet (the single source for web
          and PDF), scaled to fit on smaller screens. */}
      <div className="mx-auto max-w-[816px]">
        <SheetScaler width={816}>
          <BriefDocument brief={brief} />
        </SheetScaler>
      </div>
    </main>
  );
}
