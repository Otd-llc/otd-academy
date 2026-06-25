// Public brief page — /briefs/[key].
//
// Two static, gate-less, crawlable one-pagers (`overview` and `learner`). All
// copy and facts come from src/lib/brief-pages.ts (verbatim from the academy
// sales kit); there is NO database behind these pages. Each emits TechArticle +
// Breadcrumb JSON-LD and carries down-funnel CTAs.
//
// Aesthetic matches the rest of the public surface: PageHeader (bench hero),
// glass cards, a compact responsive system-map element, and the four headline
// proof stats. Voice is absolute: no em-dashes, sentence-case headers.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { breadcrumbJsonLd, techArticleJsonLd, siteUrl } from "@/lib/seo/jsonld";
import {
  BRIEF_KEYS,
  PROOF_STATS,
  SYSTEM_MAP,
  getBrief,
} from "@/lib/brief-pages";

// Pure static data, no DB. Pre-render both keys at build time.
export const dynamic = "force-static";

export function generateStaticParams() {
  return BRIEF_KEYS.map((key) => ({ key }));
}

type Params = { key: string };

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

// Section heading: a mono gold rule + caps label, same idiom as /courses.
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
      <span className="h-px w-6 bg-command-gold/50" />
      {children}
    </h2>
  );
}

// A thin connector between diagram tiers, optionally carrying a label.
function Flow({ label }: { label?: string }) {
  return (
    <div className="my-5 flex flex-col items-center" aria-hidden="true">
      <span className="h-6 w-px bg-gradient-to-b from-command-gold/60 to-panel-border" />
      {label ? (
        <>
          <span className="my-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-muted">
            {label}
          </span>
          <span className="h-6 w-px bg-gradient-to-b from-panel-border to-command-gold/60" />
        </>
      ) : null}
    </div>
  );
}

// The curriculum system map: the ESP32-S3 platform fans into four tracks that
// converge on the two capstones (the "many machines, one mind" shape). A
// restrained diagram with hairline connectors; the meaningful nodes (platform,
// capstones) carry the single gold accent, the tracks stay neutral.
function SystemMap() {
  return (
    <figure
      className="mt-6 rounded-2xl border border-panel-border bg-bg-2/30 p-6 sm:p-9"
      aria-label="The ESP32-S3 platform fans into four tracks that converge on two capstones"
    >
      {/* Platform */}
      <div className="flex flex-col items-center text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          Platform
        </span>
        <div className="mt-2.5 rounded-lg border border-command-gold/50 bg-command-gold/[0.06] px-7 py-3">
          <p className="font-display text-2xl tracking-wide text-white">
            {SYSTEM_MAP.root.label}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {SYSTEM_MAP.root.sub}
          </p>
        </div>
      </div>

      <Flow />

      {/* Four tracks */}
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
        Four tracks
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SYSTEM_MAP.tracks.map((t) => (
          <li
            key={t.code}
            className="rounded-lg border border-panel-border bg-deep-space/50 p-4"
          >
            <p className="font-mono text-sm uppercase tracking-[0.15em] text-command-gold">
              {t.code}
            </p>
            <p className="mt-1.5 font-serif text-xs leading-snug text-gray-2">
              {t.blurb}
            </p>
          </li>
        ))}
      </ul>

      <Flow label="Converge on" />

      {/* Two capstones */}
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
        Two capstones
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SYSTEM_MAP.capstones.map((c) => (
          <li
            key={c.code}
            className="rounded-lg border border-command-gold/40 bg-command-gold/[0.05] p-4"
          >
            <p className="font-mono text-sm uppercase tracking-[0.15em] text-command-gold">
              {c.code}
            </p>
            <p className="mt-1.5 font-serif text-xs leading-snug text-gray-2">
              {c.blurb}
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
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

      <PageHeader
        backHref="/briefs"
        backLabel="Briefs"
        eyebrow={brief.eyebrow}
        title={brief.title}
        accentWord={brief.accentWord}
        lead={brief.lead}
        meta={brief.meta}
      />

      {/* Value proposition */}
      <section>
        <SectionHead>{brief.valueHeading}</SectionHead>
        <div className="mt-4 space-y-4">
          {brief.valueBody.map((p, i) => (
            <p
              key={i}
              className="max-w-2xl font-serif text-lg leading-relaxed text-gray-1"
            >
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* System map */}
      <section className="mt-12">
        <SectionHead>The curriculum, at a glance</SectionHead>
        <SystemMap />
      </section>

      {/* Proof stats */}
      <section className="mt-12">
        <SectionHead>By the numbers</SectionHead>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-panel-border bg-panel-border/40 lg:grid-cols-4">
          {PROOF_STATS.map((s) => (
            <div key={s.value} className="bg-deep-space/80 px-4 py-4">
              <dt className="font-display text-3xl tracking-wide text-command-gold">
                {s.value}
              </dt>
              <dd className="mt-1 font-serif text-xs leading-snug text-muted">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Proof points / differentiators */}
      <section className="mt-12">
        <SectionHead>{brief.proofHeading}</SectionHead>
        <ul className="mt-4 space-y-3">
          {brief.proofPoints.map((pt) => (
            <li
              key={pt.lead}
              className="rounded border border-panel-border bg-deep-space/40 px-4 py-3"
            >
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                {pt.lead}
              </p>
              <p className="mt-1.5 max-w-2xl font-serif text-base leading-relaxed text-muted">
                {pt.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="glass-card mt-12 border-command-gold/30 p-6 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
          ▸ Next step
        </p>
        <p className="mt-2 max-w-2xl font-serif text-base text-gray-1">
          {brief.key === "learner"
            ? "Start with the first board. It is free, no account required to read it, and it walks you through the full workflow."
            : "See the full skill tree of 22 boards, or check the one-time pricing. Level 1 is free."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
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
        </div>
      </section>

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
