"use client";

// The finished-board hero. Loads as the lightweight ortho poster with a "View in
// 3D" affordance below it; clicking (the board or the chip) mounts the real
// ModelViewer in hero mode — three.js + the GLB only fetch on that click, so
// visitors who never interact pay nothing, and it doubles as the no-WebGL/no-JS
// fallback. If the poster is missing (a board with a model but no baked poster),
// the img onError degrades to loading the viewer directly.
import { useState } from "react";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import type { RenderBounds } from "@/lib/schemas/part-asset";

const RotateGlyph = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v4h-4" />
  </svg>
);

export function ClickToLoadBoard({
  poster,
  src,
  bounds,
  heightClass = "h-80 lg:h-96",
}: {
  /** `null` when this board has no baked poster — same outcome the img's
   *  onError already produces, expressed before the request instead of after
   *  it. The callers now pass `boardPoster(slug)`, which is nullable. */
  poster: string | null;
  src: string | null;
  bounds: RenderBounds | null;
  heightClass?: string;
}) {
  const [live, setLive] = useState(false);

  if ((live || !poster) && src) {
    return <ModelViewerLazy src={src} bounds={bounds} hero heightClass={heightClass} />;
  }
  // No poster and no model: nothing to show, and an <img src=""> would request
  // the current page and paint a broken-image glyph.
  if (!poster) return null;

  return (
    <button
      type="button"
      onClick={() => src && setLive(true)}
      disabled={!src}
      className="group flex w-full cursor-pointer flex-col items-center gap-2 focus-visible:outline-none disabled:cursor-default"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt="Finished board, 3D preview"
        onError={() => src && setLive(true)}
        className="w-full max-lg:max-h-[64vw] max-lg:object-cover max-lg:object-center"
      />
      <span className="inline-flex items-center gap-1.5 rounded-md border border-command-gold/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold transition-colors group-hover:border-command-gold group-hover:text-gold-light group-focus-visible:border-command-gold group-focus-visible:text-gold-light">
        <RotateGlyph /> {src ? "View in 3D" : "3D unavailable"}
      </span>
    </button>
  );
}
