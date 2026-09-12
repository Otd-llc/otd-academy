// SANDBOX - what a per-cluster hub page could be. DEV ONLY.
//
// The Library has six clusters and no page for any of them. They exist as a
// GROUPING on the index and as a Field Guide PDF, so a cluster is currently
// something you can download but not visit. That is the gap this is testing,
// and it is a Library structure question rather than a place to put a video.
//
// REAL DATA, not a mock. It reads `listPublishedByCluster`, the same hourly
// cached row set the index and the OG routes already share, so the lesson
// counts, titles and hero diagrams below are the live ones. A mock would have
// let me design against a cluster shape that does not exist.
//
// Three arrangements, because the question is not "should this exist" alone but
// "what is it FOR". Each answers that differently:
//   A  an index that happens to be filtered   (routing)
//   B  a reference surface                    (reading)
//   C  a lesson-shaped page with a clip       (watching, then reading)
import { notFound } from "next/navigation";
import Link from "next/link";
import { LIBRARY_CLUSTERS, clusterByKey } from "@/lib/library/clusters";
import { listPublishedByCluster } from "@/lib/library/load";
import { fieldGuideLabel, fieldGuidePdfDownloadUrl } from "@/lib/library/field-guide-links";
import { ClusterLive } from "../cluster/ClusterLive";
import { CLUSTERS as CUT_SHEETS } from "../cluster/clusters";

type Lesson = { slug: string; title: string; summary: string | null };

function Rows({ list }: { list: Lesson[] }) {
  return (
    <ul className="border-t border-panel-border/60">
      {list.map((l) => (
        <li key={l.slug}>
          <Link
            href={`/library/${l.slug}`}
            className="group flex flex-col gap-1.5 border-b border-panel-border/60 py-4 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
          >
            <span className="title-card group-hover:text-gold-light">{l.title}</span>
            {l.summary ? <span className="text-sm text-muted">{l.summary}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ClusterPageSandbox({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { key } = await searchParams;
  const active = clusterByKey(key) ?? LIBRARY_CLUSTERS[0];
  // A Map, not a Record. bucketByCluster seeds every registry key up front so
  // the landing can iterate a deterministic order, which also means an empty
  // cluster is an empty array rather than a missing key.
  const buckets = await listPublishedByCluster();
  const list = ((buckets.get(active.key) ?? []) as unknown) as Lesson[];
  // A cut sheet exists for two clusters so far; the rest show the page without a clip,
  // which is also the honest default state for four of the six.
  const sheet = CUT_SHEETS.find((c) => c.id === active.key || c.label === active.label);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; SANDBOX &middot; a cluster hub, three ways
      </p>
      <h1 className="title-section mt-3">/library/cluster/{active.key}</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Real data: {list.length} published lessons in {active.label}, read from the same
        cached rows the index uses. Switch cluster with{" "}
        <code>?key=</code> and one of{" "}
        {LIBRARY_CLUSTERS.map((c) => c.key).join(", ")}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LIBRARY_CLUSTERS.map((c) => (
          <Link
            key={c.key}
            href={`/sandbox/cluster-page?key=${c.key}`}
            className={`badge ${c.key === active.key ? "border-command-gold text-command-gold" : "text-muted"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* ---------------------------------------------------------------- A */}
      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          A &middot; a filtered index
        </p>
        <p className="mt-2 max-w-3xl font-serif text-sm text-muted">
          The cheapest possible version: the index rows for one cluster, its blurb, and
          the Field Guide. It adds a URL and an H1 per cluster, which is the SEO argument,
          and almost nothing a visitor could not already get by scrolling the index. Worth
          seeing precisely because it is the version that might not be worth building.
        </p>
        <div className="mt-5">
          <h2 className="title-section">{active.label}</h2>
          <p className="mt-2 max-w-2xl font-serif text-base text-text">{active.blurb}</p>
          <div className="mt-5">
            <Rows list={list} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- B */}
      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          B &middot; a reference surface
        </p>
        <p className="mt-2 max-w-3xl font-serif text-sm text-muted">
          The cluster as a thing you consult rather than a list you pass through: a meta
          strip of what is in it, the Field Guide as the primary action, then the lessons.
          This is the shape that earns its own URL, because a person can arrive here from
          a search and leave with something.
        </p>
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            &#9656; {fieldGuideLabel(active.key)}
          </p>
          <h2 className="title-section mt-2">{active.label}</h2>
          <p className="mt-2 max-w-2xl font-serif text-base text-text">{active.blurb}</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-panel-border/60 py-4">
            <span>
              <span className="font-numeral text-3xl tabular-nums text-command-gold">
                {list.length}
              </span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                lessons
              </span>
            </span>
            <span>
              <span className="font-numeral text-3xl tabular-nums text-command-gold">
                {sheet ? sheet.beats.length : "·"}
              </span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                core ideas
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              free &middot; no account
            </span>
          </div>

          <div className="mt-5">
            <a className="glass-button-cta inline-flex px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
               href={fieldGuidePdfDownloadUrl(active.key)}>
              Download the field guide
            </a>
          </div>
          <div className="mt-6">
            <Rows list={list} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- C */}
      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          C &middot; the explainer on top
        </p>
        <p className="mt-2 max-w-3xl font-serif text-sm text-muted">
          B, with the ten second explainer as the opening. The clip is the argument for the
          page rather than the other way round: a visitor sees the four core ideas move
          before deciding to read anything. Note it only exists for two clusters so far,
          so four of the six would render section B and nothing else, which is a real
          consideration and not a detail.
        </p>
        <div className="mt-5">
          {sheet ? (
            <div className="overflow-hidden rounded-[14px] border border-panel-border/60">
              <ClusterLive
                beats={sheet.beats}
                label={sheet.label}
                payoff={sheet.payoff}
                style="term"
              />
            </div>
          ) : (
            <p className="border border-dashed border-panel-border px-5 py-8 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted">
              no cut sheet for {active.label} yet &middot; the page renders as B
            </p>
          )}
          <h2 className="title-section mt-6">{active.label}</h2>
          <p className="mt-2 max-w-2xl font-serif text-base text-text">{active.blurb}</p>
          <div className="mt-5">
            <a className="glass-button-cta inline-flex px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
               href={fieldGuidePdfDownloadUrl(active.key)}>
              Download the field guide
            </a>
          </div>
          <div className="mt-6">
            <Rows list={list} />
          </div>
        </div>
      </section>
    </main>
  );
}
