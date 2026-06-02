// Build-aware gate context loader (Task 7.3 / design §5.2).
//
// Loads everything `STAGES[stage].exitGate(ctx)` needs in a few small
// `findFirst`/`findMany` calls (Prisma doesn't compose all four shapes
// into one query because the active-Build sub-graph is a separate include
// tree). Pass either the global `db` client or a Prisma transaction client
// — the function signature accepts both.
//
// Important context-shape rules (design §5.2):
//   - `revision`     — Pick fields only: id, currentStage, schematicCommit,
//                      layoutCommit. Gates never need the audit columns.
//   - `bomLines`     — every BomLine on the revision, each with its Part
//                      eagerly joined (the BOM_SOURCING gate checks
//                      `part.datasheetUrl` + `part.lifecycle`).
//   - `artifacts`    — revision-scoped artifacts filtered to the **current
//                      stage** only. Build-scoped artifacts (PCB_ORDER,
//                      BRINGUP_LOG, etc.) ride on `activeBuild.artifacts`.
//   - `activeBuild`  — the unique unfrozen Build, or null. Phase 1 invariant
//                      keeps this at most one; the partial unique index
//                      `build_one_unfrozen_per_revision` (§4.3) is the
//                      backstop. `orderBy: createdAt desc` is belt-and-
//                      suspenders for the rare race window before the
//                      index check fires.
//
// The loader does NOT enforce the revision-exists invariant — callers
// already render the revision detail page (`notFound()` on miss). For
// programmatic callers, `findUniqueOrThrow` keeps the error explicit.

import type { Prisma, PrismaClient } from "@prisma/client";
import type { GateContext } from "@/lib/stages";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function loadGateContext(
  tx: TxClient,
  revisionId: string,
): Promise<GateContext> {
  const revision = await tx.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: {
      id: true,
      currentStage: true,
      schematicCommit: true,
      layoutCommit: true,
    },
  });

  // m17 / m18: surface the parent Project's gate-relevant flags.
  // `requiresStripboard` (m17) and `hasMainsNet` (m18) both feed into the
  // BOM_SOURCING gate predicate.
  const project = await tx.project.findFirstOrThrow({
    where: { revisions: { some: { id: revisionId } } },
    select: { id: true, requiresStripboard: true, hasMainsNet: true },
  });

  const bomLines = await tx.bomLine.findMany({
    where: { revisionId },
    include: { part: true },
  });

  const artifacts = await tx.artifact.findMany({
    where: { revisionId, stage: revision.currentStage },
  });

  // m15: revision-scoped checklists across ALL stages. Each gate predicate
  // (REQUIREMENTS_REVIEW, LAYOUT_REVIEW — m16) owns its subkind→stage
  // policy; the loader stays scope-agnostic.
  const revisionChecklists = await tx.checklist.findMany({
    where: { revisionId },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const activeBuild = await tx.build.findFirst({
    where: { revisionId, frozenAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      boards: true,
      artifacts: true,
      checklists: { include: { items: true } },
    },
  });

  return {
    revision,
    project,
    bomLines,
    artifacts,
    revisionChecklists,
    activeBuild,
  };
}
