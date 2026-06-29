"use client";

// GuideHoneycomb — the build-guide hub as a page of big SYMMETRIC info-hexes that
// TESSELLATE (shared edges, offset rows) and slink through in order. Each hex is
// the full stage button: a big outline stage NUMBER owning the top third, then
// title · lead · a status chip; the whole hex is the link.
// Honey-filled when done, the current stage pulses, ahead stays dim. No connector
// line — the shared edges are the link; progress shows by fill.
//
// Layout is measured on the client: the hexes GROW to fill the available width
// (3-ish per row on desktop, collapsing to a single full-width column on mobile),
// so they never clip or overflow. Pointy-top regular hexes (height = width·√3⁻¹·2).

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const MAXW = 360;
const PER_ROW = 3; // up to three across on wide screens
const MIN_ROW = 2; // never fewer than two — the comb never becomes a vertical strip
const MINW = 165; // drop 3→2 columns once cells would shrink below this
export const RATIO = 1.1547; // regular pointy-top: height / width

export type HoneycombStage = {
  stage: GuideStage;
  /** "01" … */
  num: string;
  title: string;
  lead: string;
  kind: "done" | "current" | "blocked" | "pending";
  statusText: string;
};

export type Box = { left: number; top: number; w: number; h: number };

// Measure-and-fill honeycomb layout: given a container width + node count, place
// `count` pointy-top hexes in offset, snaking rows that grow to fill the width
// (3-up desktop → 2-up phone, never a 1-wide strip). Shared with SkillHoneycomb
// + PathHoneycomb so the build-guide hub, /courses skill tree, and the /courses
// "go further" destinations all tessellate identically. `opts` lets a caller
// widen the row (e.g. 4-up) or cap the cell size; the defaults are the hub's.
export function computeLayout(
  cw: number,
  count: number,
  opts?: { perRow?: number; minW?: number; maxW?: number },
): { boxes: Box[]; height: number } {
  const perRowMax = opts?.perRow ?? PER_ROW;
  const minW = opts?.minW ?? MINW;
  const maxW = opts?.maxW ?? MAXW;
  if (cw <= 0 || count === 0) return { boxes: [], height: 0 };
  let perRow = Math.min(count, perRowMax);
  let off = perRow > 1 ? 0.5 : 0;
  let w = cw / (perRow + off);
  // drop a column when cells would get too small, but never below two-across
  while (w < minW && perRow > MIN_ROW) {
    perRow--;
    off = perRow > 1 ? 0.5 : 0;
    w = cw / (perRow + off);
  }
  if (w > maxW) w = maxW;
  const h = w * RATIO;
  const vstep = h * 0.75; // rows overlap by 1/4 so they nestle
  const rows = Math.ceil(count / perRow);
  const usedW = perRow * w + off * w;
  const pad = Math.max(0, (cw - usedW) / 2);
  const boxes: Box[] = [];
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / perRow);
    const pos = idx % perRow;
    const col = row % 2 === 0 ? pos : perRow - 1 - pos; // snake
    const xoff = row % 2 === 1 && perRow > 1 ? w / 2 : 0;
    boxes.push({ left: pad + col * w + xoff, top: row * vstep, w, h });
  }
  return { boxes, height: (rows - 1) * vstep + h };
}

export function GuideHoneycomb({
  slug,
  revLabel,
  stages,
}: {
  slug: string;
  revLabel: string;
  stages: HoneycombStage[];
}) {
  const href = (s: GuideStage) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ boxes: Box[]; height: number }>({
    boxes: [],
    height: 0,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Lower minW than the default so phones pack 3-up (smaller, more compact
    // hexes) instead of two big ones — the build guide now has 8 stages to show.
    setLayout(computeLayout(el.clientWidth, stages.length, { minW: 100 }));
  }, [stages.length]);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={ref} className="gh" style={{ position: "relative", height: layout.height }}>
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="gh-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>
      {stages.map((s, i) => {
        const b = layout.boxes[i];
        if (!b) return null;
        return (
          <Link
            key={s.stage}
            href={href(s.stage)}
            aria-current={s.kind === "current" ? "step" : undefined}
            aria-label={`Stage ${s.num} — ${s.title} (${s.statusText})`}
            className={`gh-node ${s.kind}`}
            style={{ left: b.left, top: b.top, width: b.w, height: b.h }}
          >
            <svg
              className="gh-hex"
              viewBox="0 0 100 115.47"
              preserveAspectRatio="none"
              aria-hidden
            >
              <polygon points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87" />
            </svg>
            <span
              className="gh-num"
              aria-hidden
              // hero size on big cells; eased down on small ones so it stops
              // swallowing the room the title + chip need on a phone.
              // Saira Condensed (the numeral face) renders taller/heavier than
              // Bebas at the same size, so the multiplier is eased down vs the old
              // Bebas tuning to keep the number clear of the title below it.
              style={{ fontSize: Math.round(b.w * (b.w <= 200 ? 0.32 : 0.38)) }}
            >
              {s.num}
            </span>
            <span className="gh-m">
              <span className="gh-title">{s.title}</span>
              {s.lead ? <span className="gh-lead">{s.lead}</span> : null}
            </span>
            <span className="gh-status">
              <span className="gh-chip">{s.statusText}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
