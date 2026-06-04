// Revision detail page (design §9.1).
//
// Phase 5a scope: the header strip (with read-only commit-SHA placeholders;
// edit forms land in Task 5.3), a read-only stage tracker stub (no gate
// reasoning until Phase 7), and the two-column grid with placeholder
// Builds/Artifacts panes and a real transitions log. BomLine + Build CRUD
// and the rest of the panes land in 5.4/5.5 and Phase 6+.
//
// `[revLabel]` is matched case-insensitively against `Revision.label`
// (per the functional unique index `revision_project_label_ci`); the
// canonical label is rendered from the DB row.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { type StageName } from "@/lib/stages";
import { loadGateContext } from "@/lib/load-gate-context";
import { StageTracker } from "@/components/StageTracker";
import { StageActions } from "@/components/StageActions";
import { TransitionsLog } from "@/components/TransitionsLog";
import {
  EditLayoutCommitForm,
  EditSchematicCommitForm,
} from "./_commit-fields";
import { BomEditor } from "./_bom-editor";
import { ArtifactPicker } from "@/components/ArtifactPicker";
import { ArtifactDownloadLink } from "@/components/ArtifactDownloadLink";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { getArtifactRenderUrl } from "@/lib/actions/uploads";
import { renderBoundsSchema } from "@/lib/schemas/part-asset";
import { ErrataPane } from "@/components/ErrataPane";
import {
  RevisionChecklistsPane,
  isRevisionChecklistVisibleAtStage,
} from "@/components/RevisionChecklistsPane";
import { KicadExportButton } from "@/components/KicadExportButton";
import { ChevronLeftIcon, PlusIcon } from "@/components/icons";

type Params = { slug: string; revLabel: string };

export default async function RevisionDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, revLabel } = await params;
  const decodedLabel = decodeURIComponent(revLabel);

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      // m17: surfaces the stripboard-required indicator for the
      // RevisionChecklistsPane (materialize button visibility).
      requiresStripboard: true,
    },
  });
  if (!project) notFound();

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: decodedLabel, mode: "insensitive" },
    },
    include: {
      bomLines: {
        include: { part: true },
        orderBy: { createdAt: "asc" },
      },
      artifacts: { orderBy: { createdAt: "desc" } },
      transitions: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { transitionedAt: "desc" },
      },
      errata: { orderBy: { createdAt: "desc" } },
      builds: {
        orderBy: [{ frozenAt: "asc" }, { createdAt: "desc" }],
      },
      // m15: revision-scoped checklists rendered on this page (visible only
      // through LAYOUT — past LAYOUT the pane is hidden entirely).
      checklists: {
        include: { items: { orderBy: { ordinal: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!revision) notFound();

  const isFrozen = revision.frozenAt !== null;

  // Gate context for the StageTracker (Phase 7). Loaded server-side so the
  // tracker stays a pure render; same loader the advanceStage action will
  // reuse inside its Serializable tx in Phase 8.
  const gateCtx = await loadGateContext(db, revision.id);

  // "Create new Build" gating (design §9.1): mirror createBuild's stage
  // assertion AND the Phase 1 one-unfrozen-Build-per-revision invariant.
  // Hiding the button when it would be rejected anyway keeps the affordance
  // honest.
  const buildCreatableStages: StageName[] = [
    "DRC_GERBER",
    "ORDERING",
    "ASSEMBLY",
    "BRINGUP",
  ];
  const hasUnfrozenBuild = revision.builds.some((b) => b.frozenAt === null);
  const canCreateBuild =
    !isFrozen &&
    buildCreatableStages.includes(revision.currentStage as StageName) &&
    !hasUnfrozenBuild;

  // Parts list for the BomEditor dropdown — capped at 200 for Phase 5a;
  // search/pagination lands when the parts library grows past that. The
  // global parts library is shared across projects per design §4.3.
  const parts =
    revision.currentStage === "BOM_SOURCING"
      ? await db.part.findMany({
          orderBy: [{ manufacturer: "asc" }, { mpn: "asc" }],
          take: 200,
          select: { id: true, mpn: true, manufacturer: true },
        })
      : [];

  // Errata pane (§9.1 bottom-right; Task 11.2) — same-project linkable revs
  // are every revision under this project EXCEPT this one. The dropdown in
  // the per-row Link form uses this; the linkErratumToRevision action
  // re-checks server-side per design §12.1 (no DB CHECK, action-only).
  const linkableRevisions = await db.revision.findMany({
    where: {
      projectId: project.id,
      NOT: { id: revision.id },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true },
  });

  // Board stub: resolve INLINE render URLs server-side for the revision-scoped
  // MODEL_3D artifacts at the current stage that carry a derived `.glb`. Keyed
  // by artifact id; only these rows mount <ModelViewerLazy>. A null URL (R2 off
  // / no render) simply means no viewer affordance.
  const renderableArtifacts = revision.artifacts.filter(
    (a) =>
      a.buildId === null &&
      a.stage === revision.currentStage &&
      a.subkind === "MODEL_3D" &&
      a.renderKey,
  );
  const artifactRenderUrls = new Map<string, string>();
  for (const a of renderableArtifacts) {
    const url = await getArtifactRenderUrl(a.id);
    if (url) artifactRenderUrls.set(a.id, url);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="mb-6 flex items-center justify-between gap-4 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {project.name}
        </Link>
        {/* Task 9.4: link to the learner-guide hub. Matches this page's
            signal-blue link convention (the bench nav-back gold is reserved
            for the PageHeader on the guide pages themselves). */}
        <Link
          href={`/projects/${project.slug}/${encodeURIComponent(revision.label)}/guide`}
          className="text-signal-blue underline"
        >
          Build guide →
        </Link>
      </nav>

      {/* Header strip — gold-accented per §9.1 when unfrozen */}
      <div
        className={`glass-card p-4 sm:p-6 ${
          isFrozen ? "" : "border-l-4 border-l-command-gold"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Revision
            </p>
            <h1
              className="mt-1 break-all font-display tracking-wider text-command-gold"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
            >
              {revision.label}
            </h1>
          </div>
          <span className="rounded border border-panel-border bg-deep-space/60 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-command-gold">
            {revision.currentStage}
          </span>
        </div>

        {/* Commit-SHA inline-edit (Task 5.3) — disabled when frozen */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <EditSchematicCommitForm
            revisionId={revision.id}
            value={revision.schematicCommit}
            disabled={isFrozen}
          />
          <EditLayoutCommitForm
            revisionId={revision.id}
            value={revision.layoutCommit}
            disabled={isFrozen}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              BOM frozen
            </p>
            <p className="mt-1 font-mono text-sm text-link-muted">
              {revision.bomFrozenAt
                ? revision.bomFrozenAt.toISOString().slice(0, 10)
                : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Revision frozen
            </p>
            <p className="mt-1 font-mono text-sm text-link-muted">
              {revision.frozenAt
                ? revision.frozenAt.toISOString().slice(0, 10)
                : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Updated
            </p>
            <p className="mt-1 font-mono text-sm text-link-muted">
              {revision.updatedAt.toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
      </div>

      {/* Stage tracker — read-only; gates evaluated server-side (Phase 7) */}
      <div className="mt-6">
        <StageTracker
          revision={{ currentStage: revision.currentStage }}
          ctx={gateCtx}
        />
      </div>

      {/* Advance / Regress buttons (Task 8.3) — sibling to the read-only
          tracker per design §5.3 + §9.1. Hidden entirely when frozen. */}
      <div className="mt-4">
        <StageActions
          revisionId={revision.id}
          currentStage={revision.currentStage as StageName}
          isFrozen={isFrozen}
        />
      </div>

      {/* Two-column grid — design §9.1 */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT 2/3 — Builds + Artifacts */}
        <div className="space-y-6 lg:col-span-2">
          {/* Builds pane — design §9.1 */}
          <section className="glass-card p-4 sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl tracking-wider text-white">
                BUILDS
              </h2>
              {/*
                "Create new Build" visibility (design §9.1): revision in
                DRC_GERBER/ORDERING/ASSEMBLY/BRINGUP, unfrozen, AND no unfrozen
                Build exists. Matches the createBuild action's gates so the
                user never sees the deeper error.
              */}
              {canCreateBuild ? (
                <Link
                  href={`/projects/${project.slug}/${encodeURIComponent(revision.label)}/builds/new`}
                  className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
                >
                  <PlusIcon className="h-4 w-4" />
                  New build
                </Link>
              ) : null}
            </div>
            {revision.builds.length === 0 ? (
              <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
                NO BUILDS — CREATE ONE WHEN THE REVISION REACHES DRC_GERBER.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-panel-border">
                {revision.builds.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-baseline justify-between gap-4 py-3 font-mono text-sm"
                  >
                    <Link
                      href={`/projects/${project.slug}/${encodeURIComponent(revision.label)}/builds/${encodeURIComponent(b.label)}`}
                      className="text-command-gold underline-offset-4 hover:underline"
                    >
                      {b.label}
                    </Link>
                    <span className="text-muted">
                      {b.boardCount} boards ·{" "}
                      {b.frozenAt ? "frozen" : "active"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Artifacts pane (design §9.1). Revision-scoped artifacts only;
              the per-stage subkind picker is mounted below the list. */}
          <section className="glass-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-2xl tracking-wider text-white">
                ARTIFACTS
              </h2>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                Stage · {revision.currentStage}
              </span>
            </div>

            {/* KiCad export (Task 8) — generates a BOM_EXPORT zip artifact from
                the revision's BOM + verified rails + curated assets. A
                BOM_SOURCING-stage action; rendered unconditionally for v1. */}
            <div className="mt-4 border-b border-panel-border pb-4">
              <KicadExportButton revisionId={revision.id} />
            </div>

            {/* BomLine editor — visible only in BOM_SOURCING (design §9.1). */}
            {revision.currentStage === "BOM_SOURCING" ? (
              <div className="mt-4">
                <BomEditor
                  revisionId={revision.id}
                  lines={revision.bomLines.map((l) => ({
                    id: l.id,
                    refDes: l.refDes,
                    quantity: l.quantity,
                    notes: l.notes,
                    part: {
                      id: l.part.id,
                      mpn: l.part.mpn,
                      manufacturer: l.part.manufacturer,
                    },
                  }))}
                  parts={parts.map((p) => ({
                    id: p.id,
                    mpn: p.mpn,
                    manufacturer: p.manufacturer,
                  }))}
                  disabled={isFrozen || revision.bomFrozenAt !== null}
                  disabledReason={
                    isFrozen
                      ? "Revision is frozen."
                      : revision.bomFrozenAt !== null
                        ? "BOM is frozen."
                        : undefined
                  }
                />
              </div>
            ) : null}

            {/* Revision-scoped artifacts at the current stage. */}
            {(() => {
              const revArtifacts = revision.artifacts.filter(
                (a) =>
                  a.buildId === null &&
                  a.stage === revision.currentStage,
              );
              if (revArtifacts.length === 0) {
                return (
                  <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
                    NO ARTIFACTS AT THIS STAGE.
                  </p>
                );
              }
              return (
                <ul className="mt-4 divide-y divide-panel-border">
                  {revArtifacts.map((a) => (
                    <li key={a.id} className="py-3 font-mono text-sm">
                      <p className="text-link-muted">{a.title}</p>
                      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
                        {a.subkind} · {a.kind}
                      </p>
                      {a.linkUrl ? (
                        <a
                          href={a.linkUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block font-mono text-xs text-link-muted underline"
                        >
                          {a.linkUrl}
                        </a>
                      ) : null}
                      {a.kind === "FILE" && a.fileKey ? (
                        <ArtifactDownloadLink
                          artifactId={a.id}
                          filename={
                            a.fileKey.split("/").pop() ?? "download"
                          }
                        />
                      ) : null}
                      {/* Board stub: render the same <ModelViewer> for a
                          MODEL_3D artifact carrying a derived .glb. */}
                      {a.subkind === "MODEL_3D" &&
                      a.renderKey &&
                      artifactRenderUrls.has(a.id) ? (
                        <div className="pt-1">
                          <ModelViewerLazy
                            src={artifactRenderUrls.get(a.id)!}
                            bounds={
                              renderBoundsSchema.safeParse(a.renderBounds)
                                .data ?? null
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              );
            })()}

            {/* Add-artifact picker (design §9.1) — scoped to the current
                stage's revisionAllowedArtifactSubkinds. Hidden when frozen. */}
            {!isFrozen ? (
              <div className="mt-6 border-t border-panel-border pt-6">
                <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
                  Add artifact
                </p>
                <ArtifactPicker
                  owner={{ kind: "revision", id: revision.id }}
                  stage={revision.currentStage}
                />
              </div>
            ) : null}
          </section>

          {/* Revision-scoped checklists pane (m15) — visible REQUIREMENTS
              through LAYOUT only; past LAYOUT the design-time review
              checklists don't apply. */}
          {isRevisionChecklistVisibleAtStage(revision.currentStage) ? (
            <RevisionChecklistsPane
              revisionId={revision.id}
              checklists={revision.checklists}
              stage={revision.currentStage}
              requiresStripboard={project.requiresStripboard}
              disabled={isFrozen}
              disabledReason={
                isFrozen ? "Revision is frozen." : undefined
              }
            />
          ) : null}
        </div>

        {/* RIGHT 1/3 — Transitions + Errata */}
        <div className="space-y-6">
          <section className="glass-card p-4 sm:p-6">
            <h2 className="font-display text-2xl tracking-wider text-white">
              TRANSITIONS
            </h2>
            <div className="mt-4">
              <TransitionsLog transitions={revision.transitions} />
            </div>
          </section>

          <ErrataPane
            projectSlug={project.slug}
            revLabel={revision.label}
            errata={revision.errata.map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description,
              severity: e.severity,
              status: e.status,
              addressedByRevisionId: e.addressedByRevisionId,
            }))}
            linkableRevisions={linkableRevisions}
          />
        </div>
      </div>
    </main>
  );
}
