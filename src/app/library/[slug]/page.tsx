// Public Library mini-lesson route — /library/[slug] (content-model §3, plan A7).
//
// A gate-less, PUBLIC, crawlable article. Reuses the guide content-block renderer
// (GuideBlocks) over the Library block allowlist (no project/enrollment-coupled
// blocks reach it). Emits TechArticle + LearningResource + Breadcrumb JSON-LD on
// every page, plus a DefinedTerm on the single canonical page that declares a
// coined term (e.g. motor-imagery-bci → "Embodied Motor Imagery"). Down-funnel
// CTAs degrade to the course waitlist when the target build isn't published.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { GuideBlocks } from "@/components/guide/GuideBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import {
  techArticleJsonLd,
  learningResourceJsonLd,
  definedTermJsonLd,
  breadcrumbJsonLd,
  siteUrl,
} from "@/lib/seo/jsonld";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { basenamesInBlocks } from "@/lib/diagram-usage";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import { LIBRARY_DEFINED_TERMS } from "@/lib/library/defined-terms";
import { loadPublicMiniLesson } from "@/lib/library/load";

// DB-backed: render at request time (the CI build runs with a stub DATABASE_URL).
export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await loadPublicMiniLesson(slug);
  if (!lesson) return {};
  const base = siteUrl();
  const url = `${base}/library/${lesson.slug}`;
  const title = lesson.seoTitle ?? lesson.title;
  const description = lesson.seoDescription ?? lesson.summary ?? undefined;

  // Per-page social-share image: the lesson's first registry diagram, whose
  // exported .webp is a real crawlable image (the on-page diagram is DOM-only).
  // Falls back to the site default when a lesson has no diagram.
  const parsedForOg = guideContentBlocksSchema.safeParse(lesson.contentBlocks);
  const firstDiagram = parsedForOg.success ? basenamesInBlocks(parsedForOg.data)[0] : undefined;
  const images = firstDiagram
    ? [{ url: `${base}/guide-diagrams/${firstDiagram}.webp`, alt: title }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url, ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images } : {}) },
  };
}

export default async function LibraryArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const lesson = await loadPublicMiniLesson(slug);
  if (!lesson) notFound();

  // Parse + allowlist-filter (defense-in-depth: a project-coupled block can't
  // reach the renderer without project context; a bad row safeParses to []).
  const parsed = guideContentBlocksSchema.safeParse(lesson.contentBlocks);
  const blocks = filterLibraryBlocks(parsed.success ? parsed.data : []);

  const base = siteUrl();
  const url = `${base}/library/${lesson.slug}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const articleLd = techArticleJsonLd({
    headline: lesson.title,
    description: lesson.summary,
    url,
    datePublished: iso(lesson.createdAt),
    dateModified: iso(lesson.updatedAt),
    authorName: "One Thousand Drones",
  });
  const learningLd = learningResourceJsonLd({
    name: lesson.title,
    description: lesson.summary,
    url,
  });
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Library", url: `${base}/library` },
    { name: lesson.title, url },
  ]);

  // DefinedTerm — emitted only on the single canonical page that declares the term.
  const termDecl = LIBRARY_DEFINED_TERMS[lesson.slug];
  const definedTermLd = termDecl
    ? definedTermJsonLd({
        name: termDecl.name,
        alternateName: termDecl.alternateName,
        description: termDecl.description,
        url,
        termSetName: termDecl.termSetName,
        termSetUrl: `${base}${termDecl.termSetPath}`,
      })
    : null;

  const upLinks = lesson.relatedProjects.filter((r) => r.role === "SUPPORTING");
  const downFunnel = lesson.relatedProjects.filter((r) => r.role === "DOWN_FUNNEL");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={articleLd} />
      <JsonLd data={learningLd} />
      <JsonLd data={crumbLd} />
      {definedTermLd ? <JsonLd data={definedTermLd} /> : null}

      <PageHeader
        backHref="/library"
        backLabel="Library"
        eyebrow="LIBRARY"
        title={lesson.title}
        lead={lesson.summary ?? undefined}
      />

      <GuideBlocks blocks={blocks} isSignedIn={false} />

      {lesson.byline ? (
        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">
          {lesson.byline}
        </p>
      ) : null}

      {upLinks.length > 0 ? (
        <nav className="mt-8 border-t border-panel-border pt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gray-3">
            Part of the path
          </p>
          <ul className="space-y-1">
            {upLinks.map((r) => (
              <li key={r.project.slug}>
                <Link
                  className="text-command-gold hover:underline"
                  href={`/courses/${r.project.slug}`}
                >
                  {r.project.publicTitle ?? r.project.name} →
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {downFunnel.length > 0 ? (
        <section className="mt-8 rounded-md border border-command-gold/40 bg-command-gold/5 p-5">
          {downFunnel.map((r) => {
            // Degrade to the course waitlist/preview when the build isn't live
            // (decision 4 — never dead-link a "coming soon" build).
            const published =
              r.project.publishedRevisionId !== null && r.project.publishedRevision;
            const href = published
              ? `/projects/${r.project.slug}/${encodeURIComponent(
                  r.project.publishedRevision!.label,
                )}/guide`
              : `/courses/${r.project.slug}`;
            return (
              <div key={r.project.slug} className="flex flex-col gap-2">
                <p className="font-mono text-xs uppercase tracking-wider text-muted">
                  {published ? "Build it" : "Coming soon"}
                </p>
                <Link
                  href={href}
                  className="text-lg font-semibold text-command-gold hover:underline"
                >
                  {r.project.publicTitle ?? r.project.name} →
                </Link>
                {r.project.tagline ? (
                  <p className="text-sm text-muted">{r.project.tagline}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
