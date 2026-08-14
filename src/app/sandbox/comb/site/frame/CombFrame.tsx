"use client";

// The page shell around one comb, as the real routes build it.

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CombStage, type CombId, type Variant } from "../../CombStage";
import { MAX_CELL } from "../../geometry";
import { SANDBOX_CSS } from "../../styles";
import { COURSE_CELLS, GUIDE_CELLS } from "../../fixtures";

/** The round-one pick: the lesson comb's own prism, vanishing point centred. */
const CAM = { castFar: 0.23, vp: [0.5, 0.5] as [number, number] };

export function CombFrame({
  comb,
  shape,
  theme,
  capped,
  strokeMult: initialStroke,
  numAlpha: initialAlpha,
}: {
  comb: CombId;
  shape: "ribbon" | "grid";
  theme: "dark" | "light";
  capped: boolean;
  strokeMult: number;
  numAlpha: number;
}) {
  // The two slider-driven values live in state, seeded from the URL and then updated
  // by postMessage. They are NOT re-read from the URL, because changing an iframe's
  // src reloads it: dragging a slider would tear down and re-mount three combs per
  // frame of the drag. The message channel leaves the documents alone.
  const [strokeMult, setStrokeMult] = useState(initialStroke);
  const [numAlpha, setNumAlpha] = useState(initialAlpha);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // Same-origin only. The parent is the sandbox page; nothing else may drive this.
      if (e.origin !== window.location.origin) return;
      const d = e.data as { cvStroke?: number; cvAlpha?: number } | null;
      if (!d || typeof d !== "object") return;
      if (typeof d.cvStroke === "number") setStrokeMult(d.cvStroke);
      if (typeof d.cvAlpha === "number") setNumAlpha(d.cvAlpha);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // The frame is its own document, so the theme attribute has to be set inside it.
  useEffect(() => {
    const root = document.documentElement;
    // Set, never removed: layout.tsx resolves an unset theme from the OS, and a
    // headless browser reports light.
    root.setAttribute("data-theme", theme);
  }, [theme]);

  const variant: Variant = {
    id: "V1",
    label: "",
    note: "",
    layout: shape === "ribbon" ? { family: "ribbon" } : { family: "grid", perRow: 2 },
    cam: CAM,
  };

  const done =
    comb === "guide"
      ? GUIDE_CELLS.filter((c) => c.kind === "done").length
      : COURSE_CELLS.filter((c) => c.kind === "done").length;
  const total = comb === "guide" ? GUIDE_CELLS.length : COURSE_CELLS.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: SANDBOX_CSS }} />

      {comb === "guide" ? (
        <PageHeader
          eyebrow="BUILD GUIDE"
          title="L1.01 WROOM breakout"
          accentWord="breakout"
          lead="Build this board start to finish: design it, lay it out, then assemble and bring a real one to life. One stage at a time, checked off as you go."
          meta={[
            { label: "Project", value: "L1.01 WROOM breakout" },
            { label: "Stage", value: "LAYOUT" },
          ]}
        />
      ) : (
        <PageHeader
          eyebrow="SKILL TREE"
          title="Build it for real"
          accentWord="real"
          lead="One destination, one subsystem at a time: schematic, layout, fabrication, and bring-up. Follow the path from your first board to a brain-computer interface."
        />
      )}

      <section>
        {comb === "guide" ? (
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="title-section">STAGES</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-dim">
              {done} / {total} complete
            </span>
          </div>
        ) : null}

        {/* The real wrapper: the comb bleeds to the screen edge on a phone (the
            negative margin cancels the main's px-4) and sits in the column above it. */}
        <div className={`${comb === "guide" ? "mt-6 " : ""}-mx-4 sm:mx-0`}>
          <CombStage
            variant={variant}
            comb={comb}
            // The real site fills the width and scrolls. Fitting the comb into one
            // screen is a different product decision and it is not what these pages do.
            fit="width"
            stageH={0}
            maxCell={capped ? MAX_CELL : null}
            strokeMult={strokeMult}
            numAlpha={numAlpha}
          />
        </div>
      </section>
    </main>
  );
}
