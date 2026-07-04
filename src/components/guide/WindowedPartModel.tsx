"use client";

// A half-size floating part preview for a BOM row. WINDOWED: the three.js
// viewer mounts only while the row is on-screen and unmounts when scrolled away,
// so a long BOM (15+ parts) never exceeds the browser's ~16 live-WebGL-context
// limit. Reuses ModelViewer float mode (transparent, spinning, rotate-only) with
// its built-in pill suppressed — the row supplies its own off-model "drag to
// rotate" hint in the spec column.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => <div className="h-28 w-full" />,
});

export function WindowedPartModel({
  src,
  bounds,
}: {
  src: string;
  bounds: RenderBounds | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setLive(e.isIntersecting), {
      rootMargin: "150px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-28 w-full">
      {live ? (
        <ModelViewer src={src} bounds={bounds} float showHint={false} heightClass="h-28" />
      ) : null}
    </div>
  );
}
