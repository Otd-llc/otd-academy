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
import { ReferenceGerberAdmin } from "@/components/learn/ReferenceGerberAdmin";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
import { pickNextLessons } from "@/lib/learner-next-lessons";

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
  // Admins bypass the gate so they can always reach it to manage the reference
  // gerbers (they need not have completed the lesson themselves).
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

  // Verified reference gerbers: the proven Gerber set on the published revision a
  // learner can download to order the exact board. Placeholder until an admin
  // attaches it (admins get an inline upload below — freeze-exempt).
  const refGerbers = project.publishedRevisionId
    ? await db.artifact.findFirst({
        where: {
          revisionId: project.publishedRevisionId,
          subkind: "GERBER_ZIP",
          fileKey: { not: null },
        },
        select: { id: true },
      })
    : null;
  const hasGerbers = !!refGerbers;

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
        <p className="signin-rise w-full max-w-2xl rounded border border-command-gold/40 bg-navy-dark px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-command-gold">
          Thanks for supporting the Academy 💛
        </p>
      )}
      {/* Hero — the viz "mission complete" reveal */}
      <BrandMark className="signin-rise animate-pulse-brand h-14 w-14 text-command-gold" />
      <div className="signin-rise flex flex-col items-center" style={{ animationDelay: "90ms" }}>
        <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          {mastered ? "// Mastered" : "// Lesson complete"}
        </span>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-[0.12em] text-gray-1 sm:text-5xl">
          {project.name}
        </h1>
        <p className="mt-4 font-serif text-base italic text-gold-dim">
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

      {/* Share the completion / certificate card */}
      {shareToken && (
        <div
          className="signin-rise flex flex-col items-center gap-2"
          style={{ animationDelay: "190ms" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
            // {mastered ? "Share your certificate" : "Share your build"}
          </span>
          <ShareCard
            downloadUrl={`/learn/${project.slug}/certificate/${shareToken}/pdf`}
            shareUrl={`/learn/${project.slug}/certificate/${shareToken}`}
            title={mastered ? "Verified Certificate of Achievement" : "Lesson Complete"}
            compact
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
            <div className="glass-card border-command-gold/40 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                ★ Verified Certificate of Achievement — earned
              </p>
              <Link
                href={`/learn/${slug}/exam`}
                className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.2em] text-gray-2 underline hover:text-command-gold"
              >
                Review exam
              </Link>
            </div>
          ) : (
            <div className="glass-card border-command-gold/40 p-8 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
                ★ Optional final
              </span>
              <p className="mt-3 font-display text-2xl leading-tight tracking-wider text-gray-1 sm:text-3xl">
                Earn your Verified Certificate
                <br className="hidden sm:block" /> of Achievement
              </p>
              <p className="mx-auto mt-3 max-w-md font-serif text-sm italic text-gray-2">
                Take the final exam to prove you&rsquo;ve got the whole build
                down — every stage, start to finish. Pass and the certificate is
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

      {/* Verified reference gerbers — download the proven board files (or a
          placeholder until an admin attaches them). Admins get an inline upload. */}
      <div
        className="signin-rise flex w-full max-w-2xl flex-col items-center gap-3"
        style={{ animationDelay: "300ms" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
          // Order the proven board
        </span>
        {hasGerbers ? (
          <GuideActionButton
            action="downloadReferenceFiles"
            label="Download verified reference gerbers"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Verified reference gerbers — coming soon.
          </p>
        )}
        {isAdmin && (
          <ReferenceGerberAdmin
            projectId={project.id}
            hasGerbers={hasGerbers}
            published={!!project.publishedRevisionId}
          />
        )}
      </div>

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
