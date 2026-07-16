"use client";

// Shared scroll-parallax primitive for guide diagrams. Companion to
// useScrollReveal, and deliberately the ONLY other motion mechanism (see
// docs/diagrams/animation-standards.md — build one way, don't reinvent per file).
//
// useScrollReveal is fire-once: it answers "has this entered view yet?" and is all
// a Tier-A entrance needs. Parallax needs the opposite — the scroll position,
// continuously — so it cannot be expressed on that hook.
//
// Contract:
//   - writes a single `--p` custom property onto the element, -1 .. +1, where
//     0 means "element centred in the viewport". CSS does everything else.
//   - never sets React state, so scrolling does not re-render the tree.
//   - only `transform` may read `--p`, which keeps the work composited (CLS 0).
//
// Reduced motion is a HARD rule: we never observe and never write `--p`, so every
// `var(--p,0)` resolves to 0 and the diagram renders at its settled position. That
// settled frame is also exactly what the raster exporter must capture, which is why
// the export route forces reduced-motion rather than trusting scroll position.
import { useEffect, useRef } from "react";

export function useScrollParallax<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const write = () => {
      ticking = false;
      const r = el.getBoundingClientRect();
      const centre = r.top + r.height / 2;
      const p = Math.max(-1, Math.min(1, 1 - (2 * centre) / window.innerHeight));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(write);
      }
    };

    // Only listen while the diagram is actually on screen — a lesson page can hold
    // several diagrams, and none of them should cost a scroll handler offscreen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            window.addEventListener("scroll", onScroll, { passive: true });
            write();
          } else {
            window.removeEventListener("scroll", onScroll);
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return ref;
}
