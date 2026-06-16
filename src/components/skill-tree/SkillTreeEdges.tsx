"use client";

// Decorative SVG edge overlay for the desktop skill-tree grid (Task 7).
//
// This is a CLIENT component that draws the dependency edges as a purely
// decorative SVG layer on top of `SkillTreeGrid`. It measures each node's
// on-screen position by `document.getElementById('node-${slug}')`, computes
// rects RELATIVE to this overlay's own parentElement (the grid's `relative`
// container), and draws one cubic-Bézier `<path>` per edge from the
// prerequisite's bottom-center to the dependent's top-center.
//
// It NEVER blocks interaction: the `<svg>` is `position:absolute`, covers the
// full container (inset-0, 100% w/h), and has `pointer-events:none`. The grid is
// fully navigable without it — if measurement fails (SSR, not-yet-mounted, or a
// filtered-out endpoint), the affected edge is simply skipped.
//
// Stroke by `kind` (colors read from the globals.css @theme CSS vars):
//   • FOUNDATION   → solid  command-gold (--color-command-gold)
//   • DE_RISK      → dashed signal-blue (--color-signal-blue)
//   • SHARED_BLOCK → dotted status-green (--color-status-green)

import { useCallback, useEffect, useRef, useState } from "react";

import type { RawEdge } from "@/lib/skill-tree-core";

export interface SkillTreeEdgesProps {
  edges: RawEdge[];
}

// One measured, drawable edge: an SVG path string + its kind-derived style.
interface DrawnEdge {
  key: string;
  d: string;
  stroke: string;
  strokeDasharray?: string;
}

// kind → concrete SVG stroke style. SVG `stroke` needs a real color/CSS-var, not
// a Tailwind utility class, so we reference the @theme vars directly.
const EDGE_STYLE: Record<
  RawEdge["kind"],
  { stroke: string; strokeDasharray?: string }
> = {
  FOUNDATION: { stroke: "var(--color-command-gold)" },
  DE_RISK: { stroke: "var(--color-signal-blue)", strokeDasharray: "6 4" },
  SHARED_BLOCK: { stroke: "var(--color-status-green)", strokeDasharray: "1 5" },
};

export function SkillTreeEdges({ edges }: SkillTreeEdgesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<DrawnEdge[]>([]);

  // Resolve the overlay's container. The `<svg>` is mounted as the LAST CHILD of
  // the grid's `relative` container, so its immediate parentElement IS always the
  // correct container — no need for the unreliable `offsetParent` lookup.
  const getContainer = useCallback(
    (): HTMLElement | null => svgRef.current?.parentElement ?? null,
    [],
  );

  // Measure every edge relative to the overlay's container and rebuild the path
  // list. Safe to call only after mount (touches document/getBoundingClientRect).
  const measure = useCallback(() => {
    const container = getContainer();
    if (!container) {
      setPaths([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const drawn: DrawnEdge[] = [];

    for (const edge of edges) {
      const fromEl = document.getElementById(`node-${edge.fromSlug}`);
      const toEl = document.getElementById(`node-${edge.toSlug}`);
      // Missing endpoint (filtered out / not yet mounted) → skip, no dangling line.
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // Coordinates relative to the container (subtract the container origin).
      const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
      const y1 = fromRect.bottom - containerRect.top; // prereq bottom-center
      const x2 = toRect.left + toRect.width / 2 - containerRect.left;
      const y2 = toRect.top - containerRect.top; // dependent top-center

      // Smooth cubic Bézier: control points pulled vertically toward each other
      // by half the vertical gap, so the curve leaves/enters each node straight
      // down/up. Clamp the handle length so near-horizontal edges still bow.
      const dy = Math.max(Math.abs(y2 - y1) / 2, 24);
      const d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

      const style = EDGE_STYLE[edge.kind];
      drawn.push({
        key: `${edge.fromSlug}->${edge.toSlug}:${edge.kind}`,
        d,
        stroke: style.stroke,
        strokeDasharray: style.strokeDasharray,
      });
    }

    setPaths(drawn);
  }, [edges, getContainer]);

  useEffect(() => {
    // Initial measure after mount, once node anchors exist in the DOM.
    measure();

    const container = getContainer();

    // Re-measure when the grid container resizes (reflow shifts node rects).
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => measure());
      observer.observe(container);
    }

    // Also re-measure on window resize (viewport / font / scrollbar changes that
    // a container-only observer might not catch).
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, getContainer]);

  return (
    // NO `viewBox` on purpose: path `d` values are in CSS-pixel container
    // coordinates, so adding a viewBox would rescale (and misplace) every edge.
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      // Decorative only — never intercepts pointer events on the cards beneath.
      style={{ pointerEvents: "none" }}
    >
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.stroke}
          strokeWidth={1.5}
          strokeOpacity={0.6}
          strokeDasharray={p.strokeDasharray}
        />
      ))}
    </svg>
  );
}
