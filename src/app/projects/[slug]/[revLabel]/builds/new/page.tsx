// /projects/[slug]/[revLabel]/builds/new — server shell for the Create-Build
// form. The createBuild action enforces the §5.3 gates; this page also
// short-circuits with a friendly message when the revision is in a state
// that wouldn't permit a new Build, so the user never sees the deeper error
// from the action layer.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { StageName } from "@/lib/stages";
import { NewBuildForm } from "./_form";

type Params = { slug: string; revLabel: string };

const BUILD_CREATABLE_STAGES = new Set<StageName>([
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
]);

export default async function NewBuildPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, revLabel } = await params;
  const decodedRev = decodeURIComponent(revLabel);

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!project) notFound();

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: decodedRev, mode: "insensitive" },
    },
    select: {
      id: true,
      label: true,
      currentStage: true,
      frozenAt: true,
      builds: {
        where: { frozenAt: null },
        select: { id: true, label: true },
      },
    },
  });
  if (!revision) notFound();

  const currentStage = revision.currentStage as StageName;
  const isFrozen = revision.frozenAt !== null;
  const stageAllowed = BUILD_CREATABLE_STAGES.has(currentStage);
  const unfrozenBuild = revision.builds[0] ?? null;
  const blocker = isFrozen
    ? "Revision is frozen; cannot create new Builds."
    : !stageAllowed
      ? `Cannot create Build at stage ${currentStage}. Allowed stages: DRC_GERBER, ORDERING, ASSEMBLY, BRINGUP.`
      : unfrozenBuild
        ? `An unfrozen Build (${unfrozenBuild.label}) already exists on this revision. Freeze or finish it first.`
        : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${project.slug}/${encodeURIComponent(revision.label)}`}
          className="text-signal-blue underline"
        >
          ← {project.name} / {revision.label}
        </Link>
      </nav>

      <h1 className="font-display text-5xl tracking-wider text-white">
        NEW BUILD
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Creating a Build past ORDERING regresses the revision with a single
        transition row (design §5.3).
      </p>

      <div className="mt-8 border border-panel-border bg-navy-dark p-6">
        {blocker ? (
          <p className="border-l-4 border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm font-bold text-alert-red">
            {blocker}
          </p>
        ) : (
          <NewBuildForm revisionId={revision.id} />
        )}
      </div>
    </main>
  );
}
