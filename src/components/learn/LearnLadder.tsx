"use client";

// The enrolled-boards ladder on /learn — a rank-ladder selector. The
// latest-activity board (index 0; enrollments arrive ordered startedAt desc) is
// selected + expanded, its finished-board poster enlarged and breaking the frame
// with the theme-adaptive `--board-halo`. The rest are compact rows that select
// on click, each with a small poster wing. Desktop = the owner-approved "T2"
// arrangement (board breaks bottom-right, text clears left); the `max-lg:`
// treatment is the mobile arrangement (board top-right, sized-down CTA).
//
// A board with no baked poster (boardPoster() === null) degrades to a text row:
// no wing, and the selected row drops the right-clearance padding.
import { useState } from "react";
import Link from "next/link";

export type LadderBoard = {
  slug: string;
  name: string;
  /** Where the CTA resumes to — the guide at the learner's current stage
   *  (in-progress) or the completion page (done), NOT the board-detail page. */
  href: string;
  statusLabel: string;
  statusColor: string;
  done: boolean;
  stageIndex: number;
  totalStages: number;
  phase: string;
  checks: number;
  poster: string | null;
  exam: { score: number; total: number; passed: boolean } | null;
};

/* eslint-disable @next/next/no-img-element -- the poster is a static decorative
   asset; next/image adds no value and fights the frame-breaking absolute layout. */
export function LearnLadder({ boards }: { boards: LadderBoard[] }) {
  const [sel, setSel] = useState(0);

  return (
    <ul className="mt-4 border-t border-panel-border/60">
      {boards.map((b, i) => {
        const selected = i === sel;
        return (
          <li
            key={b.slug}
            className={`relative overflow-visible border-b border-panel-border/60 transition-[padding] duration-300 ${
              selected
                ? "pb-4 pt-4 max-lg:pb-3 max-lg:pt-3"
                : "cursor-pointer py-4 hover:bg-command-gold/[0.04] focus-within:bg-command-gold/[0.06]"
            }`}
          >
            {/* poster "wing" — big + breaking frame + halo when selected; small
                contained thumbnail otherwise. On mobile the selected board sits
                top-right, smaller, so it never covers the CTA. */}
            {b.poster ? (
              <img
                src={b.poster}
                alt=""
                aria-hidden
                className={`pointer-events-none absolute right-0 select-none transition-all duration-300 ease-[cubic-bezier(.2,.85,.25,1)] ${
                  selected
                    ? "-bottom-24 w-[22rem] opacity-100 [filter:drop-shadow(0_12px_26px_var(--board-halo))] max-lg:-top-4 max-lg:bottom-auto max-lg:w-40"
                    : "top-1/2 w-24 -translate-y-1/2 opacity-60 max-lg:w-16"
                }`}
              />
            ) : null}

            {selected ? (
              <div
                className={`relative z-10 flex flex-col gap-2 ${
                  b.poster ? "pr-[23rem] max-lg:pr-32" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="title-section max-lg:text-[1.4rem] max-lg:leading-[1.05]">{b.name}</span>
                  <span className={`font-mono text-xs uppercase tracking-[0.16em] ${b.statusColor}`}>{b.statusLabel}</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs uppercase tracking-wider text-muted max-lg:text-[11px]">
                  <span>
                    Stage <span className="font-numeral tabular-nums text-text">{b.stageIndex}</span> /{" "}
                    <span className="font-numeral tabular-nums">{b.totalStages}</span> · {b.phase}
                  </span>
                  <span>
                    <span className="font-numeral tabular-nums text-text">{b.checks}</span> checks passed
                  </span>
                  {b.exam ? (
                    <span className={b.exam.passed ? "text-status-green" : "text-alert-red"}>
                      Exam <span className="font-numeral tabular-nums">{b.exam.score}/{b.exam.total}</span>
                    </span>
                  ) : null}
                </div>
                <Link
                  href={b.href}
                  className="glass-button glass-button-cta mt-1 w-fit px-6 py-3 font-mono text-sm uppercase tracking-[0.16em] max-lg:mt-1.5 max-lg:px-4 max-lg:py-2 max-lg:text-[11px] max-lg:tracking-[0.12em]"
                >
                  {b.done ? "View completion →" : "Resume the build →"}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSel(i)}
                className="relative z-10 flex w-full flex-col gap-1 pr-28 text-left focus-visible:outline-none max-lg:pr-20"
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="title-card max-lg:text-lg">{b.name}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${b.statusColor}`}>{b.statusLabel}</span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted max-lg:text-[10px]">
                  Stage <span className="font-numeral tabular-nums text-text">{b.stageIndex}</span> /{" "}
                  <span className="font-numeral tabular-nums">{b.totalStages}</span> · {b.phase}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
