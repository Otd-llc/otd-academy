"use client";

// SANDBOX - the type over the logbook cut. DEV ONLY.
//
// Term-and-line by default; the quiet round runs it `bare`, which is the word
// and the payoff and nothing else.
//
// THE ENTRANCE IS A TUNING AXIS NOW, not a constant. The five kinetics live in
// tuning.ts and four of them are PORTED from cue-layer.ts rather than invented:
// those were judged in a preview and then rendered, and rebuilding them from
// the same intent is how you ship something adjacent to what was signed off.
//
// A KINETIC THAT HAS TO LAND ON THE BEAT MUST START BEFORE IT. `snap` is two
// halves meeting and `mask` is a rise out of the baseline; both read as arriving
// late if they begin on the downbeat. So the word MOUNTS at `at - lead`, and
// `data-anim-at` carries the same number, which is what the stage pins against.
//
// NOTHING HERE TRANSITIONS. Opacity and position are computed from scene time;
// entrances are keyframes, which seek. A transition does not.
//
// ASCII only.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE } from "../capture/cut/cue-layer";
import { BEATS, LABEL, PAYOFF, type Arrangement, type Beat } from "./beats";
import {
  isPerChar,
  kineticCss,
  kineticLead,
  outStyle,
  wordBox,
  type Kinetic,
  type KineticOut,
  type WordPos,
} from "./tuning";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** The word, built the way its entrance needs it: one run, per character, or
 *  twice over for the two halves that have to meet. */
function Word({ text, kinetic }: { text: string; kinetic: Kinetic }) {
  const dot = <span className="tdot">.</span>;
  if (isPerChar(kinetic)) {
    // The stagger is per kinetic: a key strike is fast and tight, a drop has
    // weight and wants more air, a split flap is a board and reads best when
    // the characters are almost - but not quite - simultaneous.
    const step = kinetic === "drop" ? 0.055 : kinetic === "flap" ? 0.038 : 0.045;
    const chars = [...text, "."];
    return (
      <>
        {chars.map((c, i) => (
          <span
            key={`${c}${i}`}
            className={`ch${c === "." ? " tdot" : ""}`}
            style={{ animationDelay: `${(i * step).toFixed(3)}s` }}
          >
            {c}
          </span>
        ))}
      </>
    );
  }
  if (kinetic === "snap") {
    return (
      <>
        <span className="half l">
          {text}
          {dot}
        </span>
        {/* The right half is the same word again, clipped. aria-hidden so the
            word is not announced twice. */}
        <span className="half r" aria-hidden>
          {text}
          {dot}
        </span>
      </>
    );
  }
  return (
    <span className="k-line">
      {text}
      {dot}
    </span>
  );
}

export function LogbookType({
  arrangement,
  t,
  w,
  h,
  beats = BEATS,
  bare = false,
  kinetic = "rise",
  kineticPerBeat,
  preRoll = 0,
  kineticOut = "none",
  outDur = 0.22,
  pos,
}: {
  arrangement: Arrangement;
  t: number;
  w: number;
  h: number;
  /** The arc round rewrites the words, because its numbers depend on how many
   *  questions the lesson actually has. Defaults to the shared sheet. */
  beats?: Beat[];
  /** The word and the payoff, nothing else. No line under the word and no
   *  running index - both are things on screen, and the quiet round's whole
   *  brief is that there were too many of those. */
  bare?: boolean;
  /** How the word arrives. See tuning.ts. */
  kinetic?: Kinetic;
  /** Per beat, overriding the above. Lets a cut change texture on one beat the
   *  way the bed does at its third landing. */
  kineticPerBeat?: Kinetic[];
  /** Seconds the picture runs ahead of the bed. */
  preRoll?: number;
  /** How it leaves. `none` is a hard cut, which is what every round before this
   *  one did without deciding to. */
  kineticOut?: KineticOut;
  /** The flow's exit length, which is how long the outgoing word has. */
  outDur?: number;
  /** Where it sits. Omit to use the per-arrangement slot below. */
  pos?: WordPos;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `lt-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    // Off the SHORT axis, never the width: scaling by width is right for
    // portrait and square and wrong for 16:9 by 1.78x.
    const short = Math.min(w, h);
    const el = document.createElement("style");
    el.textContent =
      css(id, arrangement, {
        word: Math.round(short * TEXT_SCALE.word),
        url: Math.round(short * TEXT_SCALE.url),
      }) + kineticCss(id);
    root.appendChild(el);
    return () => el.remove();
  }, [id, arrangement, w, h]);

  // Mount at `at - lead - preRoll`, not at `at`. Two separate reasons stacked:
  // an entrance that has to LAND on the beat has to start before it by its own
  // duration, and the landing itself belongs a couple of frames AHEAD of the
  // bed. The lead is per beat because a cut may change the word's texture from
  // one beat to the next, and a tracking-in needs half a second where a strike
  // needs none.
  const kOf = (i: number) => kineticPerBeat?.[i] ?? kinetic;
  const startOf = (i: number) => beats[i].at - kineticLead(kOf(i)) - preRoll;
  const active = beats.reduce((acc, b, i) => (t >= startOf(i) ? i : acc), -1);
  const beat = active >= 0 ? beats[active] : null;

  // THE OUTGOING WORD IS A SECOND ELEMENT, not the same one animating backwards.
  // React unmounts it the moment the next beat arms, so an exit has no mount to
  // hang a keyframe on; it is rendered alongside for `outDur` and its style is
  // computed from t. `data-anim-at` still points at its OWN start so the pin
  // leaves its entrance settled rather than replaying it under the exit.
  const prev = active - 1;
  const outP = active > 0 ? clamp01((t - startOf(active)) / Math.max(0.001, outDur)) : 1;
  const leaving = kineticOut !== "none" && prev >= 0 && outP < 1 ? beats[prev] : null;

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div id={id} style={{ position: "absolute", inset: 0 }}>
        {bare ? null : (
          <div className="lt-eyebrow">
            <span className="lt-idx">{String(Math.max(0, active) + 1).padStart(2, "0")}</span>
            <span className="lt-sep">/</span>
            <span className="lt-idx lt-dim">{String(beats.length).padStart(2, "0")}</span>
            <span className="lt-label">{LABEL}</span>
          </div>
        )}

        {leaving ? (
          <div
            className="lt-term"
            key={`o${prev}${kinetic}`}
            data-anim-at={startOf(prev)}
            style={{
              ...(pos ? wordBox(pos, prev) : undefined),
              ...outStyle(kineticOut, outP),
            }}
          >
            <p className={`lt-h k-${kOf(prev)}`}>
              <Word text={leaving.word} kinetic={kOf(prev)} />
            </p>
          </div>
        ) : null}

        {beat ? (
          // The key remounts the block per beat so the entrance restarts, and
          // `data-anim-at` is what the stage pins it against.
          <div
            className="lt-term"
            key={`b${active}${kOf(active)}`}
            data-anim-at={startOf(active)}
            style={pos ? wordBox(pos, active) : undefined}
          >
            <p className={`lt-h k-${kOf(active)}`}>
              <Word text={beat.word} kinetic={kOf(active)} />
            </p>
            {bare ? null : <p className="lt-b">{beat.line}</p>}
          </div>
        ) : null}

        <div className="lt-payoff" style={{ opacity: t >= 8 ? 1 : 0 }}>
          {PAYOFF}
        </div>
      </div>
    </div>
  );
}

/** Where the type goes when the caller does not say. A property of where the
 *  SUBJECT is rather than of the arrangement's name. */
const SLOT: Record<Arrangement, string> = {
  page: "left:7%;bottom:9.5%;max-width:62%",
  rail: "left:7%;bottom:9.5%;max-width:62%",
  emblem: "left:7%;bottom:auto;top:34%;max-width:38%",
  strip: "left:7%;bottom:auto;top:34%;max-width:38%",
  morph: "left:7%;bottom:9.5%;max-width:56%",
  split: "left:7%;bottom:9.5%;max-width:40%",
  arc: "left:7%;bottom:9.5%;max-width:46%",
  // No line under it, so the word can sit on the baseline the URL leaves.
  quiet: "left:7%;bottom:11%;max-width:60%",
};

function css(id: string, arrangement: Arrangement, size: { word: number; url: number }) {
  const block = SLOT[arrangement];
  return `
#${id}{--command-gold:#c8963e;--gold-light:#e8b865;--title:#f1ece0;--muted:#aaa;--gray-3:#555;
  line-height:normal}
#${id} .tdot{-webkit-text-fill-color:transparent;-webkit-text-stroke-width:.05em;
  -webkit-text-stroke-color:var(--title);text-shadow:none}

#${id} .lt-eyebrow{position:absolute;left:7%;top:7%;display:flex;align-items:baseline;gap:.5em;
  font-family:'Space Mono',monospace;font-size:${Math.round(size.url * 0.95)}px;
  letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
#${id} .lt-idx{font-family:'Saira Condensed',sans-serif;font-weight:800;
  font-size:${Math.round(size.url * 1.5)}px;letter-spacing:.02em;color:var(--command-gold);
  font-variant-numeric:tabular-nums}
#${id} .lt-dim,#${id} .lt-sep{color:var(--gray-3)}
#${id} .lt-label{color:var(--title)}

#${id} .lt-term{position:absolute;${block}}
#${id} .lt-h{font-family:'Bebas Neue',sans-serif;font-size:${Math.round(size.word * 0.86)}px;
  line-height:.9;color:var(--command-gold);-webkit-text-stroke:.03em currentColor;
  paint-order:stroke fill;text-shadow:0 2px 26px rgba(0,0,0,.85)}
#${id} .k-line{display:inline-block}
#${id} .lt-b{margin-top:.4em;font-family:Lora,serif;
  font-size:${Math.round(size.url * 1.3)}px;line-height:1.35;color:var(--title);
  text-shadow:0 2px 18px rgba(0,0,0,.95);
  animation:ltRise .42s cubic-bezier(.16,.9,.24,1) both .09s}

#${id} .lt-payoff{position:absolute;left:0;right:0;bottom:3.5%;text-align:center;
  font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted);
  text-shadow:0 2px 18px rgba(0,0,0,.9)}
`;
}
