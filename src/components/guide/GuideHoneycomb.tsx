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

const MINW = 270; // minimum hex width — it grows to fill, never below this
const MAXW = 360;
const RATIO = 1.1547; // regular pointy-top: height / width

export type HoneycombStage = {
  stage: GuideStage;
  /** "01" … */
  num: string;
  title: string;
  lead: string;
  kind: "done" | "current" | "blocked" | "pending";
  statusText: string;
};

type Box = { left: number; top: number; w: number; h: number };

function computeLayout(cw: number, count: number): { boxes: Box[]; height: number } {
  if (cw <= 0 || count === 0) return { boxes: [], height: 0 };
  let perRow = Math.max(1, Math.min(Math.floor(cw / MINW), count));
  let off = perRow > 1 ? 0.5 : 0;
  let w = cw / (perRow + off);
  while (w < MINW && perRow > 1) {
    perRow--;
    off = perRow > 1 ? 0.5 : 0;
    w = cw / (perRow + off);
  }
  if (w > MAXW) w = MAXW;
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
    setLayout(computeLayout(el.clientWidth, stages.length));
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
            <span className="gh-num" aria-hidden style={{ fontSize: Math.round(b.w * 0.43) }}>
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
