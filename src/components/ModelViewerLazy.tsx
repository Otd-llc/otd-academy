"use client";

// Intent-gated wrapper: shows a poster button; the heavy three.js viewer mounts
// only on click (next/dynamic, ssr:false), keeping three off the initial page
// payload. Reused by parts AND the board-stub artifact surface.
import dynamic from "next/dynamic";
import { useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded border border-panel-border bg-deep-space font-mono text-xs text-muted">
      Loading 3D viewer…
    </div>
  ),
});

export function ModelViewerLazy({ src, bounds }: { src: string; bounds?: RenderBounds | null }) {
  const [show, setShow] = useState(false);
  if (show) return <ModelViewer src={src} bounds={bounds} />;
  return (
    <button
      type="button"
      onClick={() => setShow(true)}
      className="glass-button inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
    >
      View 3D model
    </button>
  );
}
