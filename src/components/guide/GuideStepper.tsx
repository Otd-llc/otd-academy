// GuideStepper — the build-guide "order of operations" rail, styled as a
// HONEYCOMB CIRCUIT: each of the 8 pipeline stages (REQUIREMENTS → BRINGUP) is a
// hexagon cell (One Thousand Drones' bee/hive motif) wired to its neighbours by
// copper traces with via-pads (the hardware-design theme). Progress "fills the
// comb": completed cells glow honey-gold with a ✓, the cell you're viewing
// pulses like a board powering up, and cells ahead stay dim. The trace behind a
// completed cell lights up (routed); the trace ahead stays unrouted.
//
// Per-node state comes from the live completion data (resolveGuideProgress) —
// done / in-progress / blocked / not-started. Server component (links + status
// only). Responsive: labels hide below `sm`, where the caption carries position.

import Link from "next/link";
import type { GuideStageStatus } from "@/lib/guide-progress";
import { type GuideStage } from "@/lib/guide-templates/stage-skeletons";
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

// Flat-top hexagon (points on the left/right so the traces meet a vertex), inset
// for the 2px stroke. ViewBox 44×38; via-pads sit on the left/right points.
const HEX = "2,19 13,2 31,2 42,19 31,36 13,36";

type State = GuideStageStatus["state"];

// Stroke colour of the cell (currentColor → the <polygon> stroke + via-pads).
function strokeClass(state: State, isViewing: boolean): string {
  if (isViewing) return "text-command-gold";
  switch (state) {
    case "complete":
      return "text-gold-light";
    case "partial":
      return "text-command-gold";
    case "blocked":
      return "text-alert-red";
    default:
      return "text-panel-border";
  }
}

// Honey fill: full on done, a faint pour on in-progress, empty otherwise.
function fillRef(state: State): string {
  switch (state) {
    case "complete":
      return "url(#gs-honey)";
    case "partial":
      return "url(#gs-honey-soft)";
    default:
      return "transparent";
  }
}

// The number / ✓ sitting in the cell. The ✓ is dark — stamped onto the honey.
function glyphClass(state: State, isViewing: boolean): string {
  if (state === "complete") return "text-deep-space";
  if (isViewing) return "text-command-gold";
  switch (state) {
    case "partial":
      return "text-command-gold";
    case "blocked":
      return "text-alert-red";
    default:
      return "text-muted";
  }
}

function labelClass(state: State, isViewing: boolean): string {
  if (isViewing) return "text-command-gold font-bold";
  switch (state) {
    case "complete":
      return "text-gold-light";
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
  /** The card currently being viewed → "you are here" pulse. Omit on the hub. */
  viewingStage?: GuideStage;
}) {
  const href = (s: GuideStage) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;
  const viewing = viewingStage
    ? stages.find((s) => s.stage === viewingStage)
    : undefined;
  const total = String(stages.length).padStart(2, "0");

  return (
    <nav aria-label="Build guide progress" className="glass-card px-5 py-4 sm:px-6">
      {/* honey gradients — defined once, referenced by every cell */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="gs-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
          <linearGradient id="gs-honey-soft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8963e" stopOpacity="0.32" />
            <stop offset="1" stopColor="#c8963e" stopOpacity="0.08" />
          </linearGradient>
        </defs>
      </svg>

      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Build guide
        {viewing ? (
          <span className="font-bold text-command-gold">
            {" · "}Step {String(viewing.ordinal + 1).padStart(2, "0")} / {total} —{" "}
            {STAGE_LABELS[viewing.stage]}
          </span>
        ) : (
          <span className="text-gold-dim">{" · "}order of operations</span>
        )}
      </p>

      <ol className="flex items-start [--hh:16px] sm:[--hh:22px]">
        {stages.map((s, i) => {
          const isViewing = s.stage === viewingStage;
          const isLast = i === stages.length - 1;
          const prevComplete = i > 0 && stages[i - 1]!.state === "complete";
          const num = String(s.ordinal + 1).padStart(2, "0");
          return (
            <li
              key={s.stage}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* copper trace to the previous cell — routed (gold) once the
                  earlier stage is done, else a dim unrouted run. */}
              {i > 0 ? (
                <span
                  aria-hidden
                  className={`absolute top-4 h-px -translate-y-1/2 sm:top-5 ${
                    prevComplete ? "bg-command-gold" : "bg-panel-border"
                  }`}
                  style={{
                    left: "calc(-50% + var(--hh))",
                    width: "calc(100% - var(--hh) * 2)",
                  }}
                />
              ) : null}

              <Link
                href={href(s.stage)}
                aria-current={isViewing ? "step" : undefined}
                aria-label={`${STAGE_LABELS[s.stage]} — ${s.state}${isViewing ? " (current)" : ""}`}
                className="group relative z-10 flex h-8 w-8 items-center justify-center sm:h-10 sm:w-11"
              >
                <svg
                  viewBox="0 0 44 38"
                  className={`absolute inset-0 h-full w-full transition-[filter] ${strokeClass(
                    s.state,
                    isViewing,
                  )} ${isViewing ? "animate-pulse-brand" : ""}`}
                  style={
                    isViewing
                      ? { filter: "drop-shadow(0 0 6px rgba(200,150,62,0.6))" }
                      : undefined
                  }
                >
                  <polygon
                    points={HEX}
                    fill={fillRef(s.state)}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    className="transition-colors group-hover:stroke-gold-light"
                  />
                  {/* via-pads where the traces land */}
                  {i > 0 ? (
                    <circle cx="2" cy="19" r="2.4" fill="currentColor" />
                  ) : null}
                  {!isLast ? (
                    <circle cx="42" cy="19" r="2.4" fill="currentColor" />
                  ) : null}
                </svg>
                <span
                  className={`relative z-10 font-mono text-[11px] font-bold leading-none ${glyphClass(
                    s.state,
                    isViewing,
                  )}`}
                >
                  {s.state === "complete" ? "✓" : num}
                </span>
              </Link>

              <span
                className={`mt-1.5 hidden font-mono text-[10px] uppercase tracking-wider sm:block ${labelClass(
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
