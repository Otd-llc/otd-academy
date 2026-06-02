// Dependencies pane for the project detail page (Task 12.10).
//
// Pure server component — renders two lists from already-fetched edge DTOs:
//
//   • Outbound ("This project depends on …") — one row per edge in
//     `dependentEdges`. Edit (inline notes form) + Delete buttons.
//   • Inbound  ("Projects that depend on this …") — one row per edge in
//     `dependsOnEdges`. Read-only here; editing/deleting an inbound edge
//     belongs on the *other* project's detail page (where it appears as an
//     outbound edge).
//
// Kept separate from the create flow (`/projects/[slug]/dependencies/new`,
// Task 12.11). Editing more than `notes` requires delete + recreate for now;
// surfacing the other fields as editable would duplicate the create form
// without the cycle/serialization guards already encoded in the
// `createProjectDependency` action.
import Link from "next/link";
import {
  deleteProjectDependencyAction,
} from "@/lib/actions/project-dependencies";
import { DeleteConfirmButton } from "@/components/DeleteConfirmButton";
import { EditDependencyNotesForm } from "./_pane-edits";

export type OutboundEdge = {
  id: string;
  targetSlug: string;
  kind: "DE_RISK" | "FOUNDATION" | "SHARED_BLOCK";
  dependsOnStageRequired: string;
  dependentStageGated: string;
  notes: string | null;
};

export type InboundEdge = {
  id: string;
  sourceSlug: string;
  kind: "DE_RISK" | "FOUNDATION" | "SHARED_BLOCK";
  dependentStageGated: string;
  dependsOnStageRequired: string;
  notes: string | null;
};

export function ProjectDependenciesPane({
  slug,
  outbound,
  inbound,
}: {
  slug: string;
  outbound: OutboundEdge[];
  inbound: InboundEdge[];
}) {
  const isEmpty = outbound.length === 0 && inbound.length === 0;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl tracking-wider text-white">
          DEPENDENCIES
        </h2>
        <Link
          href={`/projects/${slug}/dependencies/new`}
          className="rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          + New dependency
        </Link>
      </div>

      {isEmpty ? (
        <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
          NO DEPENDENCIES RECORDED.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Outbound — this project depends on others */}
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted">
              This project depends on
            </h3>
            {outbound.length === 0 ? (
              <p className="mt-2 font-mono text-sm uppercase tracking-wider text-muted">
                — NONE —
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-panel-border border border-panel-border">
                {outbound.map((e) => (
                  <li
                    key={e.id}
                    className="space-y-2 px-4 py-3 font-mono text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <span className="text-link-muted">
                        →{" "}
                        <Link
                          href={`/projects/${e.targetSlug}`}
                          className="text-signal-blue underline"
                        >
                          {e.targetSlug}
                        </Link>{" "}
                        at{" "}
                        <span className="text-command-gold">
                          {e.dependsOnStageRequired}
                        </span>{" "}
                        <span className="text-muted">(kind={e.kind})</span>
                      </span>
                      {/* Delete — shared two-tap trash confirm. Posts the
                          unchanged deleteProjectDependencyAction (a server
                          action, valid to pass to this client leaf); the hidden
                          `id` is carried inside DeleteConfirmButton's own form. */}
                      <DeleteConfirmButton
                        action={deleteProjectDependencyAction}
                        id={e.id}
                        hint="Delete dependency"
                        ariaLabel="Delete dependency"
                        confirmAriaLabel="Confirm delete dependency"
                      />
                    </div>
                    <EditDependencyNotesForm id={e.id} value={e.notes} />
                    <p className="font-mono text-xs uppercase tracking-wider text-muted">
                      Gates this project at {e.dependentStageGated} · to change
                      stages/kind, delete and recreate.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Inbound — others depend on this project (read-only) */}
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted">
              Projects that depend on this
            </h3>
            {inbound.length === 0 ? (
              <p className="mt-2 font-mono text-sm uppercase tracking-wider text-muted">
                — NONE —
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-panel-border border border-panel-border">
                {inbound.map((e) => (
                  <li
                    key={e.id}
                    className="px-4 py-3 font-mono text-sm text-link-muted"
                  >
                    ←{" "}
                    <Link
                      href={`/projects/${e.sourceSlug}`}
                      className="text-signal-blue underline"
                    >
                      {e.sourceSlug}
                    </Link>{" "}
                    at{" "}
                    <span className="text-command-gold">
                      {e.dependentStageGated}
                    </span>{" "}
                    <span className="text-muted">(kind={e.kind})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
