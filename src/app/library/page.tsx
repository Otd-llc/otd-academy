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
import { listPublishedMiniLessons } from "@/lib/library/load";

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

export default async function LibraryIndexPage() {
  const lessons = await listPublishedMiniLessons();
  const base = siteUrl();

  const listLd = courseListJsonLd(
    lessons.map((l) => ({ name: l.title, url: `${base}/library/${l.slug}` })),
  );

  // Lessons arrive sorted by updatedAt desc, so the first is the freshest.
  const lastUpdated = lessons[0]?.updatedAt;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd data={listLd} />
      <PageHeader
        eyebrow="LIBRARY"
        title="Reference Guides"
        accentWord="Reference"
        lead="Concept explainers and reference guides: the ideas behind the builds. Free to read, no account needed."
      />

      {lessons.length === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          The Library is coming soon.
        </p>
      ) : (
        <>
          {/* Index bar — catalog framing: how many entries, how fresh. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-command-gold/30 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            <span>
              <span className="text-command-gold">{lessons.length}</span>{" "}
              {lessons.length === 1 ? "entry" : "entries"}
            </span>
            {lastUpdated ? <span>Updated {monthYear(lastUpdated)}</span> : null}
          </div>

          <div className="mt-4 flex justify-end">
            <DownloadPdfLink
              href="/library/field-guide/pdf"
              label="Download field guide (PDF)"
            />
          </div>

          <ul>
            {lessons.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/library/${l.slug}`}
                  className="group grid gap-x-8 gap-y-2 border-b border-panel-border py-5 transition-colors hover:bg-command-gold/[0.03] sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <p className="title-card transition-colors group-hover:text-command-gold">
                      {l.title}
                    </p>
                    {l.summary ? (
                      <p className="mt-1.5 max-w-2xl font-serif text-sm leading-snug text-muted">
                        {l.summary}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
                    <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                      Updated {monthYear(l.updatedAt)}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs uppercase tracking-wider text-command-gold">
                      Read →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
