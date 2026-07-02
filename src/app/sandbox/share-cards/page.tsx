// Share-card visual-regression gallery (graduated from the Task 2 design round).
//
// Every SHIPPED card in one place: this embeds the LIVE production opengraph-image
// routes (the real components, real data) for one sample of each surface, so a
// card regression is visible at a glance during dev. Sample slugs / ids are
// queried at render, so nothing is hardcoded to rot. Dev-only: notFound() in
// production.
//
// Design history (the 6 base families + the 10 F-watermark variations Josh chose
// FW7 from) lives in git — commits 05cc36f and 47e1ed0.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function sampleTargets() {
  const [course, guide, lesson, part] = await Promise.all([
    db.project
      .findFirst({ where: { level: { not: null } }, select: { slug: true } })
      .catch(() => null),
    db.project
      .findFirst({
        where: { publishedRevisionId: { not: null } },
        select: { slug: true, publishedRevision: { select: { label: true } } },
      })
      .catch(() => null),
    db.miniLesson
      .findFirst({
        where: { published: true, accessTier: "PUBLIC" },
        select: { slug: true },
      })
      .catch(() => null),
    db.part.findFirst({ select: { id: true } }).catch(() => null),
  ]);

  const rev = guide?.publishedRevision?.label
    ? encodeURIComponent(guide.publishedRevision.label)
    : null;

  return [
    { label: "Root default (every bare route inherits this)", url: "/opengraph-image" },
    {
      label: "Course",
      url: course ? `/courses/${course.slug}/opengraph-image` : null,
    },
    {
      label: "Guide hub",
      url: guide && rev ? `/projects/${guide.slug}/${rev}/guide/opengraph-image` : null,
    },
    {
      label: "Guide stage",
      url:
        guide && rev
          ? `/projects/${guide.slug}/${rev}/guide/SCHEMATIC/opengraph-image`
          : null,
    },
    {
      label: "Library (diagram-bearing)",
      url: lesson ? `/library/${lesson.slug}/opengraph-image` : null,
    },
    { label: "Tool (Saira readout)", url: "/tools/ws2812-power-supply/opengraph-image" },
    { label: "Part", url: part ? `/parts/${part.id}/opengraph-image` : null },
  ];
}

export default async function ShareCardsGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  const targets = await sampleTargets();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-b border-panel-border/60 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Sandbox · shipped cards
        </p>
        <h1 className="title-hero mt-3">Share cards</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The live production og:image route for one sample of every surface. This
          is the dev-only visual-regression surface for the share-card system.
          Click any card for full 1200&times;630.
        </p>
        <p className="mt-6 border-l-2 border-command-gold pl-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-gold-light">
          Baked dark artifacts · the light / dark toggle does not apply.
        </p>
      </header>

      {targets.map((t) => (
        <section key={t.label} className="mt-10 border-b border-panel-border/60 pb-10">
          <h2 className="title-card">{t.label}</h2>
          <div className="mt-4">
            {t.url ? (
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block border border-panel-border/60 transition-colors hover:border-command-gold focus-visible:border-command-gold focus-visible:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.url}
                  alt={t.label}
                  width={720}
                  height={378}
                  className="block"
                />
              </a>
            ) : (
              <p className="font-mono text-sm text-muted">
                no sample row in the DB · route exists, nothing to render
              </p>
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
