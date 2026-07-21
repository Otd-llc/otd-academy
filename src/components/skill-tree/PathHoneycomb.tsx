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
  HexPrism,
  RATIO,
  buildCombScene,
  type Box,
} from "@/components/guide/GuideHoneycomb";
import { HexPrismScene } from "@/components/guide/HexPrismScene";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TRACK_ACCENT: Record<string, string> = {
  SENSE: "#66bb6a",
  ACT: "#c8963e",
  POWER: "#ef5350",
  COMMS: "#4a8fff",
};

/** The hex's stroke colour. Hoisted out of the render loop because the prisms now
 *  live in the shared scene svg and need it too — a `--accent` that reaches only the
 *  label leaves `stroke: var(--accent)` unresolved, and an unresolved stroke on a
 *  deep-space fill is an invisible hex. */
function accentFor(p: PathDest): string {
  if (p.isPrimary) return "#c8963e";
  return (p.goalTrack ? TRACK_ACCENT[p.goalTrack] : undefined) ?? "#8b6428";
}

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
  const [cw, setCw] = useState(0);
  const [hot, setHot] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCw(el.clientWidth);
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

  // The shared camera: this comb needs no special handling now that the projection
  // leaves every cell the same size. The flagship keeps its prominence from the ★
  // eyebrow and its brighter stroke, not from where it sits in a rotation.
  const scene = buildCombScene(layout.boxes, cw);

  return (
    <div
      ref={ref}
      className="gh"
      style={{ position: "relative", height: measured ? scene.height : undefined }}
    >
      {measured && scene.solids.length > 0 ? (
        <HexPrismScene
          solids={scene.solids}
          vb={scene.vb}
          track
          cells={paths.map((p) => ({
            kind: "pending" as const,
            flag: p.isPrimary,
            accent: accentFor(p),
          }))}
          hot={hot}
        />
      ) : null}
      {paths.map((p, i) => {
        const b = layout.boxes[i];
        const accent = accentFor(p);
        const eyebrow = p.isPrimary
          ? "★ Flagship"
          : (p.goalTrack ?? (p.isBench ? "Bench" : "Path"));
        const chip =
          signedIn && p.done > 0
            ? `${p.done}/${p.total} done`
            : p.isBench
              ? `${p.total} tools`
              : `${p.total} courses`;

        // Measured: content billboarded onto the projected face. Pre-measure: the
        // stacked fallback that keeps these links in the SSR HTML.
        const placed = b ? scene.place(i) : null;
        const wrapStyle: CSSProperties = placed
          ? placed
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
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
            {/* flat shell = pre-measure fallback only; measured hexes are in the scene */}
            {placed ? null : <HexPrism className="phex-hex" />}
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
