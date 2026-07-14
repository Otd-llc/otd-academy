// Public Library index — /library.
//
// A browsable index of published, PUBLIC mini-lessons (the reference/SEO layer,
// distinct from the gated build courses). Anonymous-readable (admitted by
// `isPublicPath`); no progress/enrollment. Emits an ItemList JSON-LD over the
// published set. force-dynamic so the CI build (stub DATABASE_URL) doesn't
// prerender the DB query.
//
// Layout (design sandbox round 4, owner-picked V3): a masthead where the featured
// guide's TEXT + its own diagram sit side by side (text wider), with "New &
// updated" up in the right column. Below, a split: a sticky rail leads with the
// ALSO-featured's diagram in portrait, then its text + ITS cluster Field Guide,
// beside the deep, cluster-grouped index (titles-only serif rows). Each cluster
// header carries its Field Guide download — the targeted conversion paths; there
// is deliberately NO combined "whole Library" CTA (it would siphon clicks off the
// per-cluster grabs + lose the interest signal). Featured/also-featured diagrams
// are the lessons' OWN hero diagrams (firstDiagramSrc), rendered from a small
// static-import map so the landing ships only those, not the whole registry.
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { FieldGuideDownload } from "@/components/library/FieldGuideDownload";
import { DroneSharedAutonomy } from "@/components/guide/diagrams/DroneSharedAutonomy";
import { FundVirRelationship } from "@/components/guide/diagrams/FundVirRelationship";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { listPublishedByCluster } from "@/lib/library/load";
import { clusterByKey } from "@/lib/library/clusters";
import { loadLessonMeta, getLibraryProgress } from "@/lib/logbook/load";
import { levelFor } from "@/lib/logbook/economy";
import { LogbookIntro } from "@/components/library/LogbookIntro";
import {
  pickFeatured,
  pickFreshRail,
  type LessonMeta,
  type FreshLesson,
} from "@/lib/library/featured";

// Resolve a persisted onboarding-goal key to a goal-in-a-sentence phrase for the
// Logbook intro (design §9.1). "exploring"/"skipped"/unknown → no phrase.
const GOAL_PHRASE: Record<string, string> = {
  first_board: "building a board",
  kicad: "sharpening KiCad",
  learn: "learning the electronics",
};

// The signed-in Logbook overlay for a lesson row: today's earned / today's max XP.
type LessonXp = { earnedToday: number; maxToday: number };

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

// The hero-eligible diagrams: the featured + also-featured lessons' own diagrams,
// keyed by their contentBlocks image src. Static-import ONLY these so the landing
// ships them, not the whole 60-component diagram registry. KEEP IN SYNC with
// FEATURED_SLUGS in @/lib/library/featured — featuring a lesson whose diagram
// should show here means adding its component below (an unmapped src renders no
// diagram, a clean degrade, never a broken image).
const HERO_DIAGRAMS: Record<string, React.ComponentType<{ caption?: string }>> = {
  "/guide-diagrams/drone-shared-autonomy.svg": DroneSharedAutonomy,
  "/guide-diagrams/fund-vir-relationship.svg": FundVirRelationship,
};
function heroDiagram(src: string | null) {
  const Diagram = src ? HERO_DIAGRAMS[src] : undefined;
  // Bare here too: the featured/hero diagram sits beside its own blurb on the index,
  // so drop the frame's echoed title/eyebrow/caption. No fig number (a hero is not a
  // numbered in-lesson figure). The standalone export still renders full/titled.
  return Diagram ? (
    <DiagramChromeProvider bare fig={null}>
      <Diagram />
    </DiagramChromeProvider>
  ) : null;
}

const monthYear = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();

const num2 = (n: number) => String(n).padStart(2, "0");

// The read-time readout: an estimate (not a measured metric) that sets the
// "short read" expectation to lift click-through. Saira numeral + mono "min".
function ReadMin({ minutes }: { minutes: number }) {
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      <span className="font-numeral tabular-nums text-xs text-command-gold">{minutes}</span> min
    </span>
  );
}

// A titles-only index row in the serif reading face, hairline-ruled. The whole
// row is the link; per-row summary/stamp live on each lesson's own page. The
// read-time sits on the right as the row's affordance + merchandising nudge.
function LibraryRow({
  lesson,
  xp,
}: {
  lesson: { slug: string; title: string; readingMinutes: number };
  xp?: LessonXp;
}) {
  return (
    <li>
      <Link
        href={`/library/${lesson.slug}`}
        className="group flex items-baseline justify-between gap-4 border-b border-panel-border/60 py-2.5 transition-colors hover:bg-command-gold/[0.05] focus-visible:bg-command-gold/[0.07] focus-visible:outline-none"
      >
        <span className="font-serif text-[15px] leading-snug text-text transition-colors group-hover:text-command-gold">
          {lesson.title}
        </span>
        <span className="flex shrink-0 items-baseline gap-2.5">
          {xp ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              <span className="font-numeral tabular-nums text-command-gold">{xp.earnedToday}</span>
              /{xp.maxToday} XP
            </span>
          ) : null}
          <ReadMin minutes={lesson.readingMinutes} />
        </span>
      </Link>
    </li>
  );
}

// The masthead lead: the flagship guide's TEXT (Bebas title, serif dek, mono
// meta) with a read CTA + the guide's cluster Field Guide. Its diagram sits
// BESIDE this in the masthead. No filled card; it sits on the bare field.
// V2c masthead (2026-07-14): the "▸ Featured guide" eyebrow labels the bare hero
// diagram (a banner), then the Bebas title / Lora blurb / meta / CTA read beneath
// it. `diagram` is the bare hero (null when the featured lesson's src is not in
// HERO_DIAGRAMS — then it's just eyebrow → title, a clean degrade).
function FeaturedLead({
  lesson,
  signedIn,
  diagram,
}: {
  lesson: LessonMeta;
  signedIn: boolean;
  diagram?: React.ReactNode;
}) {
  const cluster = clusterByKey(lesson.cluster);
  return (
    <div className="space-y-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Featured guide
      </p>
      {diagram ? <div>{diagram}</div> : null}
      <div className="space-y-4">
        <h2>
          <Link
            href={`/library/${lesson.slug}`}
            className="font-display text-4xl font-normal leading-[0.95] tracking-wide text-title transition-colors hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none"
          >
            {lesson.title}
          </Link>
        </h2>
        {lesson.summary ? (
          <p className="font-serif text-[15px] leading-relaxed text-text">{lesson.summary}</p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {cluster ? (
            <>
              <span>{cluster.label}</span>
              <span className="text-command-gold">·</span>
            </>
          ) : null}
          <span>
            <span className="font-numeral tabular-nums text-command-gold">
              {lesson.readingMinutes}
            </span>{" "}
            min read
          </span>
          <span className="text-command-gold">·</span>
          <span>Updated {monthYear(lesson.updatedAt)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/library/${lesson.slug}`}
            className="glass-button-cta inline-flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Read the guide
            <span aria-hidden>→</span>
          </Link>
          {cluster ? (
            <FieldGuideDownload
              guide={cluster.key}
              label={`${cluster.label} Field Guide`}
              name={`the ${cluster.label} Field Guide`}
              signedIn={signedIn}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// The also-featured, living in the sticky rail beneath its portrait diagram: a
// second flagship from a different cluster, carrying ITS cluster Field Guide (a
// targeted conversion path, mirroring the featured lead).
function RailAlso({ lesson, signedIn }: { lesson: LessonMeta; signedIn: boolean }) {
  const cluster = clusterByKey(lesson.cluster);
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold-dim">
        {cluster ? `${cluster.label} · also featured` : "Also featured"}
      </p>
      <h3 className="mt-1.5">
        <Link
          href={`/library/${lesson.slug}`}
          className="font-display text-2xl font-normal leading-tight tracking-wide text-title transition-colors hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none"
        >
          {lesson.title}
        </Link>
      </h3>
      {lesson.summary ? (
        <p className="mt-2 font-serif text-sm leading-relaxed text-muted">{lesson.summary}</p>
      ) : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <span>
          <span className="font-numeral tabular-nums text-command-gold">{lesson.readingMinutes}</span> min
        </span>
        <span className="text-command-gold">·</span>
        <span>Updated {monthYear(lesson.updatedAt)}</span>
      </p>
      {cluster ? (
        <div className="mt-4">
          <FieldGuideDownload
            guide={cluster.key}
            label={`${cluster.label} Field Guide`}
            name={`the ${cluster.label} Field Guide`}
            signedIn={signedIn}
          />
        </div>
      ) : null}
    </div>
  );
}

// The sticky-rail "new & updated" list (moved up into the masthead's right
// column): freshest guides across the clusters, each tagged NEW (never revised
// since publish) or UPD (edited after publish).
function FreshRail({ items }: { items: FreshLesson[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ New &amp; updated
      </p>
      <ul>
        {items.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/library/${l.slug}`}
              className="group flex items-baseline justify-between gap-3 border-b border-panel-border/50 py-2 transition-colors hover:bg-command-gold/[0.05] focus-visible:bg-command-gold/[0.07] focus-visible:outline-none"
            >
              <span className="font-serif text-[13px] leading-snug text-text transition-colors group-hover:text-command-gold">
                {l.title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  <span className="font-numeral tabular-nums text-command-gold">{l.readingMinutes}</span> min
                </span>
                <span
                  className={`border px-1 py-px font-mono text-[8px] uppercase tracking-[0.16em] ${
                    l.freshTag === "NEW"
                      ? "border-status-green/50 text-status-green"
                      : "border-command-gold/50 text-command-gold"
                  }`}
                >
                  {l.freshTag}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One cluster's block in the deep index: a header (ordinal + Bebas label + blurb
// + count + Field Guide) over a two-column serif row list. The "other" bucket
// (no registry entry) renders as a trailing catch-all with no ordinal/download.
function ClusterSection({
  ordinal,
  clusterKey,
  list,
  signedIn,
  xpBySlug,
  clusterStat,
}: {
  ordinal: number | null;
  clusterKey: string;
  list: { slug: string; title: string; readingMinutes: number }[];
  signedIn: boolean;
  xpBySlug?: Map<string, LessonXp>;
  clusterStat?: { done: number; total: number };
}) {
  const cluster = clusterByKey(clusterKey);
  return (
    <section className="mb-11">
      <div className="flex flex-col gap-3 border-b border-command-gold/30 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {ordinal !== null ? (
            <span className="font-mono text-[10px] tracking-[0.18em] text-gold-dim">
              <span className="font-numeral tabular-nums">{num2(ordinal)}</span>
            </span>
          ) : null}
          <h2 className="mt-0.5 font-display text-2xl font-normal tracking-wide text-title">
            {cluster ? cluster.label : "More guides"}
          </h2>
          {cluster ? (
            <p className="mt-1 max-w-xl font-serif text-sm text-muted">{cluster.blurb}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {clusterStat ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              <span className="font-numeral tabular-nums text-sm text-command-gold">
                {clusterStat.done} / {clusterStat.total}
              </span>{" "}
              done
            </span>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            <span className="font-numeral tabular-nums text-sm text-command-gold">
              {list.length}
            </span>{" "}
            {list.length === 1 ? "guide" : "guides"}
          </span>
          {cluster ? (
            <FieldGuideDownload
              guide={cluster.key}
              label="Field Guide"
              name={`the ${cluster.label} Field Guide`}
              signedIn={signedIn}
            />
          ) : null}
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {list.map((l) => (
          <LibraryRow key={l.slug} lesson={l} xp={xpBySlug?.get(l.slug)} />
        ))}
      </ul>
    </section>
  );
}

export default async function LibraryIndexPage() {
  const buckets = await listPublishedByCluster();
  const base = siteUrl();
  // Field-guide downloads are account-gated (the compiled books are the lead
  // magnet); a signed-in reader gets a one-click email, everyone else a prompt.
  const session = await auth();
  const signedIn = Boolean(session?.user);

  // Signed-in Logbook overlay (design §9). STRICTLY ADDITIVE: the anonymous index
  // stays byte-for-byte the shipped #293 layout. When signed in we load progress
  // (one batched read) + the header chip + the one-time intro flag.
  let xpBySlug: Map<string, LessonXp> | null = null;
  let clusterStats: Map<string, { done: number; total: number }> | null = null;
  let logbookChip: { level: number; xpTotal: number } | null = null;
  let showIntro = false;
  let goalPhrase: string | null = null;
  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        xpTotal: true,
        logbookIntroSeenAt: true,
        onboardingGoal: true,
      },
    });
    if (user) {
      const lessons = await loadLessonMeta();
      const progress = await getLibraryProgress(user.id, lessons, new Date());
      xpBySlug = progress.byLesson;
      clusterStats = progress.byCluster;
      logbookChip = { level: levelFor(user.xpTotal).level, xpTotal: user.xpTotal };
      showIntro = user.logbookIntroSeenAt == null;
      goalPhrase = GOAL_PHRASE[user.onboardingGoal ?? ""] ?? null;
    }
  }

  // Flatten cluster-major (registry order, then the trailing "other" bucket) for
  // the ItemList JSON-LD, the catalog stats, and the merchandising helpers.
  const allLessons = [...buckets.values()].flat() as LessonMeta[];
  // Only render non-empty buckets; an empty registry cluster shows nothing, and
  // "other" only appears if a null-cluster row exists.
  const sections = [...buckets.entries()].filter(([, list]) => list.length > 0);
  const clusterCount = sections.filter(([key]) => clusterByKey(key)).length;

  const listLd = courseListJsonLd(
    allLessons.map((l) => ({ name: l.title, url: `${base}/library/${l.slug}` })),
  );

  // Explicit max over EVERY lesson's updatedAt — the flat list is cluster-major,
  // not freshness-ordered, so row[0] would print a stale stamp.
  const lastUpdated = allLessons.reduce<Date | undefined>(
    (max, l) => (!max || l.updatedAt > max ? l.updatedAt : max),
    undefined,
  );

  const featured = pickFeatured(allLessons);
  const lead = featured[0];
  const also = featured[1];
  const fresh = pickFreshRail(allLessons);

  const leadDiagram = lead ? heroDiagram(lead.diagramSrc) : null;
  const alsoDiagram = also ? heroDiagram(also.diagramSrc) : null;

  // Running ordinal for registry clusters only ("other" gets none).
  let ordinal = 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={listLd} />
      <PageHeader
        eyebrow="LIBRARY"
        title="Reference guides"
        lead="Concept explainers across six clusters: the ideas behind the builds. Free to read, no account needed."
        meta={
          allLessons.length > 0
            ? [
                {
                  label: "Guides",
                  value: (
                    <span className="font-numeral tabular-nums text-command-gold">
                      {allLessons.length}
                    </span>
                  ),
                },
                {
                  label: "Clusters",
                  value: (
                    <span className="font-numeral tabular-nums text-command-gold">
                      {clusterCount}
                    </span>
                  ),
                },
                ...(lastUpdated ? [{ label: "Updated", value: monthYear(lastUpdated) }] : []),
                ...(logbookChip
                  ? [
                      {
                        label: "Logbook",
                        value: (
                          <Link
                            href="/logbook"
                            className="text-text transition-colors hover:text-command-gold"
                          >
                            FL{logbookChip.level} ·{" "}
                            <span className="font-numeral tabular-nums text-command-gold">
                              {logbookChip.xpTotal}
                            </span>{" "}
                            XP
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      {signedIn && showIntro ? <LogbookIntro goalPhrase={goalPhrase} /> : null}

      {allLessons.length === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          The Library is coming soon.
        </p>
      ) : (
        <>
          {/* Masthead: featured (eyebrow → diagram banner → text) | New & updated. */}
          {lead ? (
            <div className="grid items-start gap-8 lg:grid-cols-[1.55fr_1fr]">
              <FeaturedLead lesson={lead} signedIn={signedIn} diagram={leadDiagram} />
              {fresh.length > 0 ? <FreshRail items={fresh} /> : null}
            </div>
          ) : null}

          <div className="title-rule my-10" aria-hidden />

          {/* Split: sticky rail (portrait also-featured) + deep cluster index. */}
          <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
            {also ? (
              <aside className="space-y-6 self-start lg:sticky lg:top-24">
                {alsoDiagram ? <div>{alsoDiagram}</div> : null}
                <RailAlso lesson={also} signedIn={signedIn} />
              </aside>
            ) : null}

            <div>
              {sections.map(([key, list]) => {
                const isRegistry = Boolean(clusterByKey(key));
                const ord = isRegistry ? ++ordinal : null;
                return (
                  <ClusterSection
                    key={key}
                    ordinal={ord}
                    clusterKey={key}
                    list={list}
                    signedIn={signedIn}
                    xpBySlug={xpBySlug ?? undefined}
                    clusterStat={clusterStats?.get(key)}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
