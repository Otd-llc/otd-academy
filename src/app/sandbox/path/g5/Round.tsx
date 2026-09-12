"use client";

// SANDBOX — G5 convergence: the laced full card, six ways.
//
// Round two picked the LACING. This one picks the dressing, and it does not invent it:
// every treatment is a device the house already ships, mostly on /hex and the hex
// configurator, so the foot of /courses ends up speaking the same dialect as the
// pages either side of it rather than a sixth one of its own.

import { useEffect, useState } from "react";
import { G5Stage, type G5Variant, type PrismMode } from "./G5Stage";
import { OTHERS_FROM_EEG, OTHERS_FROM_SWARM } from "../fixtures";
import { G5_CSS } from "./styles";

const VARIANTS: G5Variant[] = [
  {
    id: "G5a",
    label: "Leader dots",
    source: "/hex · SpecRows (R3)",
    note: "The count as a spec row: a mono label, a dotted rule carrying the eye across, and the figure in Saira. It says the same thing the chip did but as a MEASUREMENT rather than a tag, which is the register the rest of the site reads a number in.",
    treatment: "spec",
    tracked: true,
  },
  {
    id: "G5b",
    label: "Dimension line",
    source: "/hex · the cell-pitch caliper (P4)",
    note: "A caliper rule over the figure, so the number annotates a measurement instead of captioning a card. The strongest reading of 'four courses' as a quantity, and the one that most obviously belongs to this house.",
    treatment: "caliper",
    tracked: true,
  },
  {
    id: "G5c",
    label: "Corner ticks",
    source: "/hex · Frame (F5b)",
    note: "Four bordered corners bracketing the stack, the same device that frames the cluster graphic. It gives the content a boundary without giving it a box, which is the whole trick the hairline system is built on.",
    treatment: "ticks",
    tracked: true,
  },
  {
    id: "G5d",
    label: "Document band",
    source: "/hex · the border-y release band",
    note: "The name held between two accent hairlines, eyebrow above and count below. The most typographic of the six and the quietest; it reads as a line item in a register.",
    treatment: "band",
    tracked: true,
  },
  {
    id: "G5e",
    label: "Numeral readout",
    source: "the frontend-design signature readout",
    note: "The count leads, in Saira gold at instrument scale, with the destination's name as its label. It inverts the hierarchy: the comb becomes a set of quantities you can compare rather than a set of names you read.",
    treatment: "readout",
    tracked: true,
  },
  {
    id: "G5f",
    label: "Accent bar",
    source: "the configurator's floating label",
    note: "A gold rule down the left of the stack, ranged left against it. The configurator uses exactly this to float a label over the canvas without a card. It is the only one of the six that abandons the centred axis, which either reads as deliberate or as broken alignment inside a symmetric hex.",
    treatment: "bar",
    tracked: true,
  },
];

const WIDTHS = [
  { id: "Column", w: 1104, note: "The max-w-6xl column at desktop, inside its gutters. Cells solve to about 340px." },
  { id: "Tablet", w: 704, note: "Portrait tablet. About 216px a cell." },
  { id: "Phone", w: 390, note: "Below sm. About 120px a cell, which is where a three-part stack starts to fail." },
];

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
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{label}</span>
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

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = `g5-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type="range"
        className="g5-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 font-numeral text-sm tabular-nums text-command-gold">
        {format(value)}
      </span>
    </div>
  );
}

export function G5Round() {
  const [viewing, setViewing] = useState<"eeg" | "swarm">("eeg");
  const [width, setWidth] = useState<string>("Column");
  const [signedIn, setSignedIn] = useState<"out" | "in">("out");
  const [tracked, setTracked] = useState<"track" | "gold">("track");
  const [prism, setPrism] = useState<PrismMode>("below");
  // Owner pick, 2026-08-13.
  const [depth, setDepth] = useState(0.15);
  const [show, setShow] = useState<"pick" | "all">("pick");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Set, never removed: layout.tsx resolves an unset theme from cookie, then
  // localStorage, then prefers-color-scheme, so removing it means "ask the OS".
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, [theme]);

  const paths = viewing === "eeg" ? OTHERS_FROM_EEG : OTHERS_FROM_SWARM;
  const frame = WIDTHS.find((f) => f.id === width) ?? WIDTHS[0]!;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: G5_CSS }} />

      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ SANDBOX · G5 convergence
      </p>
      <h1 className="title-section mt-3">The document band, shallower</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        G5d is the pick: the destination&rsquo;s name held between two accent hairlines,
        the track above it and the count below, which is the /hex release band applied
        to a hex. The lacing and the treatment are both settled now, so the one thing
        left open here is DEPTH, and it is a slider rather than three frozen steps
        because it is a single number and worth dialling against real type.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Direction still matters, and not for taste. The vertical spine casts its prisms
        toward the centre of its run and they read as solids, because its cells touch
        only at a seam. Laced hexes overlap by a quarter of their width, so a
        centre-converging cast lands under its neighbour, the face mask removes it, and
        a hairline is left where a slab should be. Casting below the run sends every
        one the same way, clear of the neighbours. The other five variants are still
        behind the Show switch.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Two house rules the SHIPPED comb currently breaks, and none of these do. Its
        chip is a 999px pill, which the corner language bans outright. Its hover title
        is a literal white, which cannot flip under the light token block, and it feeds
        its track accent from a map of raw hex values, which cannot either. Flip the
        theme and the accents here move; on the live page they would not.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-panel-border/60 pt-5">
        <Switch
          label="Show"
          value={show}
          onChange={setShow}
          opts={[
            ["pick", "G5d only"],
            ["all", "All six"],
          ]}
        />
        <Switch
          label="Viewing"
          value={viewing}
          onChange={setViewing}
          opts={[
            ["eeg", "The EEG · 4 others"],
            ["swarm", "A mastery path · flagship returns"],
          ]}
        />
        <Switch
          label="Width"
          value={width}
          onChange={setWidth}
          opts={WIDTHS.map((f) => [f.id, `${f.id} · ${f.w}`] as [string, string])}
        />
        <Switch
          label="Accent"
          value={tracked}
          onChange={setTracked}
          opts={[
            ["track", "By track"],
            ["gold", "Gold only"],
          ]}
        />
        <Switch
          label="Prism"
          value={prism}
          onChange={setPrism}
          opts={[
            ["below", "Cast below"],
            ["centre", "Toward centre"],
          ]}
        />
        <Switch
          label="Viewer"
          value={signedIn}
          onChange={setSignedIn}
          opts={[
            ["out", "Signed out"],
            ["in", "Signed in"],
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
      <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-4">
        <Slider
          label="Prism depth"
          value={depth}
          min={0}
          max={0.3}
          step={0.005}
          onChange={setDepth}
          format={(v) => v.toFixed(3)}
        />
        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-muted">
          Cast at the far cell, in cell widths · 0.150 is the pick · 0.230 is the lesson
          comb&rsquo;s own · 0 is no prism at all
        </p>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {frame.note}
      </p>

      <div className="mt-12 space-y-16">
        {VARIANTS.filter((v) => show === "all" || v.id === "G5d").map((v) => (
          <section key={v.id}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-numeral text-2xl tabular-nums text-command-gold">
                {v.id}
              </span>
              <span className="title-card">{v.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {v.source}
              </span>
            </div>
            <p className="mb-5 mt-1 max-w-3xl font-serif text-sm text-muted">{v.note}</p>
            <div className="border-t border-panel-border/60 pt-8">
              <G5Stage
                variant={{ ...v, tracked: tracked === "track" }}
                paths={paths}
                width={frame.w}
                signedIn={signedIn === "in"}
                prism={prism}
                depth={depth}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
