// Curriculum DAG view (Task 12.9 — Wave 1 v1).
//
// Presentational server component. Takes a flat list of `ProjectCard` DTOs
// and renders them in a CSS grid:
//
//   • Rows: L1 / L2 / L3 (CurriculumLevel)
//   • Cols: SENSE / ACT / POWER / COMMS (CurriculumTrack)
//
// Each card shows slug + a STAGE • TRACK · LEVEL strip, then terse inline
// inbound/outbound dependency labels. Bench tools (criticalPath === false)
// render at `opacity-60` per design §8.3 chip muting.
//
// Projects missing track OR level land in a separate "UNASSIGNED" row below
// the grid — they're not dropped silently so pre-curriculum rows stay visible
// while curriculum metadata gets filled in.
//
// Full graph visualization (drawn edges) is Phase 2 per the proposal; this
// v1 ships labels-on-cards and a clean grid.
import Link from "next/link";
import type {
  CurriculumLevel,
  CurriculumTrack,
  ProjectDepKind,
  Stage,
} from "@prisma/client";

// Track → text-color mapping — mirrors the chip palette on the project
// detail page. Keep these two tables in sync if the design tokens shift.
const TRACK_COLOR: Record<CurriculumTrack, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};

const TRACKS: CurriculumTrack[] = ["SENSE", "ACT", "POWER", "COMMS"];
const LEVELS: CurriculumLevel[] = ["L1", "L2", "L3"];

export type ProjectCard = {
  id: string;
  slug: string;
  name: string;
  track: CurriculumTrack | null;
  level: CurriculumLevel | null;
  criticalPath: boolean;
  latestStage: Stage | null;
  // This project depends on others — "→ deps-on" row.
  outbound: { otherSlug: string; required: Stage; kind: ProjectDepKind }[];
  // Others depend on this project — "← dep-by" row.
  inbound: { otherSlug: string; gated: Stage; kind: ProjectDepKind }[];
};

type Props = {
  projects: ProjectCard[];
};

// Per-card render. Kept inline (single consumer) so the grid cell wiring
// stays legible at one glance.
function Card({ p }: { p: ProjectCard }) {
  const trackColor = p.track ? TRACK_COLOR[p.track] : "text-muted";
  return (
    <div
      className={`flex flex-col gap-2 border border-panel-border bg-navy-dark p-3 ${p.criticalPath ? "" : "opacity-60"}`}
    >
      <Link
        href={`/projects/${p.slug}`}
        className="font-mono text-xs uppercase tracking-wider text-command-gold hover:underline"
      >
        {p.slug}
      </Link>
      <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span className="text-command-gold">{p.latestStage ?? "—"}</span>
        <span>·</span>
        <span className={trackColor}>{p.track ?? "—"}</span>
        <span>·</span>
        <span>{p.level ?? "—"}</span>
        {!p.criticalPath && (
          <>
            <span>·</span>
            <span>BENCH</span>
          </>
        )}
      </div>
      {p.outbound.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-link-muted">
          →{" "}
          {p.outbound
            .map((e) => `${e.otherSlug}@${e.required}`)
            .join(", ")}
        </p>
      )}
      {p.inbound.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-link-muted">
          ←{" "}
          {p.inbound
            .map((e) => `${e.otherSlug}@${e.gated}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

export function CurriculumDag({ projects }: Props) {
  // Bucket into (track, level) cells; everything missing either axis falls
  // through to `unassigned`.
  const cells = new Map<string, ProjectCard[]>();
  const unassigned: ProjectCard[] = [];

  for (const p of projects) {
    if (!p.track || !p.level) {
      unassigned.push(p);
      continue;
    }
    const key = `${p.track}:${p.level}`;
    const arr = cells.get(key);
    if (arr) arr.push(p);
    else cells.set(key, [p]);
  }

  return (
    <div>
      {/* Column header row — track chips above each column. The leading
          empty cell aligns with the row-label column on the left. */}
      <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2">
        <div />
        {TRACKS.map((t) => (
          <div
            key={t}
            className={`border border-panel-border bg-deep-space px-2 py-1 text-center font-mono text-xs uppercase tracking-wider ${TRACK_COLOR[t]}`}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Body — one grid row per level. Each level's row gets a leading
          row-label cell, then four track cells. Empty cells render an
          em-dash placeholder so the grid skeleton stays visible. */}
      <div className="mt-2 grid grid-cols-[80px_repeat(4,1fr)] gap-2">
        {LEVELS.map((l) => (
          <CurriculumGridRow key={l} level={l} cells={cells} />
        ))}
      </div>

      {/* Unassigned bucket — projects missing track and/or level. Don't
          drop these silently; the dashboard surfaces them as a row so
          curriculum metadata back-fill stays visible work. */}
      {unassigned.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted">
            UNASSIGNED · NO TRACK OR LEVEL
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {unassigned.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Helper component for one row of the level grid. Keeps the JSX flat — the
// outer parent emits CSS-grid-children in row-major order across all four
// track columns plus the leading level label.
function CurriculumGridRow({
  level,
  cells,
}: {
  level: CurriculumLevel;
  cells: Map<string, ProjectCard[]>;
}) {
  return (
    <>
      <div className="flex items-start justify-end border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-command-gold">
        {level}
      </div>
      {TRACKS.map((t) => {
        const bucket = cells.get(`${t}:${level}`) ?? [];
        return (
          <div
            key={t}
            className="flex flex-col gap-2 border border-panel-border bg-deep-space/40 p-2"
          >
            {bucket.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                —
              </p>
            ) : (
              bucket.map((p) => <Card key={p.id} p={p} />)
            )}
          </div>
        );
      })}
    </>
  );
}
