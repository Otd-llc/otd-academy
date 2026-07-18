"use client";

// A hi-res, zoomable image (the "answer key" type). The in-flow thumbnail opens a
// full-screen lightbox with scroll/pinch-to-zoom and drag-to-pan, so a learner can
// read fine detail (net labels, refdes) on a dense capture the page can't show at
// size. Self-contained: pointer + wheel + keyboard, no deps. The source is a
// full-resolution PNG (see the `zoom` capture path), so scaling up reveals real
// pixels, not blur.
import { useCallback, useEffect, useRef, useState } from "react";

export function ZoomableImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOff({ x: 0, y: 0 });
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // Esc closes; lock body scroll while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setScale((s) => Math.min(8, Math.max(1, s * factor)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded border border-panel-border bg-diagram-surface"
        aria-label={`Zoom: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="w-full object-contain" />
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-deep-space/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-command-gold">
          ⤢ click to zoom
        </span>
      </button>
      {caption ? (
        <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
          {caption}
        </figcaption>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[100] flex flex-col bg-deep-space/95"
        >
          <div className="flex items-center justify-between border-b border-panel-border/60 px-4 py-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              scroll to zoom · drag to pan · esc to close
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded border border-panel-border px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
              >
                reset
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded border border-command-gold/40 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold/10"
              >
                close ✕
              </button>
            </div>
          </div>
          <div
            className="relative flex flex-1 touch-none items-center justify-center overflow-hidden bg-diagram-surface"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
              style={{ transform: `translate(${off.x}px,${off.y}px) scale(${scale})` }}
            />
          </div>
        </div>
      ) : null}
    </figure>
  );
}
