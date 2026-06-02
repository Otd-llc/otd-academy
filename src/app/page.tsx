// Project list page. Default shows only un-archived projects; `?archived=1`
// includes archived rows too. Manifest-style table per design §8.3 / §9 —
// Bebas Neue title, Space Mono columns, command-gold project names.
//
// Server component: data fetched directly via Prisma. searchParams is async
// in Next.js 16 (must be awaited).
//
// Polish §15.4: each row shows its current-state — latest revision label +
// its currentStage as a navy-dark chip pill (command-gold for the active
// stage). Sorting is by last-activity (max of project.updatedAt and the
// most-recent revision.updatedAt) so freshly-touched work surfaces first.
//
// Task 11.6: track/level filter chips + bench-tool toggle. Default hides
// non-critical-path projects (bench tools) so the dashboard surfaces the
// curriculum spine. `?track=`, `?level=`, `?showBenchTools=1`, `?archived=1`
// each independently narrow the query.
import Link from "next/link";
import { db } from "@/lib/db";

// Inline filter-chip presentational component. Each chip is a Link to a
// pre-baked URL; `active` flips the fill from outlined panel-border to
// filled command-gold per §8.3 chip anatomy.
function FilterChip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  const base =
    "inline-flex items-center glass-button px-2.5 py-1 font-mono text-xs uppercase tracking-wider";
  const activeCls = "glass-button-active";
  const inactiveCls = "hover:text-gold-light";
  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {label}
    </Link>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
    track?: string;
    level?: string;
    showBenchTools?: string;
  }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const showBenchTools = params.showBenchTools === "1";

  const TRACKS = ["SENSE", "ACT", "POWER", "COMMS"] as const;
  const LEVELS = ["L1", "L2", "L3"] as const;
  const track = TRACKS.find((t) => t === params.track);
  const level = LEVELS.find((l) => l === params.level);

  const projects = await db.project.findMany({
    where: {
      ...(showArchived ? {} : { archivedAt: null }),
      ...(track ? { track } : {}),
      ...(level ? { level } : {}),
      ...(showBenchTools ? {} : { criticalPath: true }),
    },
    include: {
      revisions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { label: true, currentStage: true, updatedAt: true },
      },
    },
  });

  // Compute last-activity as max(project.updatedAt, latestRevision.updatedAt)
  // and sort descending — most-recently-touched first. Prisma's `orderBy`
  // can't reach into the included relation, so the sort runs in memory.
  const sorted = projects
    .map((p) => {
      const latest = p.revisions[0] ?? null;
      const lastActivity = latest
        ? p.updatedAt.getTime() > latest.updatedAt.getTime()
          ? p.updatedAt
          : latest.updatedAt
        : p.updatedAt;
      return { ...p, latest, lastActivity };
    })
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl tracking-wider text-white">
          PROJECT FOUNDRY
        </h1>
        <div className="flex items-center gap-4 font-mono text-xs uppercase">
          <Link
            href={showArchived ? "/" : "/?archived=1"}
            className="text-signal-blue underline"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
          <Link
            href="/curriculum"
            className="glass-button px-4 py-2 text-signal-blue hover:text-gold-light"
          >
            CURRICULUM →
          </Link>
          <Link
            href="/projects/new"
            className="glass-button glass-button-cta px-4 py-2"
          >
            + New project
          </Link>
        </div>
      </div>

      {/*
        Filter chip row — track + level + bench-tool toggle. Each chip is a
        Link to the relevant URL; the "ALL …" chips reset just their facet
        by linking back to `/`. Chips for unrelated facets (e.g. archived)
        are intentionally left out of the URLs here: clicking a track chip
        clears any level/bench-tools state, matching the single-axis browse
        pattern from the design doc.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip label="ALL TRACKS" active={!params.track} href="/" />
        {["SENSE", "ACT", "POWER", "COMMS"].map((t) => (
          <FilterChip
            key={t}
            label={t}
            active={params.track === t}
            href={`/?track=${t}`}
          />
        ))}
        <span className="mx-2 text-muted">·</span>
        <FilterChip label="ALL LEVELS" active={!params.level} href="/" />
        {["L1", "L2", "L3"].map((l) => (
          <FilterChip
            key={l}
            label={l}
            active={params.level === l}
            href={`/?level=${l}`}
          />
        ))}
        <span className="mx-2 text-muted">·</span>
        <FilterChip
          label="SHOW BENCH TOOLS"
          active={showBenchTools}
          href={showBenchTools ? "/" : "/?showBenchTools=1"}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          NO PROJECTS — CREATE ONE TO BEGIN.
        </p>
      ) : (
        <table className="mt-10 w-full border-collapse font-mono text-sm">
          <thead>
            <tr className="border-b border-panel-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-3 pr-4 font-normal">Name</th>
              {/* Slug + Updated hidden at < md (Task 15.5 responsive pass). */}
              <th className="hidden py-3 pr-4 font-normal md:table-cell">
                Slug
              </th>
              <th className="hidden py-3 pr-4 font-normal md:table-cell">
                Updated
              </th>
              <th className="py-3 pr-4 font-normal">Current state</th>
              <th className="py-3 pr-4 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.id}
                className="border-b border-panel-border align-top"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/projects/${p.slug}`}
                    className="text-command-gold transition-colors hover:text-gold-light"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="hidden py-3 pr-4 text-muted md:table-cell">
                  {p.slug}
                </td>
                <td className="hidden py-3 pr-4 text-muted md:table-cell">
                  {p.lastActivity.toISOString().slice(0, 10)}
                </td>
                <td className="py-3 pr-4">
                  {p.latest ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/projects/${p.slug}/${encodeURIComponent(p.latest.label)}`}
                        className="text-link-muted underline-offset-2 hover:underline"
                      >
                        {p.latest.label}
                      </Link>
                      {/*
                        Stage pill — Space Mono caps on a navy-dark chip with
                        command-gold text + 1px panel-border per §8.3 pill
                        anatomy. Mirrors the active-stage treatment used in
                        the revision header strip.
                      */}
                      <span className="inline-block rounded border border-panel-border bg-navy-dark px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                        {p.latest.currentStage}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs uppercase tracking-wider text-muted">
                      NO REVISIONS
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted">
                  {p.archivedAt ? "ARCHIVED" : "ACTIVE"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
