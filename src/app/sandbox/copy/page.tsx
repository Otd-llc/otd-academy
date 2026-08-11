// SANDBOX — the kinetic COPY, on the real frames, in the real type. DEV ONLY.
//
// Picking words from a list is not the same as seeing them burned over the
// picture at the size they will actually be, which is why this renders each set
// over the frame it belongs to.
//
// THE TYPE RULES ARE THE HOUSE ONES, not invented here:
//   - Bebas for the display word, Space Mono for the label. No third face.
//   - SIZED OFF THE SHORT AXIS, never the width. The hex cuts learned this the
//     hard way: scaling by width is right for portrait and square and wrong for
//     16:9 by 1.78x, which put 217 px words where 122 px were wanted. The
//     measured ratios are word 52/460, big 66/460, url 11/460 of the short axis.
//   - Gold for the accent, ivory for the word, muted mono beneath.
//
// AND THE GRID: 120 BPM, beat 0.5 s, bar 2 s. Every cue lands on a bar downbeat,
// because the cut will be scored with drums and a cue that floats between beats
// reads as a mistake once there is a kick under it.
import { notFound } from "next/navigation";
import { highlightTitle } from "@/components/PageHeader";

const SHORT = 720; // the 16:9 frame's short axis, in px
const px = (ratio: number) => Math.round(ratio * SHORT);
const SIZE = { word: px(52 / 460), big: px(66 / 460), url: px(11 / 460) };

type Beat = {
  frame: string;
  bar: string;
  cue: "PRINT" | "SNAP" | "GROW" | "FREE" | "·";
  /** Gold mono eyebrow, the `.ord` slot. */
  eyebrow?: string;
  /** Bebas line. highlightTitle alternates ivory to gold across content words. */
  title?: string;
  label?: string;
  numeral?: string;
};

type CopySet = { id: string; voice: string; beats: Beat[] };

/** Five beats of the cut: object, anatomy, the click, the pass, the proof.
 *
 *  Titles are written FOR the alternation. `highlightTitle` golds every second
 *  CONTENT word and skips function words, so "Build it for real" lands gold on
 *  "real" and "Eight sheets" lands it on "sheets". Picking the gold word by
 *  hand is what the helper exists to prevent. */
const SETS: CopySet[] = [
  {
    id: "A · PLAIN",
    voice: "States what it is. Claims nothing the picture does not already make.",
    beats: [
      { frame: "board", bar: "BAR 1 · 0.0", cue: "PRINT", eyebrow: "L1.01", title: "You draw it", label: "ESP32-S3 USB-C breakout" },
      { frame: "stack", bar: "BAR 3 · 4.0", cue: "SNAP", eyebrow: "FOUR LAYER", title: "Eight sheets", label: "Silk · mask · copper · copper · mask · silk" },
      { frame: "click", bar: "BAR 5 · 8.0", cue: "·", label: "Question 18 of 18" },
      { frame: "fanfare", bar: "BAR 6 · 10.0", cue: "GROW", numeral: "18/18", label: "Final exam · passed" },
      { frame: "cert", bar: "BAR 7 · 12.0", cue: "FREE", eyebrow: "OPEN BETA", title: "Free in beta", label: "academy.onethousanddrones.com/beta" },
    ],
  },
  {
    id: "B · THE CLAIM",
    voice: "Leads on the thing nobody else does. Riskier, more memorable.",
    beats: [
      { frame: "board", bar: "BAR 1 · 0.0", cue: "PRINT", eyebrow: "L1.01", title: "Not a kit", label: "You draw every part of it" },
      { frame: "stack", bar: "BAR 3 · 4.0", cue: "SNAP", eyebrow: "FOUR LAYER", title: "See the stack", label: "Vendors show renders" },
      { frame: "click", bar: "BAR 5 · 8.0", cue: "·", label: "Last question" },
      { frame: "fanfare", bar: "BAR 6 · 10.0", cue: "GROW", numeral: "18/18", label: "Gated, not participation" },
      { frame: "cert", bar: "BAR 7 · 12.0", cue: "FREE", eyebrow: "OPEN BETA", title: "Build it for real", label: "academy.onethousanddrones.com/beta" },
    ],
  },
  {
    id: "C · INSTRUMENT",
    voice: "Numerals only. Most on-brand, least explanatory.",
    beats: [
      { frame: "board", bar: "BAR 1 · 0.0", cue: "PRINT", numeral: "30 × 62", label: "millimetres · four layer" },
      { frame: "stack", bar: "BAR 3 · 4.0", cue: "SNAP", numeral: "8", label: "sheets, pressed together" },
      { frame: "click", bar: "BAR 5 · 8.0", cue: "·", numeral: "18", label: "questions, all gated" },
      { frame: "fanfare", bar: "BAR 6 · 10.0", cue: "GROW", numeral: "18/18", label: "passed" },
      { frame: "cert", bar: "BAR 7 · 12.0", cue: "FREE", numeral: "0", label: "cost, while it is in beta" },
    ],
  },
  {
    id: "D · THE ASK",
    voice: "Beta-first. The only set that says what we actually want back.",
    beats: [
      { frame: "board", bar: "BAR 1 · 0.0", cue: "PRINT", eyebrow: "L1.01", title: "Draw a real board", label: "Requirements to bring-up" },
      { frame: "stack", bar: "BAR 3 · 4.0", cue: "SNAP", eyebrow: "FOUR LAYER", title: "Eight sheets", label: "This is what a board is" },
      { frame: "click", bar: "BAR 5 · 8.0", cue: "·", label: "Eighteen questions, gated" },
      { frame: "fanfare", bar: "BAR 6 · 10.0", cue: "GROW", numeral: "18/18", label: "And a certificate that verifies" },
      { frame: "cert", bar: "BAR 7 · 12.0", cue: "FREE", eyebrow: "OPEN BETA", title: "Break it for us", label: "Free · academy.onethousanddrones.com/beta" },
    ],
  },
];

function Overlay({ beat }: { beat: Beat }) {
  // THE HOUSE RECIPES, not re-rolled inline type.
  //
  // The first pass set `font-display` with a 0.6px stroke and default leading,
  // which threw away the three things that make a bench hero look like one:
  // `-webkit-text-stroke: 0.04em` (about 3.2 px at this size, the
  // capability-brief "fatness"), `line-height: 0.82`, and `paint-order: stroke
  // fill`. It also skipped the `.ord` eyebrow, the hollow `.tdot` period, and
  // `.meta-strip`, and hand-picked which word went gold instead of using
  // `highlightTitle`, which alternates ivory to gold across CONTENT words and
  // cannot be mis-coloured.
  //
  // Only the SIZE is overridden here, because a video frame is not a page.
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
      {/* Gold hairline, then the block. Grouping is by rule, never a filled
          box, even over picture. */}
      <div className="mx-10 mb-6 border-t border-command-gold/55 pt-5">
        {beat.numeral ? (
          <>
            <p
              className="font-numeral leading-none tracking-wide tabular-nums text-command-gold"
              style={{ fontSize: SIZE.big }}
            >
              {beat.numeral}
            </p>
            {beat.label ? (
              <p className="meta-strip mt-3">
                <span>{beat.label}</span>
              </p>
            ) : null}
          </>
        ) : beat.title ? (
          <>
            <h2 className="bench-hero" style={{ fontSize: SIZE.word }}>
              {beat.eyebrow ? <span className="ord">{beat.eyebrow}</span> : null}
              <span>
                {highlightTitle(beat.title ?? "")}
                <span className="tdot">.</span>
              </span>
            </h2>
            {beat.label ? (
              <p className="meta-strip mt-4">
                <span>{beat.label}</span>
              </p>
            ) : null}
          </>
        ) : (
          // Label only: the picture is carrying this beat.
          <p className="meta-strip">
            <span>{beat.label}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function CopySandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Kinetic copy · four sets, on the real frames
      </p>
      <h1 className="title-section mt-3">Pick the words</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Type sized off the SHORT AXIS at the house ratios (word 52/460, numeral
        66/460, label 11/460), Bebas and Space Mono only, gold as the single
        accent. Every cue sits on a bar downbeat at 120 BPM, because it is being
        scored with drums and a cue that floats between beats reads as a mistake
        once there is a kick under it.
      </p>

      {SETS.map((set) => (
        <section key={set.id} className="mt-16">
          <div className="border-t border-signal-blue/30 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
              {set.id}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {set.voice}
            </p>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {set.beats.map((beat) => (
              <figure key={beat.frame} className="m-0">
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local capture plate */}
                  <img
                    src={`/_capture/copy/${beat.frame}.jpg`}
                    alt=""
                    width={1280}
                    height={720}
                    className="block w-full"
                  />
                  <Overlay beat={beat} />
                </div>
                <figcaption className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                  <span>{beat.bar}</span>
                  <span className="text-command-gold">{beat.cue}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-20 border-t border-panel-border/60 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ The cut, on the grid
        </p>
        <ul className="mt-4 border-t border-panel-border/60">
          {[
            ["Bars 1–2", "0.0 – 4.0", "Board turntable", "The object you end up with"],
            ["Bars 3–4", "4.0 – 8.0", "Gerber explode", "What a board actually is"],
            ["Bar 5", "8.0 – 10.0", "The click", "Question 18, the cursor, the answer locks"],
            ["Bar 6", "10.0 – 12.0", "The fanfare", "The academy's own celebration, on the downbeat"],
            ["Bars 7–8", "12.0 – 16.0", "Certificate", "Spins in, settles, holds"],
          ].map(([bar, time, what, why]) => (
            <li key={bar} className="flex flex-wrap items-baseline gap-4 border-b border-panel-border/60 py-3">
              <span className="w-24 font-mono text-[10px] uppercase tracking-[0.18em] text-command-gold">{bar}</span>
              <span className="w-28 font-numeral tabular-nums text-sm text-text">{time}</span>
              <span className="w-40 text-sm text-text">{what}</span>
              <span className="flex-1 text-sm text-muted">{why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          16 s · 8 bars at 120 BPM · loop re-enters on the certificate, so the
          second pass opens on the payoff
        </p>
      </section>
    </main>
  );
}
