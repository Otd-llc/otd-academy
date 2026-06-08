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

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { GenerateGuideButton } from "@/components/guide/GenerateGuideButton";
import { GuideStepper } from "@/components/guide/GuideStepper";
import {
  resolveGuideProgress,
  resolveLearnerGuideProgress,
} from "@/lib/guide-progress";
import { auth } from "@/auth";
import { guideCardView } from "@/lib/guide-view";
import { resolveLessonAccess } from "@/lib/public-access";
import { hasProjectEntitlement } from "@/lib/entitlements";
import { courseJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  resolveCardCompletion,
  type CardCompletion,
  type CompletionState,
} from "@/lib/guide-completion";
import { completionRefSchema, type CompletionRef } from "@/lib/schemas/guide";

type Params = { slug: string; revLabel: string };

const DESIGN_STAGES = [
  "REQUIREMENTS",
  "BOM_SOURCING",
  "SCHEMATIC",
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

// Learner-facing label: their journey position, not author done/total counts.
function learnerStateLabel(state: CompletionState): string {
  switch (state) {
    case "complete":
      return "✓ Done";
    case "partial":
      return "In progress";
    default:
      return "Upcoming";
  }
}

function parseRef(value: unknown): CompletionRef {
  if (value == null) return { kind: "none" };
  const r = completionRefSchema.safeParse(value);
  return r.success ? r.data : { kind: "none" };
}

// SEO. Project-level title/description for the guide hub (the build-guide
// landing for a revision). Tight select; canonical/OG-image are per-card
// concerns handled on the card route (the hub canonicalizes to itself by
// default). OG images land in a later task (B2).
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });
  if (!project) return {};

  const title = `${project.name} — Build guide`;
  const description =
    project.description ??
    `Follow the ${project.name} build guide from design through bring-up.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
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
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      level: true,
      accessTier: true,
    },
  });
  if (!project) notFound();

  // Course JSON-LD — the project rendered as a schema.org Course (provider =
  // One Thousand Drones). Emitted on both the no-guide and the populated hub
  // renders since the project is the course regardless of guide materialization.
  const courseLd = courseJsonLd({
    name: project.name,
    description: project.description,
    level: project.level,
  });

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

  // Role decides the view: ADMINs see the shared reference revision's completion
  // (design roll-up + per-board build matrix); learners see their OWN journey and
  // never the operator build matrix.
  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === "ADMIN";

  // Page-level access gate. The hub is card-0 semantics (cardOrdinal: 0): a
  // PREMIUM project's hub is its public sales surface (allow), a FREE project's
  // hub still requires an account (redirect anonymous), PUBLIC is open. We load
  // the viewer's entitlement so an entitled premium learner is treated as
  // allowed even though card 0 already would be.
  let hasEntitlement = false;
  if (sessionEmail) {
    const viewer = await db.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true },
    });
    if (viewer) {
      hasEntitlement = await hasProjectEntitlement(db, viewer.id, project.id);
    }
  }
  if (
    resolveLessonAccess({
      accessTier: project.accessTier,
      cardOrdinal: 0,
      hasSession: !!sessionEmail,
      hasEntitlement,
      isAdmin,
    }) === "redirectSignIn"
  ) {
    redirect("/sign-in");
  }
  const view = guideCardView(session?.user?.role);
  const learnerEmail = session?.user?.email ?? null;
  let learnerCurrentStage: string | null = null;
  if (learnerEmail && view.isLearnerView) {
    const enrollment = await db.enrollment.findFirst({
      where: { projectId: project.id, user: { email: learnerEmail } },
      select: { currentStage: true },
    });
    learnerCurrentStage = enrollment?.currentStage ?? null;
  }

  const frozen = revision.frozenAt !== null;
  const activeBuild = revision.builds[0] ?? null;
  const revPath = `/projects/${project.slug}/${encodeURIComponent(revision.label)}`;
  const cardHref = (s: string) => `${revPath}/guide/${s}`;

  // ─── No guide yet ───────────────────────────────────────
  if (!revision.guide) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <JsonLd data={courseLd} />
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

  // The 8-stage order-of-operations rail: authors see revision completion,
  // learners see their own enrollment journey.
  const guideProgress = view.isAuthorView
    ? await resolveGuideProgress(revision.id, revision.guide.id)
    : resolveLearnerGuideProgress(learnerCurrentStage);

  // ─── Tier 1: design-stage roll-up ──────
  // Authors see the reference revision's completion (done/total); learners see
  // their own per-stage progress drawn from the same journey as the rail.
  const learnerStateByStage = new Map(
    guideProgress.map((s) => [s.stage, s.state]),
  );
  const designCells = await Promise.all(
    DESIGN_STAGES.map(async (stage) => {
      const card = cardByStage.get(stage);
      if (!card) return null;
      if (view.isAuthorView) {
        const completion = await resolveCardCompletion({
          revisionId: revision.id,
          stage,
          completionRef: parseRef(card.completionRef),
        });
        return {
          stage,
          card,
          state: completion.state,
          label: stateLabel(completion),
        };
      }
      const state = learnerStateByStage.get(stage) ?? "untouched";
      return { stage, card, state, label: learnerStateLabel(state) };
    }),
  );

  // ─── Tier 2: per-board build matrix (author/operator only) ──────
  const boards = activeBuild?.boards ?? [];
  // matrix[boardIndex][buildStageIndex] = completion. Builds/boards are operator
  // tooling — not computed or shown in the learner view.
  const matrix = view.isAuthorView
    ? await Promise.all(
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
      )
    : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={courseLd} />
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

      <div className="mb-8">
        <GuideStepper
          slug={project.slug}
          revLabel={revision.label}
          stages={guideProgress}
        />
      </div>

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
                  cell.state,
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
                  {cell.label}
                </span>
              </Link>
            ) : null,
          )}
        </div>
      </section>

      {/* ─── Tier 2: per-board build matrix (author/operator only) ─── */}
      {view.isAuthorView && (
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
      )}
    </main>
  );
}
