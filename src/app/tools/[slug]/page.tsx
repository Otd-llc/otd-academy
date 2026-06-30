// Public EE-tool route — /tools/[slug]. A static, crawlable calculator page:
// answer-first prose (server) wrapping one interactive client island. Emits
// TechArticle + LearningResource + Breadcrumb JSON-LD (hygiene, per the 2026-06
// validation). Pages are statically generated from the TOOLS registry; no DB.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { LipoRuntimeBody } from "@/components/tools/LipoRuntimeBody";
import { Ws2812PowerBody } from "@/components/tools/Ws2812PowerBody";
import { LedResistorBody } from "@/components/tools/LedResistorBody";
import { VoltageDividerBody } from "@/components/tools/VoltageDividerBody";
import { LdoHeadroomBody } from "@/components/tools/LdoHeadroomBody";
import { RcFilterBody } from "@/components/tools/RcFilterBody";
import {
  techArticleJsonLd,
  learningResourceJsonLd,
  breadcrumbJsonLd,
  siteUrl,
} from "@/lib/seo/jsonld";
import { TOOLS, getTool } from "@/lib/tools/registry";

type Params = { slug: string };

// Slug → prose body. A slug in TOOLS without a body here 404s (defensive).
const BODIES: Record<string, () => ReactNode> = {
  "lipo-battery-runtime": LipoRuntimeBody,
  "ws2812-power-supply": Ws2812PowerBody,
  "led-series-resistor": LedResistorBody,
  "voltage-divider": VoltageDividerBody,
  "ldo-headroom": LdoHeadroomBody,
  "rc-filter-cutoff": RcFilterBody,
};

export function generateStaticParams(): Params[] {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const url = `${siteUrl()}/tools/${tool.slug}`;
  return {
    title: tool.title,
    description: tool.summary,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: { title: tool.title, description: tool.summary, type: "article", url },
    twitter: { card: "summary", title: tool.title, description: tool.summary },
  };
}

export default async function ToolPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  const Body = BODIES[slug];
  if (!tool || !Body) notFound();

  const base = siteUrl();
  const url = `${base}/tools/${tool.slug}`;

  const articleLd = techArticleJsonLd({
    headline: tool.h1,
    description: tool.summary,
    url,
    datePublished: tool.published,
    dateModified: tool.modified,
    authorName: "One Thousand Drones",
  });
  const learningLd = learningResourceJsonLd({
    name: tool.title,
    description: tool.summary,
    url,
  });
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Tools", url: `${base}/tools` },
    { name: tool.title, url },
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={articleLd} />
      <JsonLd data={learningLd} />
      <JsonLd data={crumbLd} />

      <PageHeader
        backHref="/tools"
        backLabel="Tools"
        eyebrow="TOOLS"
        title={tool.hero}
        lead={tool.summary}
      />

      <Body />
    </main>
  );
}
