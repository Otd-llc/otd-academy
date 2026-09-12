"use client";

// SANDBOX — the comb on the real page, at three form factors, on one screen.
//
// Each frame is a real iframe at a real device size, loading the same route the
// browser would. That is the whole point: `max-w-6xl`, `px-4 sm:px-6` and the
// `-mx-4 sm:mx-0` edge bleed are VIEWPORT media queries, so three copies rendered
// inside one window would all resolve at the window's width and the phone column
// would quietly draw the desktop layout.
//
// The zoom control scales the PICTURE, never the layout: the iframe keeps its true
// pixel width and only its rendered image is transformed, so every breakpoint and
// every container query still fires where the device fires it. At 100% the row
// scrolls sideways; at fit it does not.

import { useEffect, useRef, useState } from "react";
import { SANDBOX_CSS } from "../styles";

const DEVICES = [
  { id: "Desktop", w: 1440, h: 900, note: "A 1440 window. The column caps at max-w-6xl (1152px)." },
  { id: "Tablet", w: 834, h: 1112, note: "Portrait tablet. Still past the sm breakpoint, so the comb keeps its column gutters." },
  { id: "Phone", w: 390, h: 844, note: "Below sm: the wrapper's -mx-4 cancels the page gutter and the comb bleeds edge to edge." },
];

const GAP = 24;

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
  const id = `cv-${label.replace(/\s+/g, "-").toLowerCase()}`;
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
        className="cv-slider"
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

export function SiteRound() {
  const [comb, setComb] = useState<"guide" | "courses">("guide");
  const [shape, setShape] = useState<"ribbon" | "grid">("ribbon");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [cap, setCap] = useState<"shipped" | "none">("shipped");
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
  const [stroke, setStroke] = useState(0.6);
  const [alpha, setAlpha] = useState(14);
  const [avail, setAvail] = useState(1400);
  const frames = useRef<Record<string, HTMLIFrameElement | null>>({});

  // The sliders drive the frames by postMessage, not by the src. Changing an iframe's
  // src reloads it, so a drag would tear down and re-mount three combs per frame of
  // the drag; the message channel leaves the documents standing. The src still carries
  // the values so a frame that reloads comes back where the sliders are.
  useEffect(() => {
    for (const el of Object.values(frames.current)) {
      el?.contentWindow?.postMessage(
        { cvStroke: stroke, cvAlpha: alpha },
        window.location.origin,
      );
    }
  }, [stroke, alpha]);

  // The round's own document has to follow the switch too, or the frames and the page
  // around them disagree. And the attribute is SET, never removed: `layout.tsx`
  // resolves the theme from a cookie, then localStorage, then
  // `prefers-color-scheme`, so an unset attribute is not "dark", it is "whatever the
  // OS says". A headless browser reports light, which is how this page first rendered
  // ivory around three dark frames.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme);
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, [theme]);

  useEffect(() => {
    const set = () => setAvail(Math.max(600, window.innerWidth - 64));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  // One scale for all three, so their relative sizes stay honest. Scaling each to its
  // own column would make a phone and a desktop look the same size, which is the one
  // comparison this page exists to make.
  const totalW = DEVICES.reduce((a, d) => a + d.w, 0) + GAP * (DEVICES.length - 1);
  const k = zoom === "full" ? 1 : Math.min(1, avail / totalW);
  const src = (extra: string) =>
    `/sandbox/comb/site/frame?comb=${comb}&shape=${shape}&theme=${theme}&cap=${cap}` +
    `&sw=${stroke}&na=${alpha}${extra}`;

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-10 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: SANDBOX_CSS }} />
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ SANDBOX · the comb, on the page
      </p>
      <h1 className="title-section mt-3">Three form factors, one screen</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The vertical comb inside the shell it will really live in: the same
        max-w-6xl column, the same PageHeader, the same edge bleed below the small
        breakpoint. Each frame is a real browser viewport at a real device size, so the
        breakpoints fire where the device fires them rather than where this page
        happens to be wide.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The detail line is gone. The face was already carrying an ordinal watermark, a
        board, a title, a lead and a chip, and a fifth thing is what tipped it from
        dense to unreadable.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The watermark is the real reason the type was hard to read, and it is also why
        my first contrast measurement was worthless. That measurement sampled the ink
        against the FACE FILL, which is not what sits behind the glyphs: the ordinal
        does, and its gradient runs from transparent at the top of the face to full
        strength at the BOTTOM, which is exactly where the title, the lead and the chip
        live. The loudest part of a decorative watermark was directly under the only
        type on the cell. Both sliders below are live, and the measurement underneath
        them now samples the COMPOSITED backdrop with the type hidden.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The cell cap is worth a look too. The shipped comb caps a cell at 360px, and it
        barely bites there because a 3-up grid already lands near it. A single-file
        spine divides the same column by 1.5, so with the cap lifted one hex solves to
        768px and fills a desktop viewport by itself.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-panel-border/60 pt-5">
        <Switch
          label="Page"
          value={comb}
          onChange={setComb}
          opts={[
            ["guide", "Build guide"],
            ["courses", "Courses"],
          ]}
        />
        <Switch
          label="Shape"
          value={shape}
          onChange={setShape}
          opts={[
            ["ribbon", "Spine"],
            ["grid", "2-up"],
          ]}
        />
        <Switch
          label="Cell cap"
          value={cap}
          onChange={setCap}
          opts={[
            ["shipped", "360px (shipped)"],
            ["none", "No cap"],
          ]}
        />
        <Switch
          label="Zoom"
          value={zoom}
          onChange={setZoom}
          opts={[
            ["fit", `Fit · ${Math.round(k * 100)}%`],
            ["full", "100%"],
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

      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
        <Slider
          label="Line weight"
          value={stroke}
          min={0.15}
          max={2}
          step={0.05}
          onChange={setStroke}
          format={(v) => `${v.toFixed(2)}x`}
        />
        <Slider
          label="Watermark"
          value={alpha}
          min={0}
          max={40}
          step={1}
          onChange={setAlpha}
          format={(v) => `${v}%`}
        />
        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-muted">
          1.00x is the lesson comb&rsquo;s own ratio · 32% is the shipped watermark
        </p>
      </div>

      <div className={`mt-10 flex items-start ${zoom === "full" ? "overflow-x-auto" : ""}`} style={{ gap: GAP * k }}>
        {DEVICES.map((d) => (
          <section key={d.id} style={{ width: d.w * k, flex: "0 0 auto" }}>
            <div className="flex items-baseline gap-3">
              <span className="title-card">{d.id}</span>
              <span className="font-numeral text-base tabular-nums text-command-gold">
                {d.w} &times; {d.h}
              </span>
            </div>
            <p className="mb-3 mt-1 font-serif text-sm text-muted">{d.note}</p>
            {/* The wrapper is the scaled box; the iframe inside keeps its true pixel
                size and is only transformed, so nothing about the layout moves. */}
            <div
              className="border border-panel-border/60"
              style={{ width: d.w * k, height: d.h * k, overflow: "hidden" }}
            >
              <iframe
                title={`${d.id} preview`}
                ref={(el) => {
                  frames.current[d.id] = el;
                }}
                src={src(`&d=${d.id}`)}
                style={{
                  width: d.w,
                  height: d.h,
                  border: 0,
                  transform: `scale(${k})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
