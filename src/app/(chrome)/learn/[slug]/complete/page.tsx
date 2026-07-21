import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentUserOrRedirect } from "@/lib/learner";
import { getExam } from "@/lib/actions/exam";
import { BrandMark } from "@/components/BrandMark";
import { signCardToken } from "@/lib/certificate-token";
import { recordCertificate } from "@/lib/certificate-record";
import { SupportBlock } from "@/components/learn/SupportBlock";
import { ShareCard } from "@/components/learn/ShareCard";
import { TipBlock } from "@/components/learn/TipBlock";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
import { pickNextLessons } from "@/lib/learner-next-lessons";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { assessLessonReadiness } from "@/lib/lesson-readiness";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";
import { goldenReferenceFromRows } from "@/lib/golden-reference-load";
import { type GoldenReference } from "@/lib/golden-reference";
import { GoldenReferencePanel } from "@/components/GoldenReferencePanel";

export default async function LessonCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tipped?: string }>;
}) {
  const { slug } = await params;
  const tipped = (await searchParams).tipped === "1";
  const user = await currentUserOrRedirect();

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, publishedRevisionId: true },
  });
  if (!project) notFound();

  const isAdmin = user.role === "ADMIN";
  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: {
      status: true,
      masteredAt: true,
      // Latest passing attempt → the score on the shareable certificate.
      examResults: {
        where: { passed: true },
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { score: true, total: true },
      },
    },
  });
  // Only a finished learner sees this screen; anyone else goes back to the board.
  // Admins bypass the gate so they can always reach it to manage the golden-set
  // deliverables (they need not have completed the lesson themselves).
  if (!isAdmin && (!enrollment || enrollment.status === "IN_PROGRESS")) {
    redirect(`/learn/${slug}`);
  }
  const mastered = enrollment?.status === "MASTERED";

  const exam = await getExam(project.id); // null when the lesson has no exam

  // Next lesson(s): DAG dependents of this lesson that are published.
  const deps = await db.projectDependency.findMany({
    where: { dependsOnProjectId: project.id },
    select: { dependentProjectId: true },
  });
  const nextProjects = deps.length
    ? await db.project.findMany({
        where: {
          id: { in: deps.map((d) => d.dependentProjectId) },
          publishedRevisionId: { not: null },
        },
        select: { slug: true, name: true, criticalPath: true },
      })
    : [];
  const next = pickNextLessons(
    nextProjects.map((p) => ({ slug: p.slug, name: p.name, criticalPath: !!p.criticalPath })),
  );

  // Golden-set deliverables on the published revision (file-backed). One query
  // drives both the learner "Proven board kit" downloads and the admin panel.
  const goldenSubkinds = ["BOM_EXPORT", "GERBER_ZIP", "BRINGUP_MEASUREMENTS_CSV"] as const;
  const goldenArtifacts = project.publishedRevisionId
    ? await db.artifact.findMany({
        where: {
          revisionId: project.publishedRevisionId,
          subkind: { in: [...goldenSubkinds] },
          fileKey: { not: null },
        },
        select: { subkind: true },
      })
    : [];
  const presentSubkinds = new Set(goldenArtifacts.map((a) => a.subkind));
  const hasKicadStarter = presentSubkinds.has("BOM_EXPORT");
  const hasGerbers = presentSubkinds.has("GERBER_ZIP");
  const hasMeasurements = presentSubkinds.has("BRINGUP_MEASUREMENTS_CSV");

  // Operator golden verdict (admin-only): vetted needs the published rev's guide
  // cards + exam + brought-up board count. Mirrors the guide-hub readiness load.
  let golden: GoldenReference | null = null;
  if (isAdmin) {
    let vetted = false;
    if (project.publishedRevisionId) {
      const [blockRows, broughtUpBoards] = await Promise.all([
        db.guideCard.findMany({
          where: { guide: { revisionId: project.publishedRevisionId } },
          orderBy: { ordinal: "asc" },
          select: { stage: true, contentBlocks: true },
        }),
        db.board.count({
          where: {
            status: "BROUGHT_UP",
            build: { revision: { projectId: project.id } },
          },
        }),
      ]);
      const parsedCards = blockRows.map((c) => ({
        stage: c.stage as string,
        blocks: guideContentBlocksSchema.safeParse(c.contentBlocks).data ?? [],
      }));
      const examQuestions = Array.isArray(exam?.questions)
        ? (exam.questions as unknown[]).length
        : 0;
      vetted = assessLessonReadiness({
        stages: GUIDE_STAGES,
        cards: parsedCards,
        exam: exam ? { questions: examQuestions } : null,
        broughtUpBoards,
        published: project.publishedRevisionId != null,
      }).vetted;
    }
    golden = goldenReferenceFromRows({
      publishedRevisionId: project.publishedRevisionId,
      vetted,
      publishedArtifactSubkinds: [...presentSubkinds],
    });
  }

  // Shareable card token (server-signed). Only a real finisher gets one — an admin
  // previewing without an enrollment does not.
  const userName = user.name?.trim() || user.email?.split("@")[0] || "Builder";
  const latestPass = enrollment?.examResults[0];
  let shareToken: string | null = null;
  if (enrollment && enrollment.status !== "IN_PROGRESS") {
    const claims = {
      slug: project.slug,
      name: userName,
      variant: (mastered ? "cert" : "done") as "cert" | "done",
      score: mastered ? latestPass?.score : undefined,
      total: mastered ? latestPass?.total : undefined,
      date: (enrollment.masteredAt ?? new Date()).toISOString().slice(0, 10),
    };
    shareToken = signCardToken(claims);
    await recordCertificate(shareToken, claims, user.id); // make the code checkable
  }

  return (
    <main className="relative mx-auto flex min-h-[80svh] max-w-3xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6">
      {/* Thank-you banner after a successful tip checkout (?tipped=1). */}
      {tipped && (
        <p className="signin-rise w-full max-w-2xl border-l-2 border-status-green/60 pl-4 py-2 text-left font-mono text-xs uppercase tracking-[0.18em] text-status-green">
          ▸ Thanks for supporting the Academy 💛
        </p>
      )}
      {/* Hero — the viz "mission complete" reveal */}
      <BrandMark className="signin-rise animate-pulse-brand h-14 w-14 text-command-gold" />
      <div className="signin-rise flex flex-col items-center" style={{ animationDelay: "90ms" }}>
        <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          {mastered ? "// Mastered" : "// Lesson complete"}
        </span>
        <h1 className="mt-3 title-hero">
          {project.name}
        </h1>
        <p className="mt-4 font-serif text-base italic text-muted">
          You built a real board, start to finish.
        </p>
      </div>
      <div
        aria-hidden
        className="signin-rise h-px w-[140px] overflow-hidden bg-bg-3"
        style={{ animationDelay: "150ms" }}
      >
        <div className="signin-bar-fill h-full bg-command-gold" />
      </div>

      {/* The certificate itself, shown on the page, with download + share */}
      {shareToken && (
        <div
          className="signin-rise flex w-full max-w-2xl flex-col items-center gap-4"
          style={{ animationDelay: "190ms" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
            // {mastered ? "Your certificate" : "Your completion"}
          </span>
          {/* Live on-page Saira readout of the exam score (also baked into the cert PNG). */}
          {mastered && latestPass && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
                ▸ exam score
              </span>
              <p className="font-numeral text-5xl tabular-nums text-command-gold">
                {latestPass.score} / {latestPass.total}
              </p>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic certificate PNG, not a static asset */}
          <img
            src={`/learn/${project.slug}/certificate/${shareToken}/image`}
            alt={
              mastered
                ? `Verified Certificate of Achievement — ${userName}`
                : `Lesson Complete — ${userName}`
            }
            width={1200}
            height={848}
            className="w-full rounded border border-panel-border [box-shadow:var(--elev-card)]"
          />
          <ShareCard
            downloadUrl={`/learn/${project.slug}/certificate/${shareToken}/pdf`}
            shareUrl={`/learn/${project.slug}/certificate/${shareToken}`}
            title={mastered ? "Verified Certificate of Achievement" : "Lesson Complete"}
          />
        </div>
      )}

      {/* Exam entry / certificate */}
      {exam ? (
        <section
          className="signin-rise w-full max-w-2xl"
          style={{ animationDelay: "210ms" }}
        >
          {mastered ? (
            <div className="border-t border-panel-border/60 pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-status-green">
                ▸ Verified Certificate of Achievement, earned
              </p>
              <Link
                href={`/learn/${slug}/exam`}
                className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.2em] text-text underline hover:text-command-gold"
              >
                Review exam
              </Link>
            </div>
          ) : (
            <div className="border-t border-panel-border/60 pt-8 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
                ▸ Optional final
              </span>
              <p className="mt-3 title-section">
                Earn your Verified Certificate
                <br className="hidden sm:block" /> of Achievement
              </p>
              <p className="mx-auto mt-3 max-w-md font-serif text-sm italic text-text">
                Take the final exam to prove you&rsquo;ve got the whole build
                down: every stage, start to finish. Pass and the certificate is
                yours.
              </p>
              <Link
                href={`/learn/${slug}/exam`}
                className="glass-button glass-button-cta mt-5 inline-block px-8 py-3.5 font-mono text-sm uppercase tracking-[0.18em]"
              >
                Take the final exam →
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* Affiliate support */}
      <div className="signin-rise" style={{ animationDelay: "270ms" }}>
        <SupportBlock />
      </div>

      {/* One-time tip */}
      <div className="signin-rise" style={{ animationDelay: "285ms" }}>
        <TipBlock slug={project.slug} />
      </div>

      {/* ─── Proven board kit — the golden-set bundle ─── */}
      <div
        className="signin-rise flex w-full max-w-2xl flex-col items-center gap-3"
        style={{ animationDelay: "300ms" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
          // Proven board kit
        </span>
        <p className="font-serif text-sm italic text-muted">
          The exact files behind the board we built and brought up. Download them
          to order or check your own.
        </p>

        {/* KiCad starter */}
        {hasKicadStarter ? (
          <GuideActionButton
            action="downloadKicadStarter"
            label="Download KiCad starter"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            KiCad starter: coming soon.
          </p>
        )}

        {/* Verified reference gerbers */}
        {hasGerbers ? (
          <GuideActionButton
            action="downloadReferenceFiles"
            label="Download verified reference gerbers"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Verified reference gerbers: coming soon.
          </p>
        )}

        {/* Bring-up measurements CSV */}
        {hasMeasurements ? (
          <GuideActionButton
            action="downloadBringupMeasurements"
            label="Download bring-up measurements"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Bring-up measurements: coming soon.
          </p>
        )}
      </div>

      {/* Admin golden-reference panel — status + kit worklist + uploaders */}
      {isAdmin && golden && (
        <div className="signin-rise w-full max-w-2xl" style={{ animationDelay: "305ms" }}>
          <GoldenReferencePanel
            golden={golden}
            projectId={project.id}
            published={!!project.publishedRevisionId}
          />
        </div>
      )}

      {/* Next lesson(s) */}
      <section
        className="signin-rise flex w-full max-w-2xl flex-col items-center gap-3"
        style={{ animationDelay: "330ms" }}
      >
        {next.length > 0 ? (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
              // Up next
            </span>
            {next.map((n) => (
              <Link
                key={n.slug}
                href={`/learn/${n.slug}`}
                className="glass-button w-full max-w-md px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
              >
                {n.name} →
              </Link>
            ))}
          </>
        ) : null}
        <Link
          href="/learn"
          className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-gray-3 transition-colors hover:text-command-gold"
        >
          ← All lessons
        </Link>
      </section>
    </main>
  );
}
