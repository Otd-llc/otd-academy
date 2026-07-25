// Learner board page. Hero (locked design): the build-stage comb, the board title
// + level gauge (real data: level, track, stages, BOM parts), the click-to-load 3D
// board, and a state-dependent primary CTA — Enroll / Resume / View completion.
// Below the hero: the state extras (first-board checklist, exam, locked prereqs,
// not-open). Mobile: comb → title → board → lead → the rest (see the flatten below).
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { learnerBoardAvailability } from "@/lib/learner-board-availability";
import { STAGE_LABELS, type StageName } from "@/lib/stages";
import { GUIDE_STAGES, type GuideStage } from "@/lib/guide-templates/stage-skeletons";
import { resolveLearnerGuideProgress } from "@/lib/guide-progress";
import { EnrollButton } from "@/components/learn/EnrollButton";
import { ClickToLoadBoard } from "@/components/learn/ClickToLoadBoard";
import { PhaseComb } from "@/components/guide/PhaseComb";
import { getArtifactRenderUrl } from "@/lib/actions/uploads";
import { renderBoundsSchema, type RenderBounds } from "@/lib/schemas/part-asset";
import { ChevronLeftIcon } from "@/components/icons";

function guideHref(slug: string, revLabel: string, stage: string): string {
  return `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${stage}`;
}

const N = "font-numeral tabular-nums leading-none text-command-gold";
const L = "font-mono uppercase tracking-[0.16em] text-muted";
const CTA = "glass-button glass-button-cta w-full py-5 text-center font-mono text-base uppercase tracking-[0.18em]";
const SECONDARY = "text-center font-mono text-xs uppercase tracking-[0.16em] text-command-gold underline decoration-command-gold/40 underline-offset-4 hover:text-gold-light";

export default async function LearnerBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUserOrRedirect(`/learn/${slug}`);

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      level: true,
      track: true,
      publishedRevisionId: true,
      publishedRevision: {
        select: { label: true, _count: { select: { bomLines: true } } },
      },
      exam: { select: { id: true } },
    },
  });
  if (!project) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: { currentStage: true, status: true },
  });

  const availability = await learnerBoardAvailability(user.id);
  const entry = availability.find((b) => b.projectId === project.id);
  const locked = entry ? !entry.available : false;

  const revLabel = project.publishedRevision?.label ?? null;
  const isAdmin = user.role === "ADMIN";
  const partsCount = project.publishedRevision?._count.bomLines ?? 0;
  const levelNum = (project.level ?? "").replace(/\D/g, "") || project.level || "·";

  // Completed-board 3D model: a MODEL_3D artifact on the published (reference)
  // revision. Renders as the click-to-load hero when it exists; admin-only "to be
  // added" placeholder otherwise (students/public see nothing until it's uploaded).
  let boardModel: { src: string; bounds: RenderBounds | null } | null = null;
  if (project.publishedRevisionId) {
    const m = await db.artifact.findFirst({
      where: {
        revisionId: project.publishedRevisionId,
        buildId: null,
        subkind: "MODEL_3D",
        renderKey: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, renderBounds: true },
    });
    if (m) {
      const src = await getArtifactRenderUrl(m.id);
      if (src) {
        boardModel = {
          src,
          bounds: renderBoundsSchema.safeParse(m.renderBounds).data ?? null,
        };
      }
    }
  }

  // Build-stage comb progress from the learner's currentStage (same helper the
  // guide pages use). Not enrolled → all untouched.
  const guideProgress = resolveLearnerGuideProgress(enrollment?.currentStage ?? null);
  const viewingStage: GuideStage = (enrollment?.currentStage as GuideStage) ?? GUIDE_STAGES[0]!;
  const stageIdx = enrollment ? GUIDE_STAGES.indexOf(enrollment.currentStage as GuideStage) : -1;
  const notOpen = !project.publishedRevisionId || !revLabel;
  const isEnrolled = !!enrollment;
  const isDone = !!enrollment && enrollment.status !== "IN_PROGRESS";
  // Stages cleared: in-progress = index of current; done = all.
  const doneCount = !isEnrolled ? 0 : isDone ? GUIDE_STAGES.length : Math.max(0, stageIdx);
  const hasExtras = notOpen || (locked && !isEnrolled) || (isDone && !!project.exam);

  // Primary CTA (state-dependent).
  let primaryCta: ReactNode = null;
  if (!notOpen && revLabel) {
    if (!isEnrolled && !locked) {
      primaryCta = (
        <EnrollButton
          projectId={project.id}
          continueHref={guideHref(project.slug, revLabel, "REQUIREMENTS")}
          label="Start building →"
          busyLabel="Starting…"
          className={CTA}
        />
      );
    } else if (isEnrolled && !isDone) {
      primaryCta = (
        <Link href={guideHref(project.slug, revLabel, enrollment!.currentStage)} className={CTA}>
          Resume the build →
        </Link>
      );
    } else if (isEnrolled && isDone) {
      primaryCta = (
        <Link href={`/learn/${project.slug}/complete`} className={CTA}>
          View completion →
        </Link>
      );
    }
  }
  const secondary =
    !notOpen && revLabel && !isEnrolled && !locked ? (
      <Link href={guideHref(project.slug, revLabel, "REQUIREMENTS")} className={SECONDARY}>
        Preview the guide first
      </Link>
    ) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href="/learn"
          className="group inline-flex items-center gap-1.5 text-muted hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          My learning
        </Link>
      </nav>

      {/* ── HERO ── two desktop columns; on mobile the columns flatten (via
          display:contents) into: comb → title → board → lead → the rest. */}
      <section>
        <div className="grid grid-cols-1 gap-y-4 lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-0">
          {/* LEFT column (desktop) */}
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            {/* title block — mobile #2 */}
            <div className="order-2 flex flex-col gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold">
                Board{project.level ? ` · ${project.level}` : ""}
                {project.track ? ` · ${project.track}` : ""}
              </p>
              <h1 className="title-hero max-lg:text-[2rem] max-lg:leading-[0.95]">{project.name}</h1>
            </div>
            {/* lead — mobile #4 */}
            {project.description ? (
              <p className="order-4 font-serif text-base leading-relaxed text-muted">{project.description}</p>
            ) : null}
            {/* the rest — mobile #5 */}
            <div className="order-5 flex flex-col gap-5">
              {/* Level gauge (real data). The "all parts provided" reassurance sits
                  in the gauge row's empty right space (above the CTA), not below it. */}
              <div className="flex items-center gap-5">
                <div className="shrink-0 text-center">
                  <p className={`${L} text-[9px]`}>Level</p>
                  <p className={`${N} text-6xl max-lg:text-5xl`}>{levelNum}</p>
                  {project.track ? <p className={`${L} text-[9px]`}>{project.track.toLowerCase()}</p> : null}
                </div>
                <div className="h-14 w-px bg-panel-border/60" />
                <p className="shrink-0 whitespace-nowrap font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted">
                  {GUIDE_STAGES.length} stages
                  <br />
                  {partsCount} parts
                </p>
                <p className="ml-auto max-w-[15rem] text-right font-mono text-[11px] uppercase leading-relaxed tracking-wider text-status-green">
                  ✓ All parts, symbols &amp; footprints provided · download-ready
                </p>
              </div>
              {primaryCta}
              {secondary}
            </div>
          </div>

          {/* RIGHT column (desktop) */}
          <div className="contents lg:flex lg:flex-col lg:gap-3">
            {/* comb — mobile #1. Progress readout is desktop-only + only when enrolled. */}
            {revLabel ? (
              <div className="order-1 flex flex-col gap-3">
                {isEnrolled ? (
                  <p className="hidden text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted lg:block">
                    <span className="font-numeral text-2xl tabular-nums text-command-gold">{doneCount}</span> /{" "}
                    <span className="font-numeral text-2xl tabular-nums text-muted">{GUIDE_STAGES.length}</span> stages ·{" "}
                    {STAGE_LABELS[enrollment!.currentStage as StageName]}
                  </p>
                ) : null}
                <PhaseComb
                  slug={project.slug}
                  revLabel={revLabel}
                  stages={guideProgress}
                  viewingStage={viewingStage}
                  variant="footer"
                />
              </div>
            ) : null}
            {/* board — mobile #3 */}
            {boardModel ? (
              <div className="order-3">
                <ClickToLoadBoard poster={`/board-posters/${project.slug}.png`} src={boardModel.src} bounds={boardModel.bounds} />
              </div>
            ) : isAdmin ? (
              <div className="order-3 flex flex-col items-center justify-center gap-2 rounded border border-dashed border-panel-border bg-deep-space/40 px-6 py-8 text-center">
                <span className="font-mono text-xs uppercase tracking-wider text-muted">3D model · to be added</span>
                <span className="max-w-md font-serif text-sm text-muted">
                  Upload a MODEL_3D artifact on the published revision to show the finished board here. Admins only ·
                  hidden from learners until it exists.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── STATE EXTRAS below the hero ── only genuinely-extra content (the comb +
          hero CTA already convey progress + status, so no duplicate progress list). */}
      {hasExtras ? (
        <section className="mt-10 border-t border-panel-border/60 pt-6">
          {notOpen ? (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">This board isn’t open for enrollment yet.</p>
          ) : locked && !isEnrolled ? (
            <div className="space-y-3">
              <p className="font-mono text-sm uppercase tracking-wider text-alert-red">Locked · finish these boards first:</p>
              <ul className="space-y-1">
                {entry?.missingPrereqs.map((p) => (
                  <li key={p.id} className="group font-mono text-sm">
                    <Link
                      href={`/learn/${p.slug}`}
                      className="text-title group-hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : isDone && project.exam ? (
            <Link
              href={`/learn/${project.slug}/exam`}
              className="glass-button inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider"
            >
              {enrollment!.status === "MASTERED" ? "Review exam" : "Take the final exam"}
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
