"use client";

// GuideStepper — the build-guide "order of operations" rail as a SERPENTINE
// honeycomb: the 8 pipeline stages (REQUIREMENTS → BRINGUP) are flat-top hex
// cells wired in sequence. It holds a fixed minimum cell size and FULL detail;
// when the row runs out of width the sequence wraps BACK AND FORTH (boustrophedon)
// and the connector bends straight down at each turn.
//
// Progress fills the comb: completed cells glow honey-gold with a ✓, the cell
// you're viewing pulses like a board powering up, cells ahead stay dim. The
// connector is SOLID gold through the completed run and DOTTED from the current
// step onward.
//
// Layout is measured on the client (ResizeObserver → columns-per-row), and the
// connector is one SVG polyline through the cell centres (it snakes for free).

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuideStageStatus } from "@/lib/guide-progress";
import { type GuideStage } from "@/lib/guide-templates/stage-skeletons";
import { STAGE_LABELS } from "@/lib/stages";

// Layout effect on the client, plain effect on the server (no SSR warning).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type State = GuideStageStatus["state"];

// Flat-top hexagon (points on the left/right), inset for the 2px stroke. 44×38.
const HEX = "2,19 13,2 31,2 42,19 31,36 13,36";
const TARGET_NODE = 82; // preferred cell width — wrap to keep cells near this, not shrink
const MIN_NODE = 48; // hard floor, only reached on a very narrow rail
const MAX_NODE = 104; // compact — don't let cells balloon
const GAP = 14;
const ROWGAP = 12;

// Three-letter stage codes shown under the step number in each rail cell.
const STAGE_ABBR: Record<string, string> = {
  REQUIREMENTS: "REQ",
  BOM_SOURCING: "BOM",
  SCHEMATIC: "SCH",
  LAYOUT: "LAY",
  DRC_GERBER: "DRC",
  ORDERING: "ORD",
  ASSEMBLY: "ASM",
  BRINGUP: "BUP",
};
const abbr = (s: GuideStage) => STAGE_ABBR[s] ?? s.slice(0, 3);

// Stroke colour of the cell.
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

// Honey fill on done; opaque deep-space otherwise (so the connector behind the
// cell stays hidden — only the between-cell run shows).
function fillRef(state: State): string {
  switch (state) {
    case "complete":
      return "url(#gs-honey)";
    case "partial":
      return "url(#gs-honey-soft)";
    default:
      return "var(--color-deep-space)";
  }
}

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

  // Split the connector at the current step: solid through it, dotted after.
  const viewingIdx = viewingStage
    ? stages.findIndex((s) => s.stage === viewingStage)
    : -1;
  const lastComplete = stages.reduce(
    (acc, s, i) => (s.state === "complete" ? i : acc),
    -1,
  );
  const boundary = viewingIdx >= 0 ? viewingIdx : lastComplete;

  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [perRow, setPerRow] = useState(stages.length);
  const [node, setNode] = useState(MIN_NODE);
  const [paths, setPaths] = useState<{ done: string; todo: string }>({
    done: "",
    todo: "",
  });
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const measureCols = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const avail = el.clientWidth;
    // serpentine BEFORE shrinking: fit as many target-sized cells as the row holds
    // (wrapping the rest), then fill that row — so cells stay big enough for labels
    // instead of cramming all of them small into one line.
    let pr = Math.floor((avail + GAP) / (TARGET_NODE + GAP));
    pr = Math.max(2, Math.min(pr, stages.length));
    let n = (avail - (pr - 1) * GAP) / pr;
    n = Math.max(MIN_NODE, Math.min(n, MAX_NODE));
    setPerRow((prev) => (prev === pr ? prev : pr));
    setNode((prev) => (Math.abs(prev - n) < 0.5 ? prev : n));
  }, [stages.length]);

  useIsoLayoutEffect(() => {
    measureCols();
    const ro = new ResizeObserver(measureCols);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measureCols]);

  // After the grid lays out (perRow / data changed), trace the connector through
  // the cell centres in step order.
  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pts = nodeRefs.current.slice(0, stages.length).map((n) => {
      if (!n) return [0, 0] as const;
      const r = n.getBoundingClientRect();
      return [r.left - rect.left + r.width / 2, r.top - rect.top + r.height / 2] as const;
    });
    const seg = (from: number, to: number) =>
      pts
        .slice(from, to + 1)
        .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
        .join(" ");
    const last = pts.length - 1;
    const b = Math.max(0, Math.min(boundary, last));
    setPaths({ done: b > 0 ? seg(0, b) : "", todo: b < last ? seg(b, last) : "" });
    setDims({ w: rect.width, h: rect.height });
  }, [perRow, node, boundary, stages]);

  // number, a short divider rule, and a 3-letter code — all scale with the cell.
  const glyphPx = Math.round(Math.min(Math.max(node * 0.3, 13), 32));
  const codePx = Math.round(Math.min(Math.max(node * 0.145, 8), 12));
  const ruleW = Math.round(node * 0.34);
  const ruleM = Math.round(node * 0.06);

  return (
    <nav aria-label="Build guide progress" className="py-4">
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

      <div ref={wrapRef} className="relative">
        {/* connector: solid through done, dotted from the current step on */}
        <svg
          aria-hidden
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        >
          {paths.done ? (
            <path
              d={paths.done}
              fill="none"
              stroke="var(--color-command-gold)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {paths.todo ? (
            <path
              d={paths.todo}
              fill="none"
              stroke="#4a4f63"
              strokeWidth={2.5}
              strokeDasharray="0.1 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>

        <ol
          className="relative z-10 grid list-none p-0"
          style={{
            gridTemplateColumns: `repeat(${perRow}, ${node}px)`,
            columnGap: GAP,
            rowGap: ROWGAP,
            justifyContent: "start",
            alignItems: "center",
          }}
        >
          {stages.map((s, idx) => {
            const isViewing = s.stage === viewingStage;
            const row = Math.floor(idx / perRow);
            const pos = idx % perRow;
            const col = row % 2 === 0 ? pos : perRow - 1 - pos; // serpentine
            const num = String(s.ordinal + 1).padStart(2, "0");
            return (
              <li key={s.stage} className="contents">
                <Link
                  ref={(el) => {
                    nodeRefs.current[idx] = el;
                  }}
                  href={href(s.stage)}
                  aria-current={isViewing ? "step" : undefined}
                  aria-label={`${STAGE_LABELS[s.stage]} — ${s.state}${isViewing ? " (current)" : ""}`}
                  style={{
                    gridRow: row + 1,
                    gridColumn: col + 1,
                    width: node,
                    aspectRatio: "44 / 38",
                  }}
                  className="group relative flex flex-col items-center justify-center"
                >
                  <svg
                    viewBox="0 0 44 38"
                    className={`absolute inset-0 h-full w-full transition-[filter] ${strokeClass(
                      s.state,
                      isViewing,
                    )} ${isViewing ? "gs-pulse" : ""}`}
                  >
                    {/* opaque backdrop so the connector routed behind the cell
                        stays hidden — only the between-cell run shows. The
                        translucent honey-soft (partial/current) fill would
                        otherwise reveal the line straight through the cell. */}
                    <polygon points={HEX} fill="var(--color-deep-space)" />
                    <polygon
                      points={HEX}
                      fill={fillRef(s.state)}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      className="transition-colors group-hover:stroke-gold-light"
                    />
                  </svg>
                  <span
                    className={`relative z-10 font-mono font-bold leading-none ${glyphClass(
                      s.state,
                      isViewing,
                    )}`}
                    style={{ fontSize: glyphPx }}
                  >
                    {s.state === "complete" ? "✓" : num}
                  </span>
                  <span
                    aria-hidden
                    className={`relative z-10 rounded-full ${glyphClass(s.state, isViewing)}`}
                    style={{
                      width: ruleW,
                      height: 2,
                      background: "currentColor",
                      opacity: 0.7,
                      margin: `${ruleM}px 0`,
                    }}
                  />
                  <span
                    className={`relative z-10 font-mono font-bold uppercase leading-none tracking-[0.05em] ${glyphClass(
                      s.state,
                      isViewing,
                    )}`}
                    style={{ fontSize: codePx }}
                  >
                    {abbr(s.stage)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
