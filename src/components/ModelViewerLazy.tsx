"use client";

// Auto-loading wrapper for the heavy three.js viewer. A height-reserving
// placeholder mounts the real viewer (next/dynamic, ssr:false) as soon as it
// scrolls into view via an IntersectionObserver — so three stays off the
// initial page payload, but the model appears automatically WITHOUT a click.
// Falls back to an immediate mount where IntersectionObserver is unavailable.
// Reused by parts AND the board-stub artifact surface.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded border border-panel-border bg-deep-space font-mono text-xs text-muted">
      Loading 3D viewer…
    </div>
  ),
});

export function ModelViewerLazy({
  src,
  bounds,
  heightClass = "h-64",
}: {
  src: string;
  bounds?: RenderBounds | null;
  /** Tailwind height for the viewer + its placeholder (kept identical so the
   *  in-view swap causes no layout shift). Compact by default. */
  heightClass?: string;
}) {
  const [show, setShow] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) return;
    const el = placeholderRef.current;
    if (!el) return;
    // No IntersectionObserver (very old browser) → just mount.
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          obs.disconnect();
        }
      },
      // Mount a little before it's fully on-screen so it's ready as you scroll.
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [show]);

  if (show) {
    return <ModelViewer src={src} bounds={bounds} heightClass={heightClass} />;
  }

  return (
    <div
      ref={placeholderRef}
      className={`flex ${heightClass} w-full items-center justify-center rounded border border-panel-border bg-deep-space font-mono text-xs text-muted`}
    >
      Loading 3D model…
    </div>
  );
}
