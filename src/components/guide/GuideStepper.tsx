// GuideStepper — the "order of operations" rail for the build guide.
//
// Renders the 8 pipeline stages (REQUIREMENTS → BRINGUP) as a numbered,
// connected stepper so a student always sees the sequence, where they are, and
// what's done / ahead. Each node links to its card; the node being viewed gets a
// gold ring ("you are here"). Per-node colour comes from the live completion
// state (resolveGuideProgress) — green done / gold in-progress / red blocked /
// muted not-started — and the connector between two nodes lights green once the
// earlier stage is complete, drawing the path the student has already walked.
//
// Server component (links + status only, no interactivity), mirroring
// StageTracker. Responsive: labels hide below `sm`, where the caption
// ("Step 02 / 08 — SCHEMATIC") carries the position.

import Link from "next/link";
import type { GuideStageStatus } from "@/lib/guide-progress";
import {
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import { STAGE_LABELS } from "@/lib/stages";

const SHORT: Record<GuideStage, string> = {
  REQUIREMENTS: "REQ",
  SCHEMATIC: "SCH",
  BOM_SOURCING: "BOM",
  LAYOUT: "LAY",
  DRC_GERBER: "DRC",
  ORDERING: "ORD",
  ASSEMBLY: "ASM",
  BRINGUP: "BRG",
};

function circleClasses(state: GuideStageStatus["state"]): string {
  switch (state) {
    case "complete":
      return "border-status-green text-status-green";
    case "partial":
      return "border-command-gold text-command-gold";
    case "blocked":
      return "border-alert-red text-alert-red";
    case "untouched":
    default:
      return "border-panel-border text-muted";
  }
}

function labelClasses(
  state: GuideStageStatus["state"],
  isViewing: boolean,
): string {
  if (isViewing) return "text-command-gold font-bold";
  switch (state) {
    case "complete":
      return "text-status-green";
    case "partial":
      return "text-command-gold";
    case "blocked":
      return "text-alert-red";
    default:
      return "text-muted";
  }
}

export function GuideStepper({
  slug,
  revLabel,
  stages,
  viewingStage,
}: {
  slug: string;
  revLabel: string;
  stages: GuideStageStatus[];
  /** The card currently being viewed → "you are here" ring. Omit on the hub. */
  viewingStage?: GuideStage;
}) {
  const href = (s: GuideStage) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;
  const viewing = viewingStage
    ? stages.find((s) => s.stage === viewingStage)
    : undefined;

  return (
    <nav
      aria-label="Build guide progress"
      className="glass-card px-5 py-4 sm:px-6"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Build guide
        {viewing ? (
          <span className="font-bold text-command-gold">
            {" · "}Step {String(viewing.ordinal + 1).padStart(2, "0")} / 08 —{" "}
            {STAGE_LABELS[viewing.stage]}
          </span>
        ) : (
          <span className="text-gold-dim">{" · "}order of operations</span>
        )}
      </p>

      <ol className="flex items-start">
        {stages.map((s, i) => {
          const isViewing = s.stage === viewingStage;
          const prevComplete = i > 0 && stages[i - 1]!.state === "complete";
          const num = String(s.ordinal + 1).padStart(2, "0");
          return (
            <li
              key={s.stage}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* connector to the previous node — inset by the circle radius so
                  it spans only the gap, never over a circle. */}
              {i > 0 ? (
                <span
                  aria-hidden
                  className={`absolute top-4 h-0.5 ${prevComplete ? "bg-status-green" : "bg-panel-border"}`}
                  style={{ left: "calc(-50% + 16px)", width: "calc(100% - 32px)" }}
                />
              ) : null}

              <Link
                href={href(s.stage)}
                aria-current={isViewing ? "step" : undefined}
                aria-label={`${STAGE_LABELS[s.stage]} — ${s.state}${isViewing ? " (current)" : ""}`}
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-deep-space font-mono text-xs font-bold transition-colors hover:bg-command-gold/10 ${circleClasses(
                  s.state,
                )} ${isViewing ? "ring-4 ring-command-gold/25" : ""}`}
              >
                {s.state === "complete" ? "✓" : num}
              </Link>

              <span
                className={`mt-1.5 hidden font-mono text-[10px] uppercase tracking-wider sm:block ${labelClasses(
                  s.state,
                  isViewing,
                )}`}
              >
                {SHORT[s.stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
