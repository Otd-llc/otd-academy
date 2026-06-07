// Guide CARD route (M9 / Task 9.2; design §5).
//
// /projects/[slug]/[revLabel]/guide/[stage] — one teaching card per pipeline
// stage. RSC: resolves the project → revision → guide → card by (slug,
// revLabel, stage), then renders:
//   - PageHeader  (bench-hero; eyebrow=card.eyebrow, title=card.title with a
//                  sensible trailing accent word; meta-strip Card NN/TT / Phase
//                  / Project / Build; backHref=hub)
//   - GuideBlocks (the card's teaching contentBlocks)
//   - a board selector on ASSEMBLY/BRINGUP (decision B — per-board scope via the
//     ?board search param)
//   - StageGate   (the uniform completion footer, fed by resolveCardCompletion
//                  + buildStageGateWidget)
//   - prev / CONSOLE / next nav across GUIDE_STAGES.
//
// Graceful states: an unknown stage → notFound(); a revision with no guide yet
// → a "Generate guide" affordance (the hub owns the primary button, but a card
// deep-link shouldn't 500); a guide missing this stage's card → notFound().

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { GuideBlocks, type ResolvedModel } from "@/components/guide/GuideBlocks";
import { GuideCardEditor } from "@/components/guide/GuideCardEditor";
import { GuideStepper } from "@/components/guide/GuideStepper";
import { getPartAssetRenderUrl } from "@/lib/actions/part-assets";
import { renderBoundsSchema } from "@/lib/schemas/part-asset";
import { StageGate } from "@/components/guide/StageGate";
import { BoardSelector } from "@/components/guide/BoardSelector";
import { GenerateGuideButton } from "@/components/guide/GenerateGuideButton";
import { resolveCardCompletion } from "@/lib/guide-completion";
import { resolveGuideProgress } from "@/lib/guide-progress";
import { buildStageGateWidget } from "@/lib/guide-widget";
import {
  GUIDE_STAGES,
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import {
  completionRefSchema,
  guideContentBlocksSchema,
  type CompletionRef,
} from "@/lib/schemas/guide";

type Params = { slug: string; revLabel: string; stage: string };
type Search = { board?: string };

// Per-board scope applies to the two build cards (decision B).
const PER_BOARD_STAGES: ReadonlySet<GuideStage> = new Set([
  "ASSEMBLY",
  "BRINGUP",
]);

function isGuideStage(s: string): s is GuideStage {
  return (GUIDE_STAGES as readonly string[]).includes(s);
}

// Pick a sensible trailing accent word for the hero (the last whitespace- or
// slash-delimited token of the title — e.g. "DRC / GERBER" → "GERBER",
// "BOM SOURCING" → "SOURCING", "REQUIREMENTS" → "REQUIREMENTS").
function accentWordFor(title: string): string {
  const tokens = title.trim().split(/[\s/]+/).filter(Boolean);
  return tokens[tokens.length - 1] ?? title;
}

export default async function GuideCardPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug, revLabel, stage: stageParam } = await params;
  const { board: boardParam } = await searchParams;
  const decodedLabel = decodeURIComponent(revLabel);
  const stageUpper = stageParam.toUpperCase();

  if (!isGuideStage(stageUpper)) notFound();
  const stage: GuideStage = stageUpper;

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
      frozenAt: true,
      guide: { select: { id: true } },
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

  const hubHref = `/projects/${project.slug}/${encodeURIComponent(revision.label)}/guide`;
  const frozen = revision.frozenAt !== null;

  // No guide materialized yet → offer to generate it (deep-link safety).
  if (!revision.guide) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <PageHeader
          backHref={hubHref}
          backLabel="Build guide"
          eyebrow="BUILD GUIDE"
          title="No guide yet"
          accentWord="yet"
          lead="This revision has no build guide. Generate it to walk the design → bring-up pipeline."
        />
        {frozen ? (
          <p className="font-mono text-sm uppercase tracking-wider text-muted">
            Revision is frozen — no guide can be generated.
          </p>
        ) : (
          <GenerateGuideButton revisionId={revision.id} />
        )}
      </main>
    );
  }

  const card = await db.guideCard.findFirst({
    where: { guideId: revision.guide.id, stage },
    select: {
      id: true,
      stage: true,
      ordinal: true,
      eyebrow: true,
      title: true,
      lead: true,
      contentBlocks: true,
      completionRef: true,
    },
  });
  if (!card) notFound();

  // Parse JSON columns through the Zod schemas (defense-in-depth + typing).
  const blocksResult = guideContentBlocksSchema.safeParse(card.contentBlocks);
  const blocks = blocksResult.success ? blocksResult.data : [];

  // Resolve any partModel blocks → presigned MODEL_3D render URL + camera bounds,
  // keyed by MPN. An MPN with no part / no 3D asset / R2 off is simply omitted,
  // and the block degrades to its caption.
  const modelMpns = Array.from(
    new Set(blocks.flatMap((b) => (b.type === "partModel" && b.mpn ? [b.mpn] : []))),
  );
  const models: Record<string, ResolvedModel> = {};
  for (const mpn of modelMpns) {
    const part = await db.part.findFirst({ where: { mpn }, select: { id: true } });
    if (!part) continue;
    const src = await getPartAssetRenderUrl(part.id);
    if (!src) continue;
    const asset = await db.partAsset.findUnique({
      where: { partId_kind: { partId: part.id, kind: "MODEL_3D" } },
      select: { renderBounds: true },
    });
    models[mpn] = {
      src,
      bounds: renderBoundsSchema.safeParse(asset?.renderBounds).data ?? null,
    };
  }

  let completionRef: CompletionRef = { kind: "none" };
  if (card.completionRef != null) {
    const refResult = completionRefSchema.safeParse(card.completionRef);
    if (refResult.success) completionRef = refResult.data;
  }

  // Board scope (decision B) — only the two build cards carry a selector.
  const activeBuild = revision.builds[0] ?? null;
  const isPerBoard = PER_BOARD_STAGES.has(stage);
  const boards = activeBuild?.boards ?? [];
  // Resolve the selected board: explicit ?board (validated to belong to the
  // build), else the first board. Undefined when there's no per-board scope.
  let selectedBoardId: string | undefined;
  if (isPerBoard && boards.length > 0) {
    const valid = boardParam && boards.some((b) => b.id === boardParam);
    selectedBoardId = valid ? boardParam : boards[0]!.id;
  }

  const completion = await resolveCardCompletion({
    revisionId: revision.id,
    stage,
    completionRef,
    boardId: selectedBoardId,
  });

  const widget = await buildStageGateWidget({
    revisionId: revision.id,
    stage,
    completionRef,
    slug: project.slug,
    revLabel: revision.label,
    boardId: selectedBoardId,
    frozen,
    completion,
  });

  // The 8-stage "order of operations" rail (board-scoped on the build cards).
  const guideProgress = await resolveGuideProgress(
    revision.id,
    revision.guide.id,
    selectedBoardId,
  );

  // Quizzes are learner-only now (recorded per Enrollment). The author preview
  // has no enrollment, so it renders the quiz cards without a recording context;
  // the enrollment-aware learner guide (Task 4.2) supplies the live quizContext.

  // prev / next across GUIDE_STAGES.
  const idx = GUIDE_STAGES.indexOf(stage);
  const prevStage = idx > 0 ? GUIDE_STAGES[idx - 1] : null;
  const nextStage =
    idx < GUIDE_STAGES.length - 1 ? GUIDE_STAGES[idx + 1] : null;
  const cardHref = (s: string) =>
    `/projects/${project.slug}/${encodeURIComponent(revision.label)}/guide/${s}`;

  const cardNumber = String(card.ordinal + 1).padStart(2, "0");
  const cardTotal = String(GUIDE_STAGES.length).padStart(2, "0");

  // The page is auth-gated by middleware, so a session exists; the only
  // additional editability gate is the revision freeze (defense-in-depth:
  // editGuideCard rejects edits on a frozen revision regardless).
  const canEdit = !frozen;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <GuideStepper
          slug={project.slug}
          revLabel={revision.label}
          stages={guideProgress}
          viewingStage={stage}
        />
      </div>
      {/* Inline edit-in-place island: view mode renders the server-rendered
          PageHeader + GuideBlocks below as `children`; edit mode swaps in the
          authoring forms. StageGate + nav stay OUTSIDE (gate-wiring locked). */}
      <GuideCardEditor
        cardId={card.id}
        eyebrow={card.eyebrow}
        title={card.title}
        lead={card.lead}
        blocks={blocks}
        canEdit={canEdit}
      >
        <PageHeader
          backHref={hubHref}
          backLabel="Build guide"
          eyebrow={card.eyebrow}
          title={card.title}
          accentWord={accentWordFor(card.title)}
          lead={card.lead ?? undefined}
          meta={[
            { label: "Card", value: `${cardNumber} / ${cardTotal}` },
            { label: "Phase", value: stage },
            { label: "Project", value: project.name },
            {
              label: "Build",
              value: activeBuild ? activeBuild.label : "—",
            },
          ]}
        />

        <GuideBlocks blocks={blocks} models={models} />
      </GuideCardEditor>

      {/* Per-board scope selector (ASSEMBLY / BRINGUP). */}
      {isPerBoard ? (
        <div className="mt-8">
          {boards.length > 0 && selectedBoardId ? (
            <BoardSelector boards={boards} selectedBoardId={selectedBoardId} />
          ) : (
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              {activeBuild
                ? "Blocked — no boards registered on the active build yet."
                : "Blocked — needs an active build with boards."}
            </p>
          )}
        </div>
      ) : null}

      <StageGate completion={completion} widget={widget} />

      {/* prev / CONSOLE / next nav. */}
      <nav className="mt-12 flex items-center justify-between border-t border-panel-border pt-6 font-mono text-xs uppercase tracking-wider">
        {prevStage ? (
          <Link
            href={cardHref(prevStage)}
            className="inline-flex items-center gap-1.5 text-link-muted transition-colors hover:text-command-gold"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            {prevStage}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted opacity-40">
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            {stage}
          </span>
        )}
        <Link
          href={hubHref}
          className="text-command-gold transition-colors hover:underline"
        >
          CONSOLE
        </Link>
        {nextStage ? (
          <Link
            href={cardHref(nextStage)}
            className="inline-flex items-center gap-1.5 text-link-muted transition-colors hover:text-command-gold"
          >
            {nextStage}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted opacity-40">
            {stage}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </nav>
    </main>
  );
}
