"use client";

// SANDBOX - a Library cluster explained in ten seconds. DEV ONLY.
//
// THE POINT OF THIS ONE IS WHAT IT DOES NOT NEED. The beta film required three
// bespoke rigs: a three.js gerber handoff, a captured exam plate, a certificate
// card. This needs NONE. Every frame is a diagram this repo already renders
// deterministically and already ships, so a cluster explainer costs a cut sheet
// and nothing else.
//
// Same grid as the film: 120 BPM, five bars, 10.000 s, cues on the downbeats at
// 2.0 / 4.0 / 6.0 / 8.0. The type comes from the SHIPPED cue layer, so weight,
// stroke, the hollow period and the black bloom are the film's, not a lookalike.
//
// The alt text is not decoration either: every diagram carries an aria-label
// the exporter REFUSES to run without, so the caption track is already written.

import { useEffect, useRef, useState } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";
import type { Beat } from "./clusters";

const SECONDS = 10;
/** Cross-fade either side of a downbeat, so the swap lands ON the beat. */
const FADE = 0.34;

export function ClusterStage({
  beats,
  payoff,
  w = 880,
  autoplay = true,
}: {
  beats: Beat[];
  payoff: string;
  w?: number;
  autoplay?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const h = Math.round((w * 9) / 16);

  // The cue CSS, sized off the short axis exactly as the film does.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const short = Math.min(w, h);
    const style = document.createElement("style");
    style.textContent = cueCss(
      {
        word: Math.round(short * TEXT_SCALE.word),
        big: Math.round(short * TEXT_SCALE.big),
        url: Math.round(short * TEXT_SCALE.url),
      },
      8,
    ).replace(/#cuelayer/g, "#clusterlayer");
    root.appendChild(style);
    return () => style.remove();
  }, [w, h]);

  useEffect(() => {
    if (!autoplay) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT(((now - start) / 1000) % SECONDS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoplay]);

  // Which plate is up, and how far through its own beat.
  const opacityFor = (i: number) => {
    const at = beats[i].at;
    const next = beats[i + 1]?.at ?? SECONDS;
    // Fade IN across the downbeat, hold, fade OUT across the next one.
    const inU = Math.min(Math.max((t - (at - FADE / 2)) / FADE, 0), 1);
    const outU = Math.min(Math.max((t - (next - FADE / 2)) / FADE, 0), 1);
    return inU * (1 - outU);
  };

  const wordHeld = (i: number) => {
    const at = beats[i].at;
    const next = beats[i + 1]?.at ?? SECONDS;
    return t >= at && t < next - 0.1;
  };

  return (
    <div
      data-cluster-stage
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#08090d",
        overflow: "hidden",
      }}
    >
      {beats.map((b, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={b.src}
          src={b.src}
          alt={b.alt}
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            maxWidth: "76%",
            maxHeight: "72%",
            objectFit: "contain",
            opacity: opacityFor(i),
            // A touch of scale over the beat, so a still does not read as a
            // slideshow. The film earns motion from its subject; this has to
            // manufacture a little.
            transform: `scale(${1 + 0.035 * Math.min(Math.max((t - b.at) / 2, 0), 1)})`,
          }}
        />
      ))}

      <div id="clusterlayer" style={{ position: "absolute", inset: 0 }}>
        {beats.map((b, i) => (
          <div
            key={b.word}
            className={`cue ${i % 2 === 0 ? "c-tl" : "c-br"} p2 ${i % 2 === 0 ? "" : "right"}`}
            style={{ opacity: wordHeld(i) ? 1 : 0, transition: "opacity .18s linear" }}
          >
            <div className="k-grow">
              <div className="k-mask">
                <div className="k-word">
                  {b.word}
                  <span className="tdot">.</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {/* The payoff: the cluster's own name, on the last downbeat. */}
        <div
          className="cue c-band centre mark"
          style={{ opacity: t >= 8 ? 1 : 0, transition: "opacity .2s linear" }}
        >
          <div className="mark">
            <div className="mark-url">{payoff}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
