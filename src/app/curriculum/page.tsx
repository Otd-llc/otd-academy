// `/curriculum` — grid view of the curriculum DAG (Task 12.9 — Wave 1 v1).
//
// Server component. Loads all non-archived projects with their inbound and
// outbound dependency edges and the most-recent revision's currentStage,
// flattens to a tight DTO, and hands off to `CurriculumDag` for layout.
//
// The DAG view intentionally does NOT honor the dashboard's `?archived=1` /
// `?track=` filters — it's the curriculum map, not a filtered manifest.
import Link from "next/link";
import { db } from "@/lib/db";
import { CurriculumDag, type ProjectCard } from "@/components/CurriculumDag";

export default async function CurriculumPage() {
  // One query — pull each non-archived project with both edge sides and its
  // latest revision's currentStage. Prisma collapses the join behind the
  // scenes; we still bring the full row so the DTO mapping below stays
  // single-source.
  const projects = await db.project.findMany({
    where: { archivedAt: null },
    include: {
      revisions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { currentStage: true },
      },
      // Outbound — this project depends on others. The "depends-on" side
      // gives us the other-end slug for the inline label.
      dependentEdges: {
        include: {
          dependsOnProject: { select: { slug: true } },
        },
      },
      // Inbound — others depend on this project. The "dependent" side gives
      // us the other-end slug.
      dependsOnEdges: {
        include: {
          dependentProject: { select: { slug: true } },
        },
      },
    },
  });

  // Flatten to the presentational DTO. Keeping this mapping in the page
  // (not the component) lets `CurriculumDag` stay a pure renderer.
  const cards: ProjectCard[] = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    track: p.track,
    level: p.level,
    criticalPath: p.criticalPath,
    latestStage: p.revisions[0]?.currentStage ?? null,
    outbound: p.dependentEdges.map((e) => ({
      otherSlug: e.dependsOnProject.slug,
      required: e.dependsOnStageRequired,
      kind: e.kind,
    })),
    inbound: p.dependsOnEdges.map((e) => ({
      otherSlug: e.dependentProject.slug,
      gated: e.dependentStageGated,
      kind: e.kind,
    })),
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link href="/" className="text-signal-blue underline">
          ← All projects
        </Link>
      </nav>

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl tracking-wider text-white">
          CURRICULUM
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          {cards.length} {cards.length === 1 ? "PROJECT" : "PROJECTS"}
        </p>
      </div>

      <p className="mt-4 max-w-3xl font-mono text-xs uppercase tracking-wider text-muted">
        TRACK × LEVEL GRID. EACH CARD SHOWS LATEST STAGE AND TERSE INBOUND /
        OUTBOUND DEPENDENCIES. BENCH TOOLS ARE DIMMED.
      </p>

      <div className="mt-8">
        <CurriculumDag projects={cards} />
      </div>
    </main>
  );
}
