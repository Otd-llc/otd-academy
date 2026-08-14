"use client";

// SANDBOX round — the build-guide comb and the /courses comb, turned vertical and
// re-cut in the lesson ribbon's ONE-POINT perspective.
//
// Four global switches, because the picks are not independent: a projection that
// reads well at 8 cells can die at 16, a cut that sings on deep space can die on
// ivory, and "dynamically sized" means nothing until you say what it is sized
// AGAINST. So the same seven variants redraw under every combination rather than the
// round shipping seven frozen screenshots.

import { useEffect, useState } from "react";
import { CombStage, type CombId, type FitMode, type Variant } from "./CombStage";
import { SANDBOX_CSS } from "./styles";

// The lesson ribbon's own prism, restated as a far-end cast in cell widths (see
// `OnePointCam.castFar`): focal 900 over depth 70 is a far face 92.8% of the near
// one, and the farthest corner of an 8-hex run sits 3.13 cells from the centre
// vanishing point, so the cast there is 0.23 of a cell. Stating it this way is what
// keeps the seven cuts comparable: a fixed focal draws a hairline on the 8-cell comb
// and a wedge on the 16-cell one, and moving the vanishing point outside the comb
// blows both up again.
const LESSON_CAST = 0.23;
const DEEP_CAST = 0.55;

const VARIANTS: Variant[] = [
  {
    id: "V0",
    label: "Control · today's comb",
    note: "The shipped three-point camera (S5) on a portrait 2-up grid. Faces foreshorten, so every cell's content is billboarded and scaled to its face. This is the baseline the six below are judged against.",
    layout: { family: "grid", perRow: 2 },
    cam: null,
  },
  {
    id: "V1",
    label: "Spine · lesson prism",
    note: "The lesson ribbon's lacing turned ninety degrees: single file, each hex sharing a face with the next. One-point, vanishing point at the comb's centre, and the lesson comb's own prism. Cells above the centre cast down, cells below cast up, so the run converges on its own middle.",
    layout: { family: "ribbon" },
    cam: { castFar: LESSON_CAST, vp: [0.5, 0.5] },
  },
  {
    id: "V2",
    label: "Spine · deep prism",
    note: "V1 with the slab two and a half times thicker. Same geometry; what changes is how much of it you can see, which is the one knob the lesson comb never had to push because its hexes are small and yours will not be.",
    layout: { family: "ribbon" },
    cam: { castFar: DEEP_CAST, vp: [0.5, 0.5] },
  },
  {
    id: "V3",
    label: "Spine · one recession, downward",
    note: "The vanishing point dropped below the foot of the run, so every prism casts DOWN toward the same point instead of the column folding inward on its middle. One direction for the whole spine, and the slab grows as you descend.",
    layout: { family: "ribbon" },
    cam: { castFar: DEEP_CAST, vp: [0.5, 1.35] },
  },
  {
    id: "V4",
    label: "Grid 2-up · lesson prism",
    note: "The shipped tessellation kept, the camera swapped: two across, many rows, one-point. Faces stay parallel to the page, so nothing foreshortens and every cell's title, chip and tap target is exactly the size the layout says.",
    layout: { family: "grid", perRow: 2 },
    cam: { castFar: LESSON_CAST, vp: [0.5, 0.5] },
  },
  {
    id: "V5",
    label: "Grid 2-up · deep prism",
    note: "V4 with the thicker slab. On a grid the casts have neighbours to land on, so depth costs more here than it does on the single-file spine.",
    layout: { family: "grid", perRow: 2 },
    cam: { castFar: DEEP_CAST, vp: [0.5, 0.5] },
  },
  {
    id: "V6",
    label: "Grid 2-up · one recession, downward",
    note: "V4 with the vanishing point dropped below the comb. Every prism casts down the page, so the grid reads as a wall receding from you rather than a sheet converging on itself.",
    layout: { family: "grid", perRow: 2 },
    cam: { castFar: DEEP_CAST, vp: [0.5, 1.35] },
  },
];

type TypeMode = "capped" | "fill";

function Switch<T extends string>({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  opts: [T, string][];
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
        {label}
      </span>
      <div className="flex gap-2">
        {opts.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] focus-visible:border-command-gold focus-visible:outline-none ${
              value === v
                ? "border-command-gold text-command-gold"
                : "border-panel-border/60 text-muted hover:text-text"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CombRound() {
  const [comb, setComb] = useState<CombId>("guide");
  const [fit, setFit] = useState<FitMode>("box");
  const [type, setType] = useState<TypeMode>("fill");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [stageH, setStageH] = useState(560);

  // The theme toggle drives the real `[data-theme]` attribute the token block hangs
  // off, so a variant that hardcodes a colour fails to flip here in exactly the way
  // it would fail in production. Restored on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, [theme]);

  // The box each comb is judged inside. Tied to the viewport, because "take up the
  // space" is a claim about the screen, not about a number I picked.
  useEffect(() => {
    const set = () => setStageH(Math.max(420, Math.round(window.innerHeight * 0.72)));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: SANDBOX_CSS }} />

      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ SANDBOX · vertical combs
      </p>
      <h1 className="title-section mt-3">The combs, turned upright</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The build-guide hub and the /courses skill tree ship as a wide tessellated
        grid under a three-point camera, where every face foreshortens and every
        cell&rsquo;s content has to be billboarded onto it. These seven cuts run them
        vertically instead, in the one-point projection the lesson-top ribbon uses:
        the hex faces stay parallel to the page, so nothing foreshortens and only the
        prism depth converges, on a single vanishing point.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        That is the whole reason the projection is worth carrying over. On an
        unforeshortened face a cell&rsquo;s title, chip and tap target are exactly the
        size the layout says they are, so the cells can be grown to fill the space
        without the content drifting out of its trapezoid.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        One thing the fill switch settles rather than argues about: a vertical comb in
        a landscape viewport is bound by HEIGHT, not width. Fit the box and a
        sixteen-course spine solves to a cell barely a hundred pixels across while
        most of the column sits empty; the two-across grid halves the row count and
        doubles the cell for the same screen. If the combs are to be both vertical and
        large, either the run gets a scroll or it gets a second column.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-panel-border/60 pt-5">
        <Switch
          label="Comb"
          value={comb}
          onChange={setComb}
          opts={[
            ["guide", "Build guide · 8"],
            ["courses", "Courses · 16"],
          ]}
        />
        <Switch
          label="Fill"
          value={fit}
          onChange={setFit}
          opts={[
            ["box", "Fit the box"],
            ["width", "Fill width"],
          ]}
        />
        <Switch
          label="Type"
          value={type}
          onChange={setType}
          opts={[
            ["fill", "Grows with hex"],
            ["capped", "Shipped caps"],
          ]}
        />
        <Switch
          label="Theme"
          value={theme}
          onChange={setTheme}
          opts={[
            ["dark", "Dark"],
            ["light", "Light"],
          ]}
        />
      </div>

      <p className="mt-4 max-w-3xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-muted">
        Fit the box solves the cell width against the height too, so the whole comb
        lands inside one screen · Fill width is the shipped rule and scrolls · Grows
        with hex drops the 32px / 15px / 10px ceilings the shipped type carries
      </p>

      <div className={`mt-10 grid gap-x-8 gap-y-12 lg:grid-cols-2 ${type === "fill" ? "cv-fill" : ""}`}>
        {VARIANTS.map((v) => (
          <section key={v.id}>
            <div className="flex items-baseline gap-3">
              <span className="font-numeral text-2xl tabular-nums text-command-gold">
                {v.id}
              </span>
              <span className="title-card">{v.label}</span>
            </div>
            <p className="mb-3 mt-1 font-serif text-sm text-muted">{v.note}</p>
            <CombStage
              variant={v}
              comb={comb}
              fit={fit}
              stageH={stageH}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
