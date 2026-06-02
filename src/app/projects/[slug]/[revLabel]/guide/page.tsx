// Guide HUB route (M9 / Task 9.3; design §5, decision B).
//
// /projects/[slug]/[revLabel]/guide — the two-tier roll-up:
//   Tier 1 — a card grid for the DESIGN stages (REQUIREMENTS → ORDERING), each
//            a link to its card route, colored gold (complete) / blue (partial)
//            / muted (untouched/blocked) via resolveCardCompletion.
//   Tier 2 — a per-board MATRIX for the build stages (ASSEMBLY / BRINGUP): rows
//            = boards (B01…Bn of the active build), each cell = that build
//            card's per-board completion. No active build / no boards →
//            "blocked until a build/boards exist."
//
// No guide yet → a prominent "Generate build guide" button (materializeGuide).
// Frozen revision → render the design cards' historical state read-only and DO
// NOT present the generate button (active build is null, so the build matrix
// resolves to blocked); the page never crashes.

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { GenerateGuideButton } from "@/components/guide/GenerateGuideButton";
import {
  resolveCardCompletion,
  type CardCompletion,
  type CompletionState,
} from "@/lib/guide-completion";
import { completionRefSchema, type CompletionRef } from "@/lib/schemas/guide";

type Params = { slug: string; revLabel: string };

const DESIGN_STAGES = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
] as const;
const BUILD_STAGES = ["ASSEMBLY", "BRINGUP"] as const;

// state → bench palette (gold complete / blue partial / red blocked / muted).
function stateClasses(state: CompletionState): string {
  switch (state) {
    case "complete":
      return "border-status-green text-status-green";
    case "partial":
      return "border-command-gold text-command-gold";
    case "blocked":
      return "border-alert-red text-alert-red";
    case "untouched":
    default:
      return "border-panel-border text-muted";
  }
}

function stateLabel(c: CardCompletion): string {
  switch (c.state) {
    case "complete":
      return "✓ Complete";
    case "partial":
      return `${c.done}/${c.total}`;
    case "blocked":
      return "Blocked";
    case "untouched":
    default:
      return "Not started";
  }
}

function parseRef(value: unknown): CompletionRef {
  if (value == null) return { kind: "none" };
  const r = completionRefSchema.safeParse(value);
  return r.success ? r.data : { kind: "none" };
}

export default async function GuideHubPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, revLabel } = await params;
  const decodedLabel = decodeURIComponent(revLabel);

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!project) notFound();

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: decodedLabel, mode: "insensitive" },
    },
    select: {
      id: true,
      label: true,
      currentStage: true,
      frozenAt: true,
      guide: {
        select: {
          id: true,
          cards: {
            orderBy: { ordinal: "asc" },
            select: {
              id: true,
              stage: true,
              ordinal: true,
              eyebrow: true,
              title: true,
              lead: true,
              completionRef: true,
            },
          },
        },
      },
      builds: {
        where: { frozenAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          label: true,
          boards: {
            orderBy: { serial: "asc" },
            select: { id: true, serial: true, status: true },
          },
        },
      },
    },
  });
  if (!revision) notFound();

  const frozen = revision.frozenAt !== null;
  const activeBuild = revision.builds[0] ?? null;
  const revPath = `/projects/${project.slug}/${encodeURIComponent(revision.label)}`;
  const cardHref = (s: string) => `${revPath}/guide/${s}`;

  // ─── No guide yet ───────────────────────────────────────
  if (!revision.guide) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <PageHeader
          backHref={revPath}
          backLabel={revision.label}
          eyebrow="BUILD GUIDE"
          title={project.name}
          accentWord={project.name.trim().split(/\s+/).pop()}
          lead="Generate the build guide to walk this revision through the full design → bring-up pipeline."
          meta={[
            { label: "Project", value: project.name },
            { label: "Revision", value: revision.label },
            { label: "Build", value: activeBuild ? activeBuild.label : "—" },
            { label: "Stage", value: revision.currentStage },
          ]}
        />
        {frozen ? (
          <p className="font-mono text-sm uppercase tracking-wider text-muted">
            Revision is frozen — no guide exists and none can be generated.
          </p>
        ) : (
          <GenerateGuideButton revisionId={revision.id} />
        )}
      </main>
    );
  }

  const cards = revision.guide.cards;
  const cardByStage = new Map(cards.map((c) => [c.stage, c]));

  // ─── Tier 1: design-stage roll-up (revision-level) ──────
  const designCells = await Promise.all(
    DESIGN_STAGES.map(async (stage) => {
      const card = cardByStage.get(stage);
      if (!card) return null;
      const completionRef = parseRef(card.completionRef);
      const completion = await resolveCardCompletion({
        revisionId: revision.id,
        stage,
        completionRef,
      });
      return { stage, card, completion };
    }),
  );

  // ─── Tier 2: per-board build matrix ─────────────────────
  const boards = activeBuild?.boards ?? [];
  // matrix[boardIndex][buildStageIndex] = completion
  const matrix = await Promise.all(
    boards.map(async (board) =>
      Promise.all(
        BUILD_STAGES.map(async (stage) => {
          const card = cardByStage.get(stage);
          if (!card) return null;
          const completionRef = parseRef(card.completionRef);
          const completion = await resolveCardCompletion({
            revisionId: revision.id,
            stage,
            completionRef,
            boardId: board.id,
          });
          return completion;
        }),
      ),
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        backHref={revPath}
        backLabel={revision.label}
        eyebrow="BUILD GUIDE"
        title={project.name}
        accentWord={project.name.trim().split(/\s+/).pop()}
        lead={
          frozen
            ? "This revision is frozen — the guide is shown read-only at its historical state."
            : "Walk this revision through the full design → bring-up pipeline. Design stages roll up per revision; build stages track per board."
        }
        meta={[
          { label: "Project", value: project.name },
          { label: "Revision", value: revision.label },
          { label: "Build", value: activeBuild ? activeBuild.label : "—" },
          { label: "Stage", value: revision.currentStage },
        ]}
      />

      {/* ─── Tier 1: design-stage card grid ─── */}
      <section>
        <h2 className="font-display text-2xl tracking-wider text-white">
          DESIGN STAGES
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designCells.map((cell) =>
            cell ? (
              <Link
                key={cell.stage}
                href={cardHref(cell.stage)}
                className={`glass-card flex flex-col gap-2 border-l-4 p-4 transition-colors hover:bg-command-gold/5 ${stateClasses(
                  cell.completion.state,
                )}`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-command-gold">
                  {cell.card.eyebrow}
                </span>
                <span className="font-display text-xl tracking-wider text-white">
                  {cell.card.title}
                </span>
                {cell.card.lead ? (
                  <span className="font-serif text-sm italic text-muted">
                    {cell.card.lead}
                  </span>
                ) : null}
                <span className="mt-1 font-mono text-xs font-bold uppercase tracking-wider">
                  {stateLabel(cell.completion)}
                </span>
              </Link>
            ) : null,
          )}
        </div>
      </section>

      {/* ─── Tier 2: per-board build matrix ─── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-wider text-white">
          BUILD STAGES{" "}
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            (per board)
          </span>
        </h2>

        {!activeBuild || boards.length === 0 ? (
          <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
            {frozen
              ? "Revision frozen — build stages are blocked (no active build)."
              : !activeBuild
                ? "Blocked until a build exists. Create a build on the revision (DRC_GERBER onward)."
                : "Blocked until boards are registered on the active build."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table-tech min-w-full">
              <thead>
                <tr>
                  <th>Board</th>
                  {BUILD_STAGES.map((stage) => {
                    const card = cardByStage.get(stage);
                    return (
                      <th key={stage}>
                        {card ? (
                          <Link
                            href={cardHref(stage)}
                            className="hover:underline"
                          >
                            {card.title}
                          </Link>
                        ) : (
                          stage
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {boards.map((board, bi) => (
                  <tr key={board.id}>
                    <td>
                      <span className="ref">{board.serial}</span>{" "}
                      <span className="text-muted">{board.status}</span>
                    </td>
                    {BUILD_STAGES.map((stage, si) => {
                      const completion = matrix[bi]?.[si];
                      if (!completion) {
                        return (
                          <td key={stage} className="text-muted">
                            —
                          </td>
                        );
                      }
                      const cardHrefWithBoard = `${cardHref(stage)}?board=${board.id}`;
                      return (
                        <td key={stage}>
                          <Link
                            href={cardHrefWithBoard}
                            className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${stateClasses(
                              completion.state,
                            )}`}
                          >
                            {stateLabel(completion)}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
