"use client";

// The alpha-carousel round. Four ghost treatments, one clock, both themes.
//
// The CURRENT cell is a control rather than a fixed sample, because the two rules that
// are easiest to get wrong are the ends: at the first cell the window keeps its width
// by taking more of what is ahead, and at the last it spills into the next course
// rather than shrinking. A round that only ever showed the middle would never show
// either.
//
// ASCII only.

import { useEffect, useState } from "react";
import { STAGE_ORDER } from "@/lib/stages";
import { STAGE_LABELS } from "@/lib/stages";
import { Carousel, GHOSTS, type Cell, type Ghost } from "./Carousel";
import { combWindow } from "@/lib/comb-carousel";

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

export function Round() {
  const [current, setCurrent] = useState(3);
  const [ghost, setGhost] = useState<Ghost>("alpha");
  const [light, setLight] = useState(false);

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
      <h1 className="title-hero mt-2">Alpha carousel</h1>
      <p className="subhead mt-3">
        The spine, windowed. Three cells lit, the rest ghosted, always centred on the current
        one.
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
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} />
          light
        </label>
      </div>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        lit {win.lit.map((i) => String(i + 1).padStart(2, "0")).join(" ")}
        {win.spill === "next-course" ? (
          <span className="text-command-gold">
            {" "}
            &middot; spills to the next course
          </span>
        ) : null}
        {current === 0 ? <span className="text-command-gold"> &middot; no previous, so current plus two</span> : null}
      </p>

      <ul className="mt-8 grid gap-x-6 gap-y-10 lg:grid-cols-2">
        {GHOSTS.map((g) => (
          <li key={g.id} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-command-gold">
                carousel/{g.id}
              </span>
              <span className="title-card text-[15px]">{g.name}</span>
            </div>
            <div className="mt-2 border border-panel-border/60">
              {/* 720, not the old 520: `fitWindowCell(520)` solves to ~153px, under
                  the 200px container-query breakpoint where globals.css switches to
                  the COMPACT card and hides the lead. A pick made against that is a
                  pick against a card that does not ship. */}
              <Carousel cells={cells} current={current} ghost={g.id} viewH={720} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{g.claim}</p>
            <button
              type="button"
              onClick={() => setGhost(g.id)}
              className={`mt-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] focus-visible:border-command-gold focus-visible:outline-none ${
                ghost === g.id
                  ? "border-command-gold text-command-gold"
                  : "border-panel-border text-muted hover:border-gold-light hover:text-gold-light"
              }`}
            >
              {ghost === g.id ? "picked" : "pick"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
