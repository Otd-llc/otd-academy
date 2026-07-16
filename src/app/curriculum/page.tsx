// `/curriculum` — grid view of the curriculum DAG (Task 12.9 — Wave 1 v1).
//
// Server component. Loads all non-archived projects with their inbound and
// outbound dependency edges and the most-recent revision's currentStage,
// flattens to a tight DTO, and hands off to `CurriculumDag` for layout.
//
// The DAG view intentionally does NOT honor the dashboard's `?archived=1` /
// `?track=` filters — it's the curriculum map, not a filtered manifest.
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { CurriculumDag, type ProjectCard } from "@/components/CurriculumDag";
import { ChevronLeftIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";

export default async function CurriculumPage() {
  // Admin-facing curriculum map: always live, never cached or prerendered. Unlike
  // every other DB-backed page here this one reads no session, so nothing else
  // establishes that it runs at request time — and under cacheComponents the
  // Prisma client's internal clock read then trips the "current time before any
  // Request data" prerender error. connection() states the intent outright.
  await connection();

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
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All projects
        </Link>
      </nav>

      <PageHeader
        eyebrow="OPERATOR"
        title="Curriculum"
        meta={[{ label: "PROJECTS", value: cards.length }]}
        lead="Track × level map. Each card shows latest stage and terse inbound / outbound dependencies. Bench tools are dimmed."
      />

      <div className="mt-8">
        <CurriculumDag projects={cards} />
      </div>
    </main>
  );
}
