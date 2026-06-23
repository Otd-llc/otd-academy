// Public Library index — /library (plan A8).
//
// A browsable list of published, PUBLIC mini-lessons (the reference/SEO layer,
// distinct from the gated build courses). Anonymous-readable (admitted by
// `isPublicPath`); no progress/enrollment. Emits an ItemList JSON-LD over the
// published set. force-dynamic so the CI build (stub DATABASE_URL) doesn't
// prerender the DB query.
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { listPublishedMiniLessons } from "@/lib/library/load";

const title = "Library — One Thousand Drones Academy";
const description =
  "Reference explainers and concept guides — EEG, BCIs, and the electronics behind the build. Free, no account needed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/library" },
  openGraph: { title, description, type: "website", url: "/library" },
  twitter: { card: "summary_large_image", title, description },
};

export const dynamic = "force-dynamic";

export default async function LibraryIndexPage() {
  const lessons = await listPublishedMiniLessons();
  const base = siteUrl();

  const listLd = courseListJsonLd(
    lessons.map((l) => ({ name: l.title, url: `${base}/library/${l.slug}` })),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd data={listLd} />
      <PageHeader
        eyebrow="LIBRARY"
        title="Reference Library"
        accentWord="Library"
        lead="Concept explainers and reference guides — the ideas behind the builds. Free to read, no account needed."
      />

      {lessons.length === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          The Library is coming soon.
        </p>
      ) : (
        <ul className="space-y-4">
          {lessons.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/library/${l.slug}`}
                className="glass-card group block p-5 transition-colors hover:border-command-gold/50"
              >
                <p className="font-display text-2xl tracking-wide text-white transition-colors group-hover:text-command-gold">
                  {l.title}
                </p>
                {l.summary ? (
                  <p className="mt-2 font-serif text-sm italic text-muted">
                    {l.summary}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
