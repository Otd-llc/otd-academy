import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EMBED_ISLANDS } from "@/components/tools/embed-islands";
import { EmbedAutosize } from "@/components/tools/EmbedAutosize";
import { siteUrl } from "@/lib/seo/jsonld";
import { TOOLS, getTool } from "@/lib/tools/registry";

type Params = { slug: string };

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
  // The embed is a stripped duplicate of /tools/[slug]; keep it out of the index
  // and point canonical at the full page so the calculator ranks in one place.
  // `follow` so the attribution link to the tool is still crawled.
  return {
    title: `${tool.title} (embed)`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${siteUrl()}/tools/${tool.slug}` },
  };
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  const Island = EMBED_ISLANDS[slug];
  if (!tool || !Island) notFound();

  const toolUrl = `${siteUrl()}/tools/${tool.slug}`;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <EmbedAutosize slug={tool.slug} />
      <div className="mx-auto max-w-xl">
        <p className="mb-1 border-b border-panel-border/60 pb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          <span aria-hidden="true">▸ </span>
          {tool.hero} calculator
        </p>

        <Island />

        <a
          href={toolUrl}
          target="_blank"
          rel="noopener"
          className="mt-5 block border-t border-panel-border/60 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
        >
          {tool.title} · One Thousand Drones Academy
        </a>
      </div>
    </main>
  );
}
