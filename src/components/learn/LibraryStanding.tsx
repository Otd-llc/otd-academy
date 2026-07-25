// The subordinate "Library" standing on /learn — the owner-picked "L1 ·
// continue-first strip": one hairline band with the resume lesson (the action
// that drives re-engagement) on the left, the logbook rank chip + lessons-read
// count on the right, and one flat gold progress bar. Fed by
// getLearnLibraryStanding(). A content surface: hairline-grouped, no filled card.
import Link from "next/link";
import type { LearnLibraryStanding } from "@/lib/logbook/load";
import type { ResumeMode } from "@/lib/logbook/load";

const RESUME_VERB: Record<ResumeMode, string> = {
  start: "Start reading",
  continue: "Continue",
  next: "Next up",
  restart: "Read again",
};

export function LibraryStanding({ standing }: { standing: LearnLibraryStanding }) {
  const { doneCount, totalCount, rank, resume } = standing;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-panel-border/60 pt-4 max-lg:flex-col max-lg:items-start max-lg:gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">▸ Library</span>
          {resume ? (
            <Link
              href={`/library/${resume.slug}`}
              className="group inline-flex items-baseline gap-2 font-mono text-sm uppercase tracking-[0.14em] text-command-gold hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
            >
              {RESUME_VERB[resume.mode]} →{" "}
              <span className="text-text group-hover:text-gold-light">{resume.title}</span>
            </Link>
          ) : (
            <Link
              href="/library"
              className="font-mono text-sm uppercase tracking-[0.14em] text-command-gold hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
            >
              Browse the library →
            </Link>
          )}
          {resume?.clusterLabel ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{resume.clusterLabel}</span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 max-lg:items-start">
          <span className="inline-flex items-baseline gap-2 font-mono uppercase tracking-[0.16em] text-muted">
            <span className="text-[11px] text-command-gold">FL{rank.level}</span>
            <span className="text-[10px]">{rank.title}</span>
            <span className="font-numeral text-base tabular-nums text-command-gold">{rank.xpTotal}</span>
            <span className="text-[9px]">XP</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            <span className="font-numeral tabular-nums text-text">{doneCount}</span> /{" "}
            <span className="font-numeral tabular-nums">{totalCount}</span> lessons read
          </span>
        </div>
      </div>
      {/* flat gold fill over a hairline track — not a gradient */}
      <span className="mt-3 block h-[3px] w-full bg-panel-border/40">
        <span className="block h-full bg-command-gold" style={{ width: `${pct}%` }} />
      </span>
    </section>
  );
}
