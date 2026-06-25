// Public brief page — /briefs/[key].
//
// The brief IS the capability-brief one-pager we designed: shown as the rendered
// PDF (a high-res PNG in public/briefs) with a link to download the vector PDF.
// One design, no web reinterpretation. Static, gate-less, crawlable; emits
// TechArticle + Breadcrumb JSON-LD for SEO. Copy/SEO text comes from
// src/lib/brief-pages.ts.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, techArticleJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { BRIEF_KEYS, getBrief } from "@/lib/brief-pages";
import type { BriefKey } from "@/lib/brief-pages";

// Pure static, no DB. Pre-render both keys at build time.
export const dynamic = "force-static";

export function generateStaticParams() {
  return BRIEF_KEYS.map((key) => ({ key }));
}

type Params = { key: string };

// The rendered one-pager basenames in public/briefs (.png to view, .pdf to keep).
const PDF_BASE: Record<BriefKey, string> = {
  overview: "00-master-overview",
  learner: "01-learners",
};

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
  const file = PDF_BASE[brief.key];
  const png = `/briefs/${file}.png`;
  const pdf = `/briefs/${file}.pdf`;

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
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={articleLd} />
      <JsonLd data={crumbLd} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/briefs"
          className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
        >
          ← Briefs
        </Link>
        <a
          href={pdf}
          download
          className="glass-button glass-button-cta inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-wider"
        >
          Download PDF
          <span aria-hidden="true">↓</span>
        </a>
      </div>

      {/* SEO + a11y heading; the brief artwork carries the visible title. */}
      <h1 className="sr-only">{brief.seoTitle}</h1>

      {/* The brief, exactly as designed. */}
      <Image
        src={png}
        alt={brief.seoDescription}
        width={1700}
        height={2200}
        priority
        className="mt-6 h-auto w-full rounded-xl border border-panel-border shadow-[0_10px_44px_-14px_rgba(0,0,0,0.9)]"
      />

      {/* Down-funnel. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {brief.ctas.map((cta) => (
          <Link
            key={cta.href}
            href={cta.href}
            className={`glass-button inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider ${
              cta.primary ? "glass-button-cta" : ""
            }`}
          >
            {cta.label}
          </Link>
        ))}
        <a
          href={pdf}
          download
          className="font-mono text-xs uppercase tracking-wider text-muted underline-offset-4 transition-colors hover:text-command-gold hover:underline"
        >
          Download PDF ↓
        </a>
      </div>

      <p className="mt-10 font-serif text-sm italic text-muted">
        One Thousand Drones Academy is the talent and hardware pipeline beneath
        One Thousand Drones LLC and its Brain-to-Swarm program.{" "}
        <Link
          href="/briefs"
          className="text-command-gold underline underline-offset-4"
        >
          All briefs →
        </Link>
      </p>
    </main>
  );
}
