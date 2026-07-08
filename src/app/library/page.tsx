// Public Library index — /library (plan A8).
//
// A browsable index of published, PUBLIC mini-lessons (the reference/SEO layer,
// distinct from the gated build courses). Anonymous-readable (admitted by
// `isPublicPath`); no progress/enrollment. Emits an ItemList JSON-LD over the
// published set. force-dynamic so the CI build (stub DATABASE_URL) doesn't
// prerender the DB query.
//
// Presented as a reference index, not a blog roll: a hairline-ruled catalog of
// entries, each carrying its own "updated" stamp (freshness is real signal for a
// reference work, and honest E-E-A-T for search). No honeycomb here — that motif
// marks the official-document surfaces (verify / briefs / license); the Library
// stays a clean index.
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { DownloadPdfLink } from "@/components/library/DownloadPdfLink";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { listPublishedByCluster } from "@/lib/library/load";
import { clusterByKey } from "@/lib/library/clusters";

const title = "Library · One Thousand Drones Academy";
const description =
  "Reference explainers and concept guides: EEG, BCIs, and the electronics behind the build. Free, no account needed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/library" },
  openGraph: { title, description, type: "website", url: "/library" },
  twitter: { card: "summary_large_image", title, description },
};

export const dynamic = "force-dynamic";

const monthYear = (d: Date) =>
  d
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();

type LessonRow = {
  slug: string;
  title: string;
  summary: string | null;
  updatedAt: Date;
};

function LibraryRow({ lesson }: { lesson: LessonRow }) {
  return (
    <li>
      <Link
        href={`/library/${lesson.slug}`}
        className="group grid gap-x-8 gap-y-2 border-b border-panel-border py-5 transition-colors hover:bg-command-gold/[0.03] sm:grid-cols-[1fr_auto]"
      >
        <div className="min-w-0">
          <p className="title-card transition-colors group-hover:text-command-gold">
            {lesson.title}
          </p>
          {lesson.summary ? (
            <p className="mt-1.5 max-w-2xl font-serif text-sm leading-snug text-muted">
              {lesson.summary}
            </p>
          ) : null}
        </div>
        <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
            Updated {monthYear(lesson.updatedAt)}
          </span>
          <span className="whitespace-nowrap font-mono text-xs uppercase tracking-wider text-command-gold">
            Read →
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function LibraryIndexPage() {
  const buckets = await listPublishedByCluster();
  const base = siteUrl();

  // Flatten cluster-major (registry order, then the trailing "other" bucket) for
  // the ItemList JSON-LD + the catalog stats.
  const allLessons = [...buckets.values()].flat();
  // Only render non-empty buckets; an empty registry cluster (e.g. before its
  // first lesson publishes) shows nothing, and "other" only appears if a
  // null-cluster row exists.
  const sections = [...buckets.entries()].filter(([, list]) => list.length > 0);

  const listLd = courseListJsonLd(
    allLessons.map((l) => ({ name: l.title, url: `${base}/library/${l.slug}` })),
  );

  // Explicit max over EVERY lesson's updatedAt — not allLessons[0]. The flat list
  // is cluster-major, not freshness-ordered, so row[0] would print a stale stamp.
  const lastUpdated = allLessons.reduce<Date | undefined>(
    (max, l) => (!max || l.updatedAt > max ? l.updatedAt : max),
    undefined,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd data={listLd} />
      <PageHeader
        eyebrow="LIBRARY"
        title="Reference Guides"
        accentWord="Reference"
        lead="Concept explainers and reference guides: the ideas behind the builds. Free to read, no account needed."
      />

      {allLessons.length === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          The Library is coming soon.
        </p>
      ) : (
        <>
          {/* Catalog bar — how many entries, how fresh, and the full-Library book. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-command-gold/30 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            <span>
              <span className="text-command-gold">{allLessons.length}</span>{" "}
              {allLessons.length === 1 ? "entry" : "entries"}
            </span>
            {lastUpdated ? <span>Updated {monthYear(lastUpdated)}</span> : null}
          </div>

          <div className="mt-4 flex justify-end">
            <DownloadPdfLink
              href="/library/field-guide/pdf"
              label="Download the full Library (PDF)"
            />
          </div>

          {sections.map(([key, list]) => {
            // A registry cluster gets its label, blurb, and its own Field Guide
            // download; the "other" bucket (clusterByKey → undefined) renders as a
            // trailing catch-all with NO download (its rows aren't addressable by
            // the [cluster] route, so a button would always 404).
            const cluster = clusterByKey(key);
            return (
              <section key={key} className="mt-12">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-command-gold/30 pb-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-normal tracking-wide text-title">
                      {cluster ? cluster.label : "More guides"}
                    </h2>
                    {cluster ? (
                      <p className="mt-1 max-w-2xl font-serif text-sm text-muted">
                        {cluster.blurb}
                      </p>
                    ) : null}
                  </div>
                  {cluster ? (
                    <DownloadPdfLink
                      href={`/library/field-guide/${cluster.key}/pdf`}
                      label={`Download ${cluster.label} Field Guide (PDF)`}
                    />
                  ) : null}
                </div>
                <ul>
                  {list.map((l) => (
                    <LibraryRow key={l.slug} lesson={l} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
