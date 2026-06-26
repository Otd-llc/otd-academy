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
import { BriefDocumentMobile } from "@/components/briefs/BriefDocumentMobile";
import { SheetScaler } from "@/components/briefs/SheetScaler";
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
        {/* Direct download of the pre-generated PDF (Chromium-made, links intact).
            Avoids window.print(), whose links the Windows "Print to PDF" driver
            strips. Regenerate with scripts/generate-brief-pdfs.mjs. */}
        <a
          href={`/briefs/${brief.key}.pdf`}
          download={`otd-${brief.key}-brief.pdf`}
          className="glass-button glass-button-cta inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider"
        >
          Download PDF <span aria-hidden="true">↓</span>
        </a>
      </div>

      {/* Desktop + print: the fixed letter sheet (the single source for the PDF),
          scaled to fit the column. Hidden on phones, where it would be unreadable. */}
      <div className="brief-sheet-desktop mx-auto hidden max-w-[816px] md:block">
        <SheetScaler width={816}>
          <BriefDocument brief={brief} />
        </SheetScaler>
      </div>

      {/* Phones: a reflowed, readable version of the same brief (same data). */}
      <div className="brief-mobile md:hidden">
        <BriefDocumentMobile brief={brief} />
      </div>
    </main>
  );
}
