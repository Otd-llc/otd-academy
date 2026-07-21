// Project list page. Default shows only un-archived projects; `?archived=1`
// includes archived rows too. Manifest-style table per design §8.3 / §9 —
// Bebas Neue title, Space Mono columns, command-gold project names.
//
// Server component: data fetched directly via Prisma. searchParams is async
// in Next.js 16 (must be awaited).
//
// Polish §15.4: each row shows its current-state — latest revision label +
// its currentStage as a hairline chip (command-gold for the active
// stage). Sorting is by last-activity (max of project.updatedAt and the
// most-recent revision.updatedAt) so freshly-touched work surfaces first.
//
// Task 11.6: track/level filter chips + bench-tool toggle. Default hides
// non-critical-path projects (bench tools) so the dashboard surfaces the
// curriculum spine. `?track=`, `?level=`, `?showBenchTools=1`, `?archived=1`
// each independently narrow the query.
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { learnerLandingPath } from "@/lib/learner-landing";
import { PlusIcon } from "@/components/icons";
import { assessLessonReadiness } from "@/lib/lesson-readiness";
import { countUnbuildable } from "@/lib/part-availability";
import { isGolden } from "@/lib/golden-reference";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";
import {
  collectEmptyMedia,
  emptyMediaCount,
} from "@/lib/guide-media-queue";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

// Per-project pipeline summary for the operator dashboard: the readiness state
// (from the latest revision's guide), how many media slots still need shooting,
// and how many people are waiting on the course.
//
// "golden" is the top tier (WS5): published AND vetted — the board is a proven
// golden reference, not merely content-vetted. A "vetted" board whose revision
// isn't published yet stays on the vetted rung.
type PipelineState =
  | "none"
  | "not-ready"
  | "publishable"
  | "vetted"
  | "golden";

const PIPELINE_CHIP: Record<
  Exclude<PipelineState, "none">,
  { label: string; cls: string }
> = {
  "not-ready": {
    label: "Not ready",
    cls: "border-alert-red/50 text-alert-red",
  },
  publishable: {
    label: "Publishable",
    cls: "border-command-gold/50 text-command-gold",
  },
  vetted: { label: "Vetted", cls: "border-status-green/50 text-status-green" },
  golden: {
    label: "★ Golden",
    cls: "border-command-gold bg-command-gold/15 text-command-gold",
  },
};

function PipelineBadges({
  state,
  captureCount,
  waitlist,
  unbuildable,
}: {
  state: PipelineState;
  captureCount: number;
  waitlist: number;
  unbuildable: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state !== "none" ? (
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${PIPELINE_CHIP[state].cls}`}
        >
          {PIPELINE_CHIP[state].label}
        </span>
      ) : null}
      {captureCount > 0 ? (
        <span
          title={`${captureCount} media slot${captureCount === 1 ? "" : "s"} to capture`}
          className="inline-flex items-center rounded border border-panel-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted"
        >
          📷 {captureCount}
        </span>
      ) : null}
      {waitlist > 0 ? (
        <span
          title={`${waitlist} on the waitlist`}
          className="inline-flex items-center rounded border border-signal-blue/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-signal-blue"
        >
          ☆ {waitlist}
        </span>
      ) : null}
      {unbuildable > 0 ? (
        <span
          title={`${unbuildable} part(s) out-of-stock/EOL at DigiKey in the published BOM`}
          className="inline-flex items-center rounded border border-alert-red/50 bg-alert-red/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-alert-red"
        >
          ⚠ {unbuildable} unbuildable
        </span>
      ) : null}
    </div>
  );
}

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
  // Role-aware landing: "/" is the admin dashboard. A signed-in LEARNER is
  // routed into the learner flow instead — first-timers are auto-enrolled in
  // WROOM L1 and dropped into card 1; returning learners go to /learn.
  const session = await auth();
  const email = session?.user?.email;
  // Signed-out visitors land on the public, crawlable course catalog — never a
  // sign-in wall at the domain root (this page is the operator dashboard).
  if (!email) {
    redirect("/courses");
  }
  const me = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (me?.role === "LEARNER") {
    redirect(await learnerLandingPath(me.id));
  }

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
      exam: { select: { questions: true } },
      _count: { select: { waitlist: true } },
      revisions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          label: true,
          currentStage: true,
          updatedAt: true,
          // Latest revision's guide + brought-up boards feed the per-project
          // readiness pill (admin pipeline overview). Admin-only page, ~dozens
          // of rows, so loading contentBlocks here is acceptable.
          guide: {
            select: { cards: { select: { stage: true, contentBlocks: true } } },
          },
          builds: {
            select: {
              boards: {
                where: { status: "BROUGHT_UP" },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  // Watchdog (V7): count unbuildable parts per published-revision BOM in ONE
  // batched query across every listed project — no per-project N+1 in the render
  // loop. Group the lines by revision, then assess each revision's buildability.
  const publishedRevIds = projects
    .map((p) => p.publishedRevisionId)
    .filter((id): id is string => id != null);
  const watchdogLines = publishedRevIds.length
    ? await db.bomLine.findMany({
        where: { revisionId: { in: publishedRevIds } },
        select: {
          revisionId: true,
          part: {
            select: {
              lifecycle: true,
              dkInStock: true,
              dkLifecycle: true,
              dkCheckedAt: true,
            },
          },
        },
      })
    : [];
  const now = new Date();
  const linesByRev = new Map<string, (typeof watchdogLines)[number]["part"][]>();
  for (const l of watchdogLines) {
    const arr = linesByRev.get(l.revisionId) ?? [];
    arr.push(l.part);
    linesByRev.set(l.revisionId, arr);
  }
  const unbuildableByRev = new Map<string, number>();
  for (const [revId, parts] of linesByRev) {
    unbuildableByRev.set(
      revId,
      countUnbuildable(
        parts.map((part) => ({
          dkInStock: part.dkInStock,
          dkLifecycle: part.dkLifecycle,
          dkCheckedAt: part.dkCheckedAt,
          curatedLifecycle: part.lifecycle,
        })),
        now,
      ),
    );
  }

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

      // Pipeline summary from the latest revision's guide (if any).
      let pipelineState: PipelineState = "none";
      let captureCount = 0;
      if (latest?.guide) {
        const cards = latest.guide.cards.map((c) => ({
          stage: c.stage as string,
          blocks:
            guideContentBlocksSchema.safeParse(c.contentBlocks).data ?? [],
        }));
        const broughtUpBoards = latest.builds.reduce(
          (n, b) => n + b.boards.length,
          0,
        );
        const examQuestions = Array.isArray(p.exam?.questions)
          ? (p.exam.questions as unknown[]).length
          : 0;
        const published = p.publishedRevisionId != null;
        const r = assessLessonReadiness({
          stages: GUIDE_STAGES,
          cards,
          exam: p.exam ? { questions: examQuestions } : null,
          broughtUpBoards,
          published,
        });
        pipelineState = isGolden(published, r.vetted)
          ? "golden"
          : r.vetted
            ? "vetted"
            : r.publishable
              ? "publishable"
              : "not-ready";
        captureCount = emptyMediaCount(collectEmptyMedia(cards));
      }

      return {
        ...p,
        latest,
        lastActivity,
        pipelineState,
        captureCount,
        waitlistCount: p._count.waitlist,
        unbuildableCount: p.publishedRevisionId
          ? (unbuildableByRev.get(p.publishedRevisionId) ?? 0)
          : 0,
      };
    })
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <h1
          className="font-display tracking-wider text-title"
          style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)" }}
        >
          OTD <span className="text-command-gold">Academy</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase sm:gap-3">
          <Link
            href={showArchived ? "/" : "/?archived=1"}
            className="text-signal-blue underline"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
          <Link
            href="/curriculum"
            className="glass-button px-3 py-2 sm:px-4"
          >
            CURRICULUM →
          </Link>
          <Link href="/admin/waitlist" className="glass-button px-3 py-2 sm:px-4">
            WAITLIST →
          </Link>
          <Link
            href="/projects/new"
            className="glass-button glass-button-cta inline-flex items-center gap-1.5 px-3 py-2 sm:px-4"
          >
            <PlusIcon className="h-4 w-4" />
            New project
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
        <span className="mx-1 hidden text-muted sm:inline">·</span>
        <FilterChip label="ALL LEVELS" active={!params.level} href="/" />
        {["L1", "L2", "L3"].map((l) => (
          <FilterChip
            key={l}
            label={l}
            active={params.level === l}
            href={`/?level=${l}`}
          />
        ))}
        <span className="mx-1 hidden text-muted sm:inline">·</span>
        <FilterChip
          label="SHOW BENCH TOOLS"
          active={showBenchTools}
          href={showBenchTools ? "/" : "/?showBenchTools=1"}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          NO PROJECTS YET. CREATE ONE TO BEGIN.
        </p>
      ) : (
        <ul className="mt-8 border-t border-panel-border/60 font-mono text-sm sm:mt-10">
          {sorted.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-1 gap-3 border-b border-panel-border/60 py-4 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center sm:gap-4"
            >
              {/* Name + slug — stack on mobile; name leads in both cases. */}
              <div className="min-w-0">
                <Link
                  href={`/projects/${p.slug}`}
                  className="block truncate text-base text-command-gold transition-colors hover:text-gold-light"
                >
                  {p.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-gray-3 sm:hidden">
                  {p.slug}
                </p>
              </div>
              {/* Slug column — visible only at sm+; muted secondary text. */}
              <p className="hidden truncate text-xs text-muted sm:block">
                {p.slug}
              </p>
              {/* Current-state pill — revision link + stage chip. The
                  revision link is the secondary drill-in target (the
                  primary one is the project name above); it carries a
                  persistent signal-blue underline + an arrow so it
                  reads unambiguously as "go to revision". */}
              <div className="flex flex-wrap items-center gap-2">
                {p.latest ? (
                  <>
                    <Link
                      href={`/projects/${p.slug}/${encodeURIComponent(p.latest.label)}`}
                      className="group inline-flex items-center gap-1 text-signal-blue underline decoration-signal-blue/40 decoration-1 underline-offset-4 transition-colors hover:text-gold-light hover:decoration-gold-light"
                    >
                      <span>{p.latest.label}</span>
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </Link>
                    <span className="inline-block rounded border border-panel-border bg-deep-space/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-command-gold sm:text-xs">
                      {p.latest.currentStage}
                    </span>
                    <PipelineBadges
                      state={p.pipelineState}
                      captureCount={p.captureCount}
                      waitlist={p.waitlistCount}
                      unbuildable={p.unbuildableCount}
                    />
                  </>
                ) : (
                  <span className="text-xs uppercase tracking-wider text-muted">
                    NO REVISIONS
                  </span>
                )}
              </div>
              {/* Status + last-activity. Last-activity shows on mobile as a
                  small subtitle under name, so this column only carries
                  ACTIVE / ARCHIVED. */}
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted sm:text-xs">
                  {p.archivedAt ? "ARCHIVED" : "ACTIVE"}
                </span>
                <span className="text-[10px] text-gray-3 sm:text-xs">
                  {p.lastActivity.toISOString().slice(0, 10)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
