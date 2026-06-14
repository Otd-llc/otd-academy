"use client";

// Shared scroll-reveal primitive for guide diagrams. The single mechanism behind
// every animated diagram (see docs/diagrams/animation-standards.md) — extracted
// from the original MpnAnatomyDiagram so the reveal is built ONE way, not
// reinvented per file.
//
// Contract (per the standard):
//   - `armed`  → JS has mounted and motion is allowed. Until then the diagram
//                renders fully visible, so an SSR / no-JS / reduced-motion render
//                is never blank.
//   - `inView` → the element has scrolled into view at least once (fire-once;
//                the observer disconnects after the first intersection).
//
// Reduced motion is a HARD rule: if the user prefers reduced motion we never arm,
// so the CSS keeps everything in its final state with no transition.
import { useEffect, useRef, useState } from "react";

export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  threshold = 0.25,
) {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // HARD rule: respect prefers-reduced-motion — never arm, never animate.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect(); // fire once
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, armed, inView };
}
