"use client";

// THE VEIL ROUND: variations on the one treatment the owner picked, with the artifact
// tiles on.
//
// The previous round shipped without them. `GuideHoneycomb` hoists its artwork into a
// `.gh-art-layer` ABOVE every cell - because a cell is a positioned, z-indexed box and
// therefore a stacking context, so art parented inside one can never rise over the next
// cell's outline - and the carousel simply did not have that layer. The hexes carried
// their number, title and chip and nothing else, which is what "where are my icons"
// means. The tile is now the shipped `StageTile`, imported rather than redrawn, so the
// ghost's masking rule comes with it.
//
// WHAT VARIES HERE is the veil depth and what the ARTWORK does outside the window.
// Those are separable questions: the veil says how the run leaves the frame, and the
// art mode says whether an off-window hex is still a stage or just a cell. Six
// treatments rather than a slider, because the owner picks by looking.
//
// ASCII only.

import { useEffect, useState } from "react";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/stages";
import { Carousel, type ArtMode, type Cell, type Veil } from "../comb-carousel/Carousel";
import { combWindow } from "@/lib/comb-carousel";
import { CombLock } from "@/components/guide/CombLock";

const LEADS: Record<string, string> = {
  REQUIREMENTS: "What the board has to do",
  BOM_SOURCING: "Real parts, in stock",
  SCHEMATIC: "The circuit, drawn",
  LAYOUT: "Copper, placed",
  DRC_GERBER: "Checked and exported",
  ORDERING: "Sent to the fab",
  ASSEMBLY: "Built",
  BRINGUP: "Alive",
};

const STAGES = STAGE_ORDER.filter((s) => s !== "REVISION");

type Treatment = {
  id: string;
  name: string;
  veil: Veil;
  art: ArtMode;
  claim: string;
};

const TREATMENTS: Treatment[] = [
  {
    id: "soft",
    name: "Soft",
    veil: { top: 22, bottom: 78 },
    art: "kind",
    claim:
      "The veil the owner picked, unchanged, with the tiles on. Ghost cells keep their real state, so a completed stage shows its artifact and an unreached one shows the gold ghost. The control.",
  },
  {
    id: "tight",
    name: "Tight",
    veil: { top: 12, bottom: 88 },
    art: "kind",
    claim:
      "The veil pulled back to the very edges. More of the run survives, so the comb reads as a long course you are part-way down rather than as three cells with atmosphere.",
  },
  {
    id: "deep",
    name: "Deep",
    veil: { top: 34, bottom: 66 },
    art: "kind",
    claim:
      "The veil driven in until it almost touches the window. Nearly all attention on the three, and the run only implied. The most video-like of the six.",
  },
  {
    id: "lit-art",
    name: "Art on the three",
    veil: { top: 22, bottom: 78 },
    art: "lit-only",
    claim:
      "Only the lit cells carry a tile. The ghosts are hex and number alone, so the artwork marks the window rather than decorating the whole run - and nothing outside it competes with the current stage's board.",
  },
  {
    id: "all-ghost",
    name: "Ghost the art",
    veil: { top: 22, bottom: 78 },
    art: "always-ghost",
    claim:
      "Every off-window cell forced to the unreached treatment, so the run is one continuous gold drawing and only the window holds photographs. Reads as a plan with your place on it.",
  },
  {
    id: "art-only",
    name: "Art carries it",
    veil: { top: 22, bottom: 78 },
    art: "art-only",
    claim:
      "Ghosts drop their title and chip and keep their tile. The run says what each stage PRODUCES without asking anyone to read eight labels they are not on.",
  },
];

export function Round() {
  const [current, setCurrent] = useState(3);
  const [pick, setPick] = useState<string>("soft");
  const [light, setLight] = useState(false);
  // 720 puts the cell at ~211px and 960 at ~282px. BOTH are above the 200px
  // container-query breakpoint, below which globals.css switches to the compact
  // card - it hides the lead outright and re-places the number, title and chip. The
  // previous round ran at 520, which solved to ~153px, so it was auditioning a card
  // that does not ship.
  const [tall, setTall] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const was = el.dataset.theme;
    el.dataset.theme = light ? "light" : "dark";
    return () => {
      if (was === undefined) delete el.dataset.theme;
      else el.dataset.theme = was;
    };
  }, [light]);

  const cells: Cell[] = STAGES.map((s, i) => ({
    stage: s as Cell["stage"],
    num: String(i + 1).padStart(2, "0"),
    title: STAGE_LABELS[s],
    lead: LEADS[s] ?? "",
    kind: i < current ? "done" : i === current ? "current" : "pending",
    statusText: i < current ? "done" : i === current ? "here" : "locked",
  }));
  const win = combWindow(cells.length, current);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; Sandbox
      </p>
      <h1 className="title-hero mt-2">Veil, with tiles</h1>
      <p className="subhead mt-3">
        Variations on the veiled carousel, with the build guide&apos;s own artifact tiles on the
        hexes.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-panel-border/60 py-3">
        <label className="flex min-w-[240px] flex-1 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">current</span>
          <input
            type="range"
            min={0}
            max={cells.length - 1}
            step={1}
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value))}
            className="flex-1 accent-[var(--color-command-gold)]"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-command-gold">
            {String(current + 1).padStart(2, "0")} / {String(cells.length).padStart(2, "0")}
          </span>
        </label>
        {[
          ["light", light, setLight] as const,
          ["tall frame", tall, setTall] as const,
        ].map(([label, val, set]) => (
          <label
            key={label}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
          >
            <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
            {label}
          </label>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        lit {win.lit.map((i) => String(i + 1).padStart(2, "0")).join(" ")}
        {win.spill === "next-course" ? (
          <span className="text-command-gold"> &middot; spills to the next course</span>
        ) : null}
        {current === 0 ? (
          <span className="text-command-gold"> &middot; no previous, so current plus two</span>
        ) : null}
      </p>

      {/* THE PROMOTED MARKER, on its own. `GuideHoneycomb` only renders on an
          auth-gated project page, so without this the product component would
          ship having been typechecked and never looked at. Reload to replay it:
          it runs once on mount and holds, which is the behaviour being checked. */}
      <div className="mt-8 border-y border-panel-border/60 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          &#9656; current-cell marker &middot; promoted
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The picked lock as it runs on the SITE: once on mount, then held. Reload the page to
          replay it.
        </p>
        <div style={{ position: "relative", width: 320, height: 380, marginTop: 12 }}>
          <CombLock box={{ left: 30, top: 30, w: 260, h: 300 }} sceneW={320} sceneH={380} />
        </div>
      </div>

      <ul className="mt-8 grid gap-x-6 gap-y-10 lg:grid-cols-2">
        {TREATMENTS.map((tr) => (
          <li key={tr.id} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-command-gold">
                veil/{tr.id}
              </span>
              <span className="title-card text-[15px]">{tr.name}</span>
            </div>
            <div className="mt-2 border border-panel-border/60">
              <Carousel
                cells={cells}
                current={current}
                ghost="veil"
                veil={tr.veil}
                art={tr.art}
                viewH={tall ? 960 : 720}
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{tr.claim}</p>
            <button
              type="button"
              onClick={() => setPick(tr.id)}
              className={`mt-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] focus-visible:border-command-gold focus-visible:outline-none ${
                pick === tr.id
                  ? "border-command-gold text-command-gold"
                  : "border-panel-border text-muted hover:border-gold-light hover:text-gold-light"
              }`}
            >
              {pick === tr.id ? "picked" : "pick"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
