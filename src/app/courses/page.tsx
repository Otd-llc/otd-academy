// Public course library (Task A6 / public-lessons-seo plan).
//
// /courses — an anonymous-readable index of the PUBLIC flagship courses. This is
// the top of the free funnel: the only projects shown are those flagged
// `accessTier: "PUBLIC"` AND published (publishedRevisionId set) AND not
// archived. Each card deep-links to that project's guide hub at its PUBLISHED
// revision label, which is itself a public-eligible route (the guide page
// enforces accessTier; PUBLIC projects are readable signed-out).
//
// Server component (RSC): data fetched directly via Prisma, no auth gate — the
// route is admitted by `isPublicPath` and must render for anonymous visitors.
//
// SEO metadata + JSON-LD (ItemList) for this page land in PR B; this task only
// renders the page.

import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

// SEO. Static-ish — the courses index is a stable funnel landing page. JSON-LD
// (ItemList) + OG image land in later tasks (B2 / B3).
const title = "Courses — One Thousand Drones Academy";
const description =
  "Hands-on hardware courses you can follow start to finish — schematic, layout, fabrication, and bring-up. No account required to read along.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/courses" },
  openGraph: { title, description, type: "website", url: "/courses" },
  twitter: { card: "summary_large_image", title, description },
};

// DB-backed + public (no `auth()` to opt it dynamic): force request-time
// rendering so the CI build (stub DATABASE_URL) doesn't prerender the DB query.
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await db.project.findMany({
    where: {
      accessTier: "PUBLIC",
      publishedRevisionId: { not: null },
      archivedAt: null,
    },
    select: {
      slug: true,
      name: true,
      description: true,
      track: true,
      level: true,
      publishedRevision: { select: { label: true } },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  // ItemList JSON-LD — the public course index as an ordered list, each item an
  // absolute URL to that course's published guide hub. Built from the same rows
  // the grid renders (skipping any anomalous row missing a published label).
  const base = siteUrl();
  const courseListLd = courseListJsonLd(
    courses.flatMap((course) =>
      course.publishedRevision?.label
        ? [
            {
              name: course.name,
              url: `${base}/projects/${course.slug}/${encodeURIComponent(
                course.publishedRevision.label,
              )}/guide`,
            },
          ]
        : [],
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={courseListLd} />
      <PageHeader
        eyebrow="COURSES"
        title="Build it for real"
        accentWord="real"
        lead="Hands-on hardware courses you can follow start to finish — schematic, layout, fabrication, and bring-up — no account required to read along."
      />

      {courses.length === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          Courses are coming soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            // PUBLIC courses are always published (the query filters on
            // publishedRevisionId), so publishedRevision is non-null here, but
            // guard for the type and skip any anomalous row defensively.
            const label = course.publishedRevision?.label;
            if (!label) return null;
            const guideHref = `/projects/${course.slug}/${encodeURIComponent(
              label,
            )}/guide`;
            const chips = [course.track, course.level].filter(
              (c): c is NonNullable<typeof c> => Boolean(c),
            );
            return (
              <Link
                key={course.slug}
                href={guideHref}
                className="glass-card flex flex-col gap-3 p-5 transition-colors hover:bg-command-gold/5"
              >
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded border border-panel-border bg-deep-space/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                <span className="font-display text-2xl tracking-wider text-white">
                  {course.name}
                </span>
                {course.description ? (
                  <span className="font-serif text-sm italic text-muted">
                    {course.description}
                  </span>
                ) : null}
                <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal-blue">
                  Start the build
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
