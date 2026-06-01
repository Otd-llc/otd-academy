// Project detail page. Server component — fetches the project (with
// revisions included so we can render a placeholder list) and 404s if
// missing. Inline edit-in-place forms call editProject; archive button
// calls archive/unarchiveProject.
//
// Phase 4 scope: project chrome only. The Revisions section is a
// placeholder until M5a wires up the real revision list / create button.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  archiveProjectAction,
  unarchiveProjectAction,
} from "@/lib/actions/projects";
import {
  EditCriticalPathForm,
  EditDescriptionForm,
  EditDisciplineTaughtForm,
  EditLevelForm,
  EditNameForm,
  EditRepoUrlForm,
  EditRequiresStripboardForm,
  EditTargetCostForm,
  EditTrackForm,
} from "./_edit-fields";
import { ProjectDependenciesPane } from "@/components/ProjectDependenciesPane";

// Track → text-color mapping for the curriculum badge pill. Lives next to
// the only consumer (the detail page header strip); when a second view
// needs it we'll lift it into `src/lib/curriculum-colors.ts`.
const TRACK_COLOR: Record<string, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await db.project.findUnique({
    where: { slug },
    include: {
      revisions: {
        orderBy: { updatedAt: "desc" },
      },
      // Outbound — this project depends on others (Task 12.10).
      dependentEdges: {
        include: { dependsOnProject: { select: { slug: true } } },
        orderBy: { createdAt: "asc" },
      },
      // Inbound — others depend on this project.
      dependsOnEdges: {
        include: { dependentProject: { select: { slug: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  const targetCostStr =
    project.targetCost === null ? null : project.targetCost.toString();
  const isArchived = project.archivedAt !== null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link href="/" className="text-signal-blue underline">
          ← All projects
        </Link>
      </nav>

      {/* Header strip — gold-accented per design §8.3 / §9.1 */}
      <div className="border border-panel-border border-l-4 border-l-command-gold bg-navy-dark p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Project · {project.slug}
            {isArchived && (
              <span className="ml-2 rounded border border-panel-border bg-deep-space px-2 py-0.5 text-alert-red">
                ARCHIVED
              </span>
            )}
          </p>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Updated {project.updatedAt.toISOString().slice(0, 10)}
          </p>
        </div>

        {/* Curriculum badge row — track / level / bench-tool chips. Each is
            optional; the row collapses cleanly when nothing is set. */}
        {(project.track || project.level || !project.criticalPath) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {project.track && (
              <span
                className={`inline-flex items-center rounded border border-panel-border bg-navy-dark px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${TRACK_COLOR[project.track]}`}
              >
                {project.track}
              </span>
            )}
            {project.level && (
              <span className="inline-flex items-center rounded border border-panel-border bg-navy-dark px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                {project.level}
              </span>
            )}
            {!project.criticalPath && (
              <span className="inline-flex items-center rounded border border-panel-border bg-navy-dark px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">
                BENCH TOOL
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          <EditNameForm id={project.id} value={project.name} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <EditDescriptionForm
            id={project.id}
            value={project.description}
          />
          <EditTargetCostForm id={project.id} value={targetCostStr} />
        </div>
      </div>

      {/* Curriculum metadata — edit-in-place per Phase 4 pattern. Each field
          its own form action so saves are surgical and FieldError surfaces
          land next to the changed input. */}
      <div className="mt-6 border border-panel-border bg-navy-dark p-6">
        <h2 className="font-mono text-sm uppercase tracking-wider text-muted">
          Curriculum metadata
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <EditTrackForm id={project.id} value={project.track} />
          <EditLevelForm id={project.id} value={project.level} />
          <div className="md:col-span-2">
            <EditDisciplineTaughtForm
              id={project.id}
              value={project.disciplineTaught}
            />
          </div>
          <EditCriticalPathForm
            id={project.id}
            value={project.criticalPath}
          />
          <EditRequiresStripboardForm
            id={project.id}
            value={project.requiresStripboard}
          />
        </div>
      </div>

      {/* Free-floating repo URL — signal-blue per design §8.3 rule */}
      <div className="mt-6 border border-panel-border bg-navy-dark p-6">
        <EditRepoUrlForm id={project.id} value={project.repoUrl} />
        {project.repoUrl && (
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted">
            Currently:{" "}
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-signal-blue underline"
            >
              {project.repoUrl}
            </a>
          </p>
        )}
      </div>

      {/* Revisions */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-3xl tracking-wider text-white">
            REVISIONS
          </h2>
          <Link
            href={`/projects/${project.slug}/revisions/new`}
            className="rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
          >
            + New revision
          </Link>
        </div>
        {project.revisions.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            NO REVISIONS — CREATE ONE TO BEGIN.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border border border-panel-border">
            {project.revisions.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-4 px-4 py-3 font-mono text-sm"
              >
                <Link
                  href={`/projects/${project.slug}/${encodeURIComponent(r.label)}`}
                  className="text-command-gold underline"
                >
                  {r.label}
                </Link>
                <span className="text-muted">
                  {r.currentStage} · updated{" "}
                  {r.updatedAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dependencies pane (Task 12.10). Read-only inbound + editable
          outbound; the create flow lives at /projects/[slug]/dependencies/new
          (Task 12.11). */}
      <ProjectDependenciesPane
        slug={project.slug}
        outbound={project.dependentEdges.map((e) => ({
          id: e.id,
          targetSlug: e.dependsOnProject.slug,
          kind: e.kind,
          dependsOnStageRequired: e.dependsOnStageRequired,
          dependentStageGated: e.dependentStageGated,
          notes: e.notes,
        }))}
        inbound={project.dependsOnEdges.map((e) => ({
          id: e.id,
          sourceSlug: e.dependentProject.slug,
          kind: e.kind,
          dependentStageGated: e.dependentStageGated,
          dependsOnStageRequired: e.dependsOnStageRequired,
          notes: e.notes,
        }))}
      />

      {/* Archive / unarchive */}
      <div className="mt-10 border-t border-panel-border pt-6">
        {isArchived ? (
          <form action={unarchiveProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded border border-panel-border bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-status-green transition-colors hover:border-status-green"
            >
              Unarchive project
            </button>
          </form>
        ) : (
          <form action={archiveProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded border border-panel-border bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-alert-red transition-colors hover:border-alert-red"
            >
              Archive project
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
