// Onboarding checklist framing of a learner's board progress: the full stage
// sequence as a ticked list + a Saira percent readout (research: a visible
// checklist + progress lifts satisfaction/completion). Server component — uses
// the pure resolveLearnerGuideProgress; each row links to that stage's card so
// the checklist doubles as navigation. Content surface: hairline rows on the
// deep-space field, no filled card.
import Link from "next/link";
import { resolveLearnerGuideProgress } from "@/lib/guide-progress";
import { STAGE_LABELS, type StageName } from "@/lib/stages";

export function FirstBoardChecklist({
  slug,
  revLabel,
  currentStage,
}: {
  slug: string;
  revLabel: string;
  currentStage: string | null;
}) {
  const stages = resolveLearnerGuideProgress(currentStage);
  const done = stages.filter((s) => s.state === "complete").length;
  const pct = Math.round((done / stages.length) * 100);

  return (
    <section className="mt-8 border-t border-panel-border/60 pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Your progress
        </p>
        <p className="font-numeral text-2xl tabular-nums text-command-gold">
          {pct}%
        </p>
      </div>

      <ul className="mt-4 border-t border-panel-border/60">
        {stages.map((s) => {
          const label = STAGE_LABELS[s.stage as StageName] ?? s.stage;
          const mark =
            s.state === "complete" ? "✓" : s.state === "partial" ? "●" : "○";
          const markClass =
            s.state === "complete"
              ? "text-status-green"
              : s.state === "partial"
                ? "text-command-gold"
                : "text-muted";
          const href = `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s.stage}`;
          return (
            <li key={s.stage}>
              <Link
                href={href}
                className="group flex items-center gap-3 border-b border-panel-border/60 py-3 transition-colors hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
              >
                <span aria-hidden className={`font-mono text-sm ${markClass}`}>
                  {mark}
                </span>
                <span
                  className={`font-mono text-xs uppercase tracking-wider ${s.state === "untouched" ? "text-muted" : "text-text"} group-hover:text-gold-light`}
                >
                  {label}
                </span>
                {s.state === "partial" && (
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                    Current
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
