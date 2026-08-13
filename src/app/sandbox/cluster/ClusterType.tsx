"use client";

// SANDBOX - three ways the type could work on a cluster explainer. DEV ONLY.
//
// The first pass reused the film's cue layer verbatim, which was the safe move
// for a first look and the wrong one to ship. The film's vocabulary is a product
// launch: four hard words on downbeats and a payoff. A library explainer is
// teaching, and its type has different work to do, so these are three different
// answers rather than three skins.
//
// All three keep the house faces and tokens. What differs is what the type SAYS
// and when it arrives.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE } from "../capture/cut/cue-layer";
import type { Beat, TextStyle } from "./clusters";

const SECONDS = 10;

export function ClusterType({
  beats,
  label,
  payoff,
  style,
  t,
  w,
  h,
}: {
  beats: Beat[];
  label: string;
  payoff: string;
  style: TextStyle;
  t: number;
  w: number;
  h: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `ct-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.min(w, h);
    const el = document.createElement("style");
    el.textContent = css(id, {
      word: Math.round(short * TEXT_SCALE.word),
      url: Math.round(short * TEXT_SCALE.url),
    });
    root.appendChild(el);
    return () => el.remove();
  }, [id, w, h]);

  const active = beats.reduce((acc, b, i) => (t >= b.at ? i : acc), -1);
  const beat = active >= 0 ? beats[active] : null;
  // Seconds since this beat landed, for the per-word entrance.
  const since = beat ? t - beat.at : 0;
  const on = beat !== null && since >= 0;

  return (
    <div
      ref={hostRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <div id={id} style={{ position: "absolute", inset: 0 }}>
        {/* The cluster's own name, held for the whole clip. A viewer who joins
            three seconds in should still know what they are looking at, which
            the film never had to solve because its subject was the picture. */}
        <div className="ct-eyebrow">
          <span className="ct-idx">
            {String(Math.max(0, active) + 1).padStart(2, "0")}
          </span>
          <span className="ct-sep">/</span>
          <span className="ct-idx ct-dim">{String(beats.length).padStart(2, "0")}</span>
          <span className="ct-label">{label}</span>
        </div>

        {style === "word" && beat ? (
          <div className={`ct-word ${on ? "in" : ""}`} key={`w${active}`}>
            {beat.word}
            <span className="tdot">.</span>
          </div>
        ) : null}

        {style === "term" && beat ? (
          <div className={`ct-term ${on ? "in" : ""}`} key={`t${active}`}>
            <p className="ct-term-h">
              {beat.word}
              <span className="tdot">.</span>
            </p>
            <p className="ct-term-b">{beat.line}</p>
          </div>
        ) : null}

        {style === "caption" && beat ? (
          <>
            <div className={`ct-word small ${on ? "in" : ""}`} key={`c${active}`}>
              {beat.word}
              <span className="tdot">.</span>
            </div>
            {/* The alt text, verbatim. Not written for this: the exporter
                REFUSES to run without an aria-label, so all 86 diagrams already
                carry a reviewed sentence. That is the caption track, free. */}
            <p className={`ct-cap ${on ? "in" : ""}`} key={`p${active}`}>
              {beat.alt}
            </p>
          </>
        ) : null}

        {/* The payoff, on the last bar, in every treatment. */}
        <div className="ct-payoff" style={{ opacity: t >= 8 ? 1 : 0 }}>
          {payoff}
        </div>
      </div>
    </div>
  );
}

function css(id: string, size: { word: number; url: number }) {
  return `
#${id}{--command-gold:#c8963e;--gold-light:#e8b865;--title:#f1ece0;--muted:#aaa;--gray-3:#555;
  line-height:normal}
#${id} .tdot{-webkit-text-fill-color:transparent;-webkit-text-stroke-width:.05em;
  -webkit-text-stroke-color:var(--command-gold);text-shadow:none}

/* The running index. Six clusters of four beats is a lot of near-identical
   frames; a position marker gives a viewer somewhere to be, which a product
   launch never needs and a lesson does. */
#${id} .ct-eyebrow{position:absolute;left:7%;top:7%;display:flex;align-items:baseline;gap:.5em;
  font-family:'Space Mono',monospace;font-size:${Math.round(size.url * 0.95)}px;
  letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
#${id} .ct-idx{font-family:'Saira Condensed',sans-serif;font-weight:800;
  font-size:${Math.round(size.url * 1.5)}px;letter-spacing:.02em;color:var(--command-gold);
  font-variant-numeric:tabular-nums}
#${id} .ct-dim{color:var(--gray-3)}
#${id} .ct-sep{color:var(--gray-3)}
#${id} .ct-label{color:var(--title)}

/* A: the film's word, unchanged. The baseline everything is judged against. */
#${id} .ct-word{position:absolute;left:7%;bottom:12%;
  font-family:'Bebas Neue',sans-serif;font-size:${size.word}px;line-height:.84;
  color:var(--title);-webkit-text-stroke:.04em currentColor;paint-order:stroke fill;
  text-shadow:0 2px 26px rgba(0,0,0,.8);opacity:0;transform:translateY(10%)}
#${id} .ct-word.in{animation:ctRise .42s cubic-bezier(.16,.9,.24,1) both}
#${id} .ct-word.small{font-size:${Math.round(size.word * 0.62)}px;bottom:auto;top:7%;left:auto;right:7%;text-align:right}
@keyframes ctRise{from{opacity:0;transform:translateY(10%)}to{opacity:1;transform:none}}

/* B: term and definition. The diagram is a concept, so the type names it and
   says what it means, the way a lesson would. */
#${id} .ct-term{position:absolute;left:7%;bottom:11%;max-width:56%;opacity:0}
#${id} .ct-term.in{animation:ctRise .42s cubic-bezier(.16,.9,.24,1) both}
#${id} .ct-term-h{font-family:'Bebas Neue',sans-serif;font-size:${Math.round(size.word * 0.78)}px;
  line-height:.9;color:var(--command-gold);-webkit-text-stroke:.03em currentColor;
  paint-order:stroke fill;text-shadow:0 2px 26px rgba(0,0,0,.85)}
#${id} .ct-term-h .tdot{-webkit-text-stroke-color:var(--title)}
#${id} .ct-term-b{margin-top:.35em;font-family:Lora,serif;
  font-size:${Math.round(size.url * 1.35)}px;line-height:1.35;color:var(--title);
  text-shadow:0 2px 18px rgba(0,0,0,.95)}

/* C: the alt text as a caption track, so the clip works with the sound off and
   with the subtitles a platform generates switched off too. */
#${id} .ct-cap{position:absolute;left:7%;right:7%;bottom:9%;
  font-family:Lora,serif;font-size:${Math.round(size.url * 1.15)}px;line-height:1.4;
  color:var(--title);text-align:center;text-shadow:0 2px 18px rgba(0,0,0,.95);opacity:0}
#${id} .ct-cap.in{animation:ctFade .5s ease both .1s}
@keyframes ctFade{from{opacity:0}to{opacity:1}}

#${id} .ct-payoff{position:absolute;left:0;right:0;bottom:3.5%;text-align:center;
  font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted);transition:opacity .25s linear;
  text-shadow:0 2px 18px rgba(0,0,0,.9)}
`;
}
