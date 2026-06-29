"use client";

// PathHoneycomb — the /courses "Go further" destinations laid out as a measured,
// TESSELLATING comb of track-stroked hexes (one per other build), so the rows
// nestle (offset, overlapping) instead of floating in a plain grid with dead
// gaps. Reuses `computeLayout` (4-up on desktop → 2-up offset on phones) + the
// `.phex-*` CSS. Each hex's track sets the stroke/accent (SENSE green / ACT gold
// / POWER red / COMMS blue), dimmed at rest and lit on hover; the flagship reads
// ★ gold. Pre-measure it renders a stacked fallback so the links exist in SSR.

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  computeLayout,
  RATIO,
  type Box,
} from "@/components/guide/GuideHoneycomb";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TRACK_ACCENT: Record<string, string> = {
  SENSE: "#66bb6a",
  ACT: "#c8963e",
  POWER: "#ef5350",
  COMMS: "#4a8fff",
};

export interface PathDest {
  key: string;
  label: string;
  total: number;
  done: number;
  goalTrack: string | null;
  isPrimary: boolean;
  isBench: boolean;
}

export function PathHoneycomb({
  paths,
  signedIn,
}: {
  paths: PathDest[];
  signedIn: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ boxes: Box[]; height: number }>({
    boxes: [],
    height: 0,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 4-up on a wide row, capped so desktop hexes stay compact; collapses to a
    // 2-up offset comb on phones (smaller than the body comb's min).
    setLayout(
      computeLayout(el.clientWidth, paths.length, {
        perRow: 4,
        minW: 132,
        maxW: 260,
      }),
    );
  }, [paths.length]);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  const measured = layout.boxes.length === paths.length && layout.height > 0;

  if (paths.length === 0) return null;

  return (
    <div
      ref={ref}
      className="gh"
      style={{ position: "relative", height: measured ? layout.height : undefined }}
    >
      {paths.map((p, i) => {
        const b = layout.boxes[i];
        const accent = p.isPrimary
          ? "#c8963e"
          : p.goalTrack
            ? TRACK_ACCENT[p.goalTrack] ?? "#8b6428"
            : "#8b6428";
        const eyebrow = p.isPrimary
          ? "★ Flagship"
          : (p.goalTrack ?? (p.isBench ? "Bench" : "Path"));
        const chip =
          signedIn && p.done > 0
            ? `${p.done}/${p.total} done`
            : p.isBench
              ? `${p.total} tools`
              : `${p.total} courses`;

        const wrapStyle: CSSProperties = b
          ? { position: "absolute", left: b.left, top: b.top, width: b.w, height: b.h }
          : {
              position: "relative",
              width: "100%",
              maxWidth: 230,
              margin: "0 auto 10px",
              aspectRatio: `1 / ${RATIO}`,
            };

        return (
          <Link
            key={p.key}
            href={`/courses?path=${p.key}`}
            aria-label={`${p.label} — ${chip}`}
            className={`phex group${p.isPrimary ? " flag" : ""}`}
            style={{ "--accent": accent, ...wrapStyle } as CSSProperties}
          >
            <svg
              className="phex-hex"
              viewBox="0 0 100 115.47"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87" />
            </svg>
            <span className="phex-inner">
              <span className="phex-eyebrow">{eyebrow}</span>
              <span className="phex-title">{p.label}</span>
              <span className="phex-chip">{chip}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
