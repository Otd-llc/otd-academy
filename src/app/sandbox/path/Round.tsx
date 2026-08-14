"use client";

// SANDBOX — the /courses "go further" comb, restyled toward the lesson-top ribbon.
//
// The body of /courses is now a vertical spine of one-point hexes. The comb at the
// foot of the page is still the old thing: a 4-up tessellated grid under the
// three-point camera, with a filled card's worth of content in each cell. So the page
// currently carries two hex languages, and this round picks the one the foot speaks.
//
// The reference is the lesson-top ribbon: flat-top hexes laced edge to edge, a thin
// outline, a big Saira figure with a wide-tracked mono label under it, and a prism
// that converges on the centre of the run.
//
// Every variant draws its prisms with `SpineCombScene`, the component the body combs
// now ship, so the silhouette, the cell-relative stroke and the token colours are
// already settled and are NOT what is being chosen here. What is: the lacing, and how
// much a cell says.

import { useEffect, useState } from "react";
import { PathStage, type PathVariant } from "./PathStage";
import { OTHERS_FROM_EEG, OTHERS_FROM_SWARM } from "./fixtures";
import { PATH_SANDBOX_CSS } from "./styles";

/** The lesson ribbon's own prism, as a far-end cast in cell widths. Same number the
 *  spine ships with, so the two combs on the page are lit the same way. */
const LESSON_CAST = 0.23;

const VARIANTS: PathVariant[] = [
  {
    id: "G1",
    label: "The ribbon, literally",
    note: "The lesson comb's exact lacing and its exact pairing: flat-top hexes laced edge to edge, a big Saira code, a wide-tracked mono label under it. The destinations' real names cannot fit in a hex this size, so they move to a caption row underneath. Whether that trade is acceptable is the question this option asks.",
    shape: "laced",
    content: "code",
    tracked: false,
    maxCell: 200,
    castFar: LESSON_CAST,
  },
  {
    id: "G2",
    label: "Laced, named",
    note: "The same lacing, but the cell keeps the destination's real name in Bebas and drops everything else. Nothing has to move to a caption, and the comb still reads as one continuous run rather than four cards.",
    shape: "laced",
    content: "name",
    tracked: false,
    maxCell: 260,
    castFar: LESSON_CAST,
  },
  {
    id: "G3",
    label: "Laced, name over a mark",
    note: "The name over its code as a watermark, plus the count chip. The watermark is the same device the body combs use for their ordinal, at the same 14% the contrast measurement landed on, so the foot of the page echoes the top of it.",
    shape: "laced",
    content: "name-mark",
    tracked: false,
    maxCell: 300,
    castFar: LESSON_CAST,
  },
  {
    id: "G4",
    label: "Laced, tracked",
    note: "G3's content with today's information kept: each hex stroked in its track accent, the flagship in gold. This is the one that preserves what the current comb tells you at a glance; the others trade that for quiet.",
    shape: "laced",
    content: "name-mark",
    tracked: true,
    maxCell: 300,
    castFar: LESSON_CAST,
  },
  {
    id: "G5",
    label: "Laced, full card",
    note: "The lacing with all of today's content: eyebrow, name, chip. It needs the largest cell of the set to hold three things, which is the cost of changing nothing but the layout.",
    shape: "laced",
    content: "full",
    tracked: true,
    maxCell: null,
    castFar: LESSON_CAST,
  },
  {
    id: "G6",
    label: "Pointy-top row",
    note: "Not the lesson ribbon: the SPINE's hex, turned into a straight horizontal run on shared vertical edges. One hex orientation for the whole page instead of two. The run does not zig-zag, so it reads flatter and takes more width for the same four cells.",
    shape: "row",
    content: "name-mark",
    tracked: true,
    maxCell: 300,
    castFar: LESSON_CAST,
  },
];

const WIDTHS = [
  { id: "Column", w: 1104, note: "The max-w-6xl column at desktop, inside its gutters." },
  { id: "Tablet", w: 704, note: "Portrait tablet." },
  { id: "Phone", w: 390, note: "Below sm, where the comb bleeds to the screen edge." },
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

export function PathRound() {
  const [viewing, setViewing] = useState<"eeg" | "swarm">("eeg");
  const [width, setWidth] = useState<string>("Column");
  const [signedIn, setSignedIn] = useState<"out" | "in">("out");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Set, never removed: `layout.tsx` resolves an unset theme from a cookie, then
  // localStorage, then `prefers-color-scheme`, so removing the attribute means "ask
  // the OS", not "dark".
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
      <style dangerouslySetInnerHTML={{ __html: PATH_SANDBOX_CSS }} />

      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ SANDBOX · go further
      </p>
      <h1 className="title-section mt-3">The comb at the foot of the page</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The body of /courses now runs as a vertical spine of one-point hexes. The
        destinations comb underneath it did not move, so the page currently speaks two
        hex languages: a laced, thin-outlined, one-point run at the top and a 4-up
        tessellated grid of filled cards at the bottom. These six cuts bring the foot
        toward the lesson-top ribbon.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The prisms are already settled: every variant draws through the same scene the
        body combs ship, so the silhouette, the cell-relative stroke weight and the
        token colours are fixed. What is open is the LACING and how much a cell says. A
        destination has a real name, a track and a course count, and the lesson ribbon
        cell holds a two-digit figure and three letters, so something has to give.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        One thing worth fixing whichever wins: the shipped comb feeds its track accent
        from a map of literal hex values, so that accent is the one colour on /courses
        that cannot flip under the light token block. Every variant here resolves
        through tokens instead, which is what makes the theme toggle on this page mean
        something.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-panel-border/60 pt-5">
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
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {frame.note}
      </p>

      <div className="mt-12 space-y-16">
        {VARIANTS.map((v) => (
          <section key={v.id}>
            <div className="flex items-baseline gap-3">
              <span className="font-numeral text-2xl tabular-nums text-command-gold">
                {v.id}
              </span>
              <span className="title-card">{v.label}</span>
            </div>
            <p className="mb-5 mt-1 max-w-3xl font-serif text-sm text-muted">{v.note}</p>
            <div className="border-t border-panel-border/60 pt-8">
              <PathStage
                variant={v}
                paths={paths}
                width={frame.w}
                signedIn={signedIn === "in"}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
