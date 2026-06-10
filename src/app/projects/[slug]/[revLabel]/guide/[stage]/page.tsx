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

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canonicalLessonPath } from "@/lib/seo/canonical";
import {
  breadcrumbJsonLd,
  guideCardToHowTo,
  siteUrl,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
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
import { auth } from "@/auth";
import { LearnerGate } from "@/components/learn/LearnerGate";
import { Paywall } from "@/components/learn/Paywall";
import { gateSpec } from "@/lib/gate-spec";
import { proofHelp } from "@/lib/learner-proof-help";
import { guideCardView } from "@/lib/guide-view";
import { resolveLessonAccess } from "@/lib/public-access";
import { hasProjectEntitlement } from "@/lib/entitlements";
import { resolveCardCompletion } from "@/lib/guide-completion";
import {
  resolveGuideProgress,
  resolveLearnerGuideProgress,
} from "@/lib/guide-progress";
import { buildStageGateWidget } from "@/lib/guide-widget";
import {
  GUIDE_STAGES,
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import { STAGE_LABELS } from "@/lib/stages";
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

// SEO. Runs separately from the component, so it re-resolves only what the
// tags need (project name + published-revision label for the canonical, plus
// the card title/lead) with tight selects. The canonical always points at the
// PUBLISHED revision (not the viewed `revLabel`) so crawlers consolidate on one
// URL; when the project has no published revision we omit `alternates.canonical`.
// OG images land in a later task (B2).
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, revLabel, stage: stageParam } = await params;
  const stageUpper = stageParam.toUpperCase();

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      name: true,
      accessTier: true,
      publishedRevision: { select: { label: true } },
    },
  });
  if (!project) return {};

  const decodedLabel = decodeURIComponent(revLabel);
  const card = isGuideStage(stageUpper)
    ? await db.guideCard.findFirst({
        where: {
          stage: stageUpper,
          guide: {
            revision: {
              project: { slug },
              label: { equals: decodedLabel, mode: "insensitive" },
            },
          },
        },
        select: { title: true, lead: true, ordinal: true },
      })
    : null;

  const cardTitle = card?.title ?? stageUpper;
  const title = `${cardTitle} — ${project.name}`;
  const canonical = canonicalLessonPath({
    slug,
    publishedLabel: project.publishedRevision?.label ?? null,
    stage: stageUpper,
  });

  // A paywalled PREMIUM card (any card but the free card-0 preview) must NOT
  // leak its lead into the description/OG and must not be indexed. Use a generic
  // description and noindex it. PUBLIC/FREE, and a premium card-0, keep the
  // normal lead-driven metadata. (card.ordinal is null only when the stage has
  // no card — which the page 404s — so treat that as the non-walled default.)
  const isWalledPremiumCard =
    project.accessTier === "PREMIUM" && (card?.ordinal ?? 0) !== 0;
  if (isWalledPremiumCard) {
    const description = `A premium lesson in ${project.name}.`;
    return {
      title,
      description,
      robots: { index: false, follow: true },
      alternates: canonical ? { canonical } : undefined,
      openGraph: {
        title,
        description,
        type: "article",
        url: canonical ?? undefined,
      },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  const description =
    card?.lead ?? `${project.name}: ${stageUpper} stage of the build guide.`;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical ?? undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
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
    select: {
      id: true,
      slug: true,
      name: true,
      accessTier: true,
      stripePriceId: true,
      priceCents: true,
    },
  });
  if (!project) notFound();

  // Page-level access gate (hoisted above the no-guide return + R2 work). The
  // page is auth-gated by middleware, which admits guide routes for anonymous
  // visitors; this page is the real gate. accessTier is the access product:
  // PUBLIC is anonymous-readable; FREE needs an account; PREMIUM needs an
  // Entitlement, except its card 0 (the free preview / sales surface).
  // Role decides the ENTIRE view below: ADMINs author/QA the shared reference
  // revision (Stage Gate, edit-in-place, board selector); everyone else is a
  // learner who sees only their own per-enrollment overlay. We never leak author
  // tooling to a learner, nor the learner overlay to an admin (even one who
  // happens to be enrolled). Gating here (right after the project resolves)
  // avoids doing wasted R2 presigning on a card the viewer can't read.
  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === "ADMIN";

  // Resolve this stage's card ordinal cheaply for the gate (card 0 of a PREMIUM
  // project is the free preview). A stage with no card here will notFound()
  // below anyway; treat its ordinal as 0 (no leak — the page 404s regardless).
  const gateCard = await db.guideCard.findFirst({
    where: {
      stage,
      guide: { revision: { projectId: project.id, label: { equals: decodedLabel, mode: "insensitive" } } },
    },
    select: { ordinal: true },
  });
  const cardOrdinal = gateCard?.ordinal ?? 0;

  // Entitlement is a signed-in-only concern; resolve the viewer's user id from
  // their session email solely to look up their entitlement here (the learner
  // overlay below re-queries enrollments by email, so it does not reuse this id).
  let viewerUserId: string | null = null;
  let hasEntitlement = false;
  if (sessionEmail) {
    const viewer = await db.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true },
    });
    viewerUserId = viewer?.id ?? null;
    if (viewerUserId) {
      hasEntitlement = await hasProjectEntitlement(db, viewerUserId, project.id);
    }
  }

  const decision = resolveLessonAccess({
    accessTier: project.accessTier,
    cardOrdinal,
    hasSession: !!sessionEmail,
    hasEntitlement,
    isAdmin,
  });
  if (decision === "redirectSignIn") redirect("/sign-in");
  if (decision === "paywall") {
    return (
      <Paywall
        projectId={project.id}
        projectName={project.name}
        stripePriceId={project.stripePriceId}
        priceCents={project.priceCents}
        signedIn={!!sessionEmail}
      />
    );
  }

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

  // Role decides the view (session resolved + access-gated above).
  const view = guideCardView(session?.user?.role);
  const learnerEmail = session?.user?.email ?? null;

  // Edit-in-place is author-only, additionally blocked on a frozen revision
  // (defense-in-depth: editGuideCard rejects frozen edits regardless).
  const canEdit = !frozen && view.isAuthorView;

  // Learner overlay (learner view only): if the signed-in learner has an
  // enrollment on this board, the quiz records against it and on their CURRENT
  // stage we surface the advance affordance.
  const gate = gateSpec(stage);
  const proofArtifact = gate.artifact;
  const proofHelpData = proofArtifact ? proofHelp(proofArtifact.subkind) : null;
  const cardHasQuiz = blocks.some((b) => b.type === "quiz");
  let learnerQuizContext:
    | { enrollmentId: string; stage: string; passed: boolean }
    | undefined;
  let showLearnerAdvance = false;
  let learnerQuizPassed = false;
  let learnerHasProof = false;
  let learnerCurrentStage: string | null = null;
  if (learnerEmail && view.isLearnerView) {
    const enrollment = await db.enrollment.findFirst({
      where: { projectId: project.id, user: { email: learnerEmail } },
      select: {
        id: true,
        currentStage: true,
        quizPasses: { where: { stage }, select: { stage: true } },
        artifacts: { select: { subkind: true } },
      },
    });
    if (enrollment) {
      learnerCurrentStage = enrollment.currentStage;
      learnerQuizPassed = enrollment.quizPasses.length > 0;
      learnerQuizContext = {
        enrollmentId: enrollment.id,
        stage,
        passed: learnerQuizPassed,
      };
      showLearnerAdvance = enrollment.currentStage === stage;
      learnerHasProof =
        proofArtifact != null &&
        enrollment.artifacts.some((a) => a.subkind === proofArtifact.subkind);
    }
  }

  // The 8-stage "order of operations" rail. ADMINs see the shared reference
  // revision's completion (board-scoped on the build cards); learners see their
  // OWN journey derived from their enrollment's currentStage.
  const guideProgress = view.isAuthorView
    ? await resolveGuideProgress(revision.id, revision.guide.id, selectedBoardId)
    : resolveLearnerGuideProgress(learnerCurrentStage);

  // ─── Structured data (JSON-LD) — public SEO surface ───
  // HowTo from the resolved card (reusing the already-parsed `blocks` — no
  // re-query); Breadcrumb trail Home › Courses › Project › Stage with absolute
  // URLs. Both are emitted as inline <script type="application/ld+json">.
  const base = siteUrl();
  const howToJsonLd = guideCardToHowTo({
    cardTitle: card.title,
    cardLead: card.lead,
    contentBlocks: blocks,
  });
  const lessonBreadcrumbJsonLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Courses", url: `${base}/courses` },
    { name: project.name, url: `${base}${hubHref}` },
    { name: card.title, url: `${base}${cardHref(stage)}` },
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd data={howToJsonLd} />
      <JsonLd data={lessonBreadcrumbJsonLd} />
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
          meta={
            // The stepper owns "where am I", so the strip drops the redundant
            // card number. Learners get a lean Phase / Project; the operator
            // (author) view keeps the Build pointer.
            view.isAuthorView
              ? [
                  { label: "Phase", value: STAGE_LABELS[stage] },
                  { label: "Project", value: project.name },
                  { label: "Build", value: activeBuild ? activeBuild.label : "—" },
                ]
              : [
                  { label: "Phase", value: STAGE_LABELS[stage] },
                  { label: "Project", value: project.name },
                ]
          }
        />

        <GuideBlocks
          blocks={blocks}
          models={models}
          quizContext={learnerQuizContext}
          projectId={project.id}
          isSignedIn={!!sessionEmail}
        />
      </GuideCardEditor>

      {/* Per-board scope selector (ASSEMBLY / BRINGUP) — author tooling, drives
          the Stage Gate's per-board widget; hidden in the learner view. */}
      {isPerBoard && view.isAuthorView ? (
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

      {showLearnerAdvance && (
        <LearnerGate
          projectId={project.id}
          stage={stage}
          cardBaseHref={hubHref}
          guideStages={GUIDE_STAGES}
          quizRequired={gate.quiz}
          quizPassed={learnerQuizPassed}
          cardHasQuiz={cardHasQuiz}
          artifact={
            proofArtifact && proofHelpData
              ? {
                  label: proofArtifact.label,
                  accept: proofArtifact.accept,
                  requirement: proofHelpData.requirement,
                  howToTitle: proofHelpData.howToTitle,
                  steps: proofHelpData.steps,
                  onFile: learnerHasProof,
                }
              : null
          }
        />
      )}

      {/* STAGE GATE is the author's completion substrate (review checklists,
          commit/board widgets) for the shared reference revision — admin only.
          Learners advance via their own YOUR TRACK panel above. */}
      {view.isAuthorView && (
        <StageGate completion={completion} widget={widget} />
      )}

      {/* Stage browser — FREE navigation across the guide, distinct from the
          gated YOUR TRACK advance above. The "Browse stages" caption + friendly
          labels keep it from reading as the progress button. */}
      <nav className="mt-12 border-t border-panel-border pt-6">
        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-gray-3">
          Browse stages
        </p>
        <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider">
          {prevStage ? (
            <Link
              href={cardHref(prevStage)}
              className="inline-flex items-center gap-1.5 text-link-muted transition-colors hover:text-command-gold"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              {STAGE_LABELS[prevStage]}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted opacity-40">
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              {STAGE_LABELS[stage]}
            </span>
          )}
          <Link
            href={hubHref}
            className="text-command-gold transition-colors hover:underline"
          >
            Build guide
          </Link>
          {nextStage ? (
            <Link
              href={cardHref(nextStage)}
              className="inline-flex items-center gap-1.5 text-link-muted transition-colors hover:text-command-gold"
            >
              {STAGE_LABELS[nextStage]}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted opacity-40">
              {STAGE_LABELS[stage]}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </nav>
    </main>
  );
}
