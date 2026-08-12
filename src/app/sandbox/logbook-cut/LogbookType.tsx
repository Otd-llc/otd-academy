"use client";

// SANDBOX - the type over the logbook cut. DEV ONLY.
//
// Term-and-line, which is the treatment the cluster explainer round settled on:
// a hard word in Bebas and one Lora line under it that carries the NUMBER. A
// gamification film whose type only shouts is a film that never states the
// thing it is about, and every number in `beats.ts` is real, so putting them on
// screen costs nothing and is the whole argument.
//
// PLACEMENT IS PER ARRANGEMENT, because the subject sits somewhere different in
// each. `page` and `rail` hold the middle, so the type takes the bottom band;
// `emblem` puts its subject right, so the type takes a left column. Composing
// all three against one grid cell is how you get a word across a rank wing.
//
// NOTHING HERE TRANSITIONS. Opacity is computed from scene time, because a CSS
// transition has no seek: under a scrubbed clock it lands wherever real time
// reached. Entrances are keyframe animations, which DO seek, and the stage pins
// their currentTime.
//
// ASCII only.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE } from "../capture/cut/cue-layer";
import { BEATS, LABEL, PAYOFF, type Arrangement } from "./beats";

export function LogbookType({
  arrangement,
  t,
  w,
  h,
}: {
  arrangement: Arrangement;
  t: number;
  w: number;
  h: number;
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
    el.textContent = css(id, arrangement, {
      word: Math.round(short * TEXT_SCALE.word),
      url: Math.round(short * TEXT_SCALE.url),
    });
    root.appendChild(el);
    return () => el.remove();
  }, [id, arrangement, w, h]);

  const active = BEATS.reduce((acc, b, i) => (t >= b.at ? i : acc), -1);
  const beat = active >= 0 ? BEATS[active] : null;

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div id={id} style={{ position: "absolute", inset: 0 }}>
        {/* Held for the whole clip. A viewer who joins three seconds in should
            still know what they are looking at. */}
        <div className="lt-eyebrow">
          <span className="lt-idx">{String(Math.max(0, active) + 1).padStart(2, "0")}</span>
          <span className="lt-sep">/</span>
          <span className="lt-idx lt-dim">{String(BEATS.length).padStart(2, "0")}</span>
          <span className="lt-label">{LABEL}</span>
        </div>

        {beat ? (
          // `data-anim-at` is what the stage pins the entrance against, and the
          // key remounts the block per beat so the animation restarts.
          <div className="lt-term" key={`b${active}`} data-anim-at={beat.at}>
            <p className="lt-h">
              {beat.word}
              <span className="tdot">.</span>
            </p>
            <p className="lt-b">{beat.line}</p>
          </div>
        ) : null}

        <div className="lt-payoff" style={{ opacity: t >= 8 ? 1 : 0 }}>
          {PAYOFF}
        </div>
      </div>
    </div>
  );
}

function css(id: string, arrangement: Arrangement, size: { word: number; url: number }) {
  // The subject holds the middle in two of the three, so the type takes the
  // bottom band there and a left column in the third.
  const block =
    arrangement === "emblem"
      ? `left:7%;bottom:auto;top:34%;max-width:38%`
      : `left:7%;bottom:9.5%;max-width:62%`;
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
  paint-order:stroke fill;text-shadow:0 2px 26px rgba(0,0,0,.85);
  animation:ltRise .42s cubic-bezier(.16,.9,.24,1) both}
#${id} .lt-b{margin-top:.4em;font-family:Lora,serif;
  font-size:${Math.round(size.url * 1.3)}px;line-height:1.35;color:var(--title);
  text-shadow:0 2px 18px rgba(0,0,0,.95);
  animation:ltRise .42s cubic-bezier(.16,.9,.24,1) both .09s}
@keyframes ltRise{from{opacity:0;transform:translateY(11%)}to{opacity:1;transform:none}}

#${id} .lt-payoff{position:absolute;left:0;right:0;bottom:3.5%;text-align:center;
  font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted);
  text-shadow:0 2px 18px rgba(0,0,0,.9)}
`;
}
