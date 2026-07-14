"use client";

// Diagram chrome context (2026-07-14). In the reading view a diagram's title/eyebrow/
// caption just echo the prose beside it, so the in-lesson renderer (GuideBlocks) wraps
// each diagram in DiagramChromeProvider with `bare: true` + its figure number; the frame
// then shows only the graphic + a "Fig N" corner label. Everything else — most notably
// the standalone /diagram-render EXPORT (rendered with the default context) — stays FULL
// (title + caption baked in), so the indexable image + share cards keep their context.
import { createContext, useContext, type ReactNode } from "react";

export type DiagramChrome = { bare: boolean; fig: number | null };

const DiagramChromeContext = createContext<DiagramChrome>({ bare: false, fig: null });

export function useDiagramChrome(): DiagramChrome {
  return useContext(DiagramChromeContext);
}

export function DiagramChromeProvider({
  bare,
  fig,
  children,
}: {
  bare: boolean;
  fig: number | null;
  children: ReactNode;
}) {
  return <DiagramChromeContext.Provider value={{ bare, fig }}>{children}</DiagramChromeContext.Provider>;
}
