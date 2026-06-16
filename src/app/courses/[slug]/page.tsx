// Per-course preview / waitlist landing — `/courses/<slug>`.
//
// The public, indexable page for a course that isn't built yet ("coming soon").
// It is BOTH the SEO asset (unique crawlable content per course: title,
// tagline, what you'll build, where it fits in the curriculum) AND the demand-
// capture point (the anonymous WaitlistForm writes a per-course WaitlistSignup).
// Coming-soon skill-tree nodes link here.
//
// A course that IS published has no preview to show — it redirects to its guide
// outline (the canonical home for a built course). Archived / unknown → 404.
//
// Public + crawlable: admitted by `isPublicPath` (top === "courses"). No auth.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { WaitlistForm } from "@/components/learn/WaitlistForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { courseJsonLd, breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { ChevronLeftIcon } from "@/components/icons";

// DB-backed + public: force request-time rendering so the CI build (stub
// DATABASE_URL) doesn't prerender the query.
export const dynamic = "force-dynamic";

async function loadCourse(slug: string) {
  return db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      publicTitle: true,
      tagline: true,
      description: true,
      track: true,
      level: true,
      accessTier: true,
      archivedAt: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
      // This course's prerequisites (edges where it is the dependent).
      dependentEdges: {
        select: {
          dependsOnProject: {
            select: { slug: true, name: true, publicTitle: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: { publicTitle: true, name: true, tagline: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return { title: "Course — One Thousand Drones Academy" };
  }
  const name = project.publicTitle ?? project.name;
  const title = `${name} — One Thousand Drones Academy`;
  const description =
    project.tagline ??
    `${name}: a hands-on ESP32 hardware course — schematic, layout, fabrication, and bring-up.`;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${slug}` },
    openGraph: { title, description, type: "website", url: `/courses/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadCourse(slug);

  if (!project || project.archivedAt) notFound();

  // A built course has no "preview" — send to its canonical guide outline.
  if (project.publishedRevisionId && project.publishedRevision?.label) {
    redirect(
      `/projects/${slug}/${encodeURIComponent(
        project.publishedRevision.label,
      )}/guide`,
    );
  }

  const name = project.publicTitle ?? project.name;
  const prereqs = project.dependentEdges
    .map((e) => e.dependsOnProject)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const chips = [project.track, project.level].filter(
    (c): c is NonNullable<typeof c> => Boolean(c),
  );

  const base = siteUrl();
  const courseLd = courseJsonLd({
    name,
    description: project.tagline,
    level: project.level,
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Courses", url: `${base}/courses` },
    { name, url: `${base}/courses/${slug}` },
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={courseLd} />
      <JsonLd data={breadcrumbLd} />

      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All courses
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded border border-panel-border bg-deep-space/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold"
          >
            {c}
          </span>
        ))}
        <span className="inline-flex items-center rounded border border-command-gold/40 bg-command-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
          Coming soon
        </span>
      </div>

      <h1 className="mt-3 font-display text-4xl tracking-wider text-white sm:text-5xl">
        {name}
      </h1>
      {project.tagline ? (
        <p className="mt-3 max-w-2xl font-serif text-lg italic text-gray-1">
          {project.tagline}
        </p>
      ) : null}

      {/* Waitlist capture — the demand signal + the visitor's reason to leave an
          email. Reuses the anonymous WaitlistForm (writes a per-course signup). */}
      <section className="glass-card mt-8 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
          Be first when it opens
        </p>
        <p className="mt-2 font-serif text-sm text-gray-1">
          This course is in production. Leave your email and we&apos;ll notify
          you the moment it goes live — and your interest helps decide what we
          build next.
        </p>
        <div className="mt-4">
          <WaitlistForm projectId={project.id} />
        </div>
      </section>

      {/* What you'll build — the indexable substance. Uses the authored
          description when present; otherwise a useful attribute-based summary. */}
      <section className="mt-10">
        <h2 className="font-mono text-sm uppercase tracking-wider text-gold-dim">
          What you&apos;ll build
        </h2>
        <p className="mt-3 font-serif text-base leading-relaxed text-gray-1">
          {project.description ??
            `${name} is a hands-on ESP32 hardware course. You'll take a real board from schematic through layout, fabrication, and bring-up — the same end-to-end workflow used across the One Thousand Drones Academy curriculum.`}
        </p>
      </section>

      {/* Where it fits — prerequisites pulled straight from the curriculum DAG. */}
      {prereqs.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-mono text-sm uppercase tracking-wider text-gold-dim">
            Builds on
          </h2>
          <ul className="mt-3 space-y-2">
            {prereqs.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/courses/${p.slug}`}
                  className="font-mono text-sm text-signal-blue underline"
                >
                  {p.publicTitle ?? p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 border-t border-panel-border pt-6">
        <p className="font-serif text-sm italic text-muted">
          Part of the path from your first board to a brain-computer interface.{" "}
          <Link href="/courses" className="text-signal-blue underline">
            See the full skill tree →
          </Link>
        </p>
      </section>
    </main>
  );
}
