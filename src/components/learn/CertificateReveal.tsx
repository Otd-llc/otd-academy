"use client";

// The "you earned it" moment shown when a learner PASSES the final exam — a
// branded reveal of the Verified Certificate of Achievement (the same viz
// rise/pulse motion as sign-in + the complete screen), plus continuation CTAs so
// passing pushes you onward instead of dead-ending. (The shareable/downloadable
// version is a follow-on — #5.)
import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ShareCard } from "@/components/learn/ShareCard";
import { createCertificateShareToken } from "@/lib/actions/certificate";

export type NextLessonLink = { slug: string; name: string };

export function CertificateReveal({
  userName,
  projectName,
  score,
  total,
  slug,
  nextLessons,
}: {
  userName: string;
  projectName: string;
  score: number;
  total: number;
  slug: string;
  nextLessons: NextLessonLink[];
}) {
  // Mint a share token once the reveal mounts (i.e. once MASTERED), so the learner
  // can share/download the public card. Best-effort: if it fails, the reveal still
  // stands — just without the share controls.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    createCertificateShareToken({ slug, variant: "cert", score, total })
      .then((r) => live && setToken(r.token))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug, score, total]);

  return (
    <section className="signin-rise flex flex-col items-center gap-6 rounded border border-command-gold/40 bg-deep-space px-6 py-12 text-center">
      <BrandMark className="signin-rise animate-pulse-brand h-16 w-16 text-command-gold" />
      <div
        className="signin-rise flex flex-col items-center"
        style={{ animationDelay: "90ms" }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          ★ Passed · {score}/{total}
        </span>
        <h2 className="mt-3 font-display text-3xl leading-none tracking-[0.12em] text-gray-1 sm:text-4xl">
          Verified Certificate
          <br />
          of Achievement
        </h2>
        <p className="mt-4 font-serif text-base italic text-gold-dim">
          Awarded to {userName}
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-gray-2">
          {projectName}
        </p>
      </div>
      <div
        aria-hidden
        className="signin-rise h-px w-[160px] overflow-hidden bg-bg-3"
        style={{ animationDelay: "150ms" }}
      >
        <div className="signin-bar-fill h-full bg-command-gold" />
      </div>
      {token && (
        <div className="signin-rise" style={{ animationDelay: "180ms" }}>
          <ShareCard
            downloadUrl={`/learn/${slug}/certificate/${token}/pdf`}
            shareUrl={`/learn/${slug}/certificate/${token}`}
            title="Verified Certificate of Achievement"
          />
        </div>
      )}
      <div
        className="signin-rise flex w-full max-w-md flex-col items-center gap-3"
        style={{ animationDelay: "210ms" }}
      >
        {nextLessons.length > 0 && (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
              // Keep building
            </span>
            {nextLessons.map((n) => (
              <Link
                key={n.slug}
                href={`/learn/${n.slug}`}
                className="glass-button glass-button-cta w-full px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
              >
                {n.name} →
              </Link>
            ))}
          </>
        )}
        <Link
          href={`/learn/${slug}/complete`}
          className="glass-button w-full px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
        >
          Back to completion
        </Link>
        <Link
          href="/learn"
          className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-gray-3 transition-colors hover:text-command-gold"
        >
          ← All lessons
        </Link>
      </div>
    </section>
  );
}
