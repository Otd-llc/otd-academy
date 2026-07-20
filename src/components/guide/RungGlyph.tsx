// A distinct SHAPE per alert rung, so severity survives greyscale, print and
// colour-blindness instead of being carried by colour alone: an info disc for
// note, a triangle for gotcha, an octagon for warning.
//
// Pure presentational SVG with `stroke="currentColor"`, so it themes for free.
// No "use client" — it has no state and renders inside the server GuideBlocks tree.

import type { Rung } from "@/lib/guide-signposts";

export function RungGlyph({ rung }: { rung: Rung }) {
  const p = {
    className: "h-3.5 w-3.5 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (rung === "note")
    return (
      <svg {...p} aria-hidden>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v.01M12 11.5v4.5" />
      </svg>
    );
  if (rung === "warning")
    return (
      <svg {...p} aria-hidden>
        <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
        <path d="M12 8v4.5" />
        <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  return (
    <svg {...p} aria-hidden>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
