// Per-path header for /courses (server component — no "use client").
//
// Names the SELECTED learning path: a small mono eyebrow, the path title, its
// blurb, a lean one-line meta (course count · destination · capstone level), and
// — signed in — a gold segmented progress gauge (one tick per course). Pure
// typography on the deep-space field: NO panel, NO border, NO table/cell grid,
// and a single gold/ivory palette (no track colours) so it sits quiet beneath
// the page header and lets the honeycomb below carry the page.

import Link from "next/link";
import type { PathKind } from "@/lib/skill-paths";

const KIND_TAG: Record<PathKind, string> = {
  primary: "Flagship path",
  mastery: "Mastery path",
  bench: "Bench tools",
};

export interface PathBannerProps {
  kind: PathKind;
  label: string;
  blurb: string;
  total: number;
  done: number;
  percent: number;
  signedIn: boolean;
  /** The build this path leads to (its capstone). Absent for the bench category. */
  goal?: { title: string; track: string | null; level: string | null } | null;
  /** Path-local next step slug → the no-JS "jump to your next step" anchor. */
  nextSlug?: string | null;
  /** Whether the path includes a premium build → show the All-Access pointer. */
  hasPremium: boolean;
}

export function PathBanner({
  kind,
  label,
  blurb,
  total,
  done,
  percent,
  signedIn,
  goal,
  nextSlug,
  hasPremium,
}: PathBannerProps) {
  const showProgress = signedIn && done > 0;
  const unit = kind === "bench" ? "tools" : "courses";

  return (
    <header className="mb-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-command-gold">
        {KIND_TAG[kind]}
      </p>

      <h2 className="title-section mt-2">{label}</h2>

      <p className="mt-1.5 max-w-2xl font-serif text-sm italic text-muted">
        {blurb}
      </p>

      {/* Lean meta line — a sentence, not a table. */}
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-command-gold">
          {total} {unit}
        </span>
        {goal ? (
          <>
            <span className="px-2 text-gold-dim">/</span>
            leads to <span className="text-gray-1">{goal.title}</span>
            {goal.level ? (
              <>
                <span className="px-2 text-gold-dim">/</span>
                <span className="text-command-gold">{goal.level}</span> capstone
              </>
            ) : null}
          </>
        ) : null}
      </p>

      {/* Segmented progress gauge — one gold tick per course (signed-in, ≥1 done). */}
      {showProgress ? (
        <div className="mt-5 max-w-sm">
          <div
            className="flex gap-1"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: ${label}`}
          >
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full ${
                  i < done ? "bg-command-gold" : "bg-panel-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
            {done} of {total} · ~{percent}% there
          </p>
        </div>
      ) : null}

      {/* Actions — quiet inline links, gold on the field. */}
      {(signedIn && nextSlug) || hasPremium ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em]">
          {signedIn && nextSlug ? (
            <a
              href={`#node-${nextSlug}`}
              className="inline-flex items-center gap-1.5 font-bold text-command-gold"
            >
              Jump to your next step
              <span aria-hidden="true">→</span>
            </a>
          ) : null}
          {hasPremium ? (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-command-gold/80 underline-offset-4 hover:text-command-gold hover:underline"
            >
              All-Access Pass
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
