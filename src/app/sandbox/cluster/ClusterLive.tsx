"use client";

// SANDBOX - a cluster explainer with the diagrams LIVE, not as stills. DEV ONLY.
//
// THE FIRST VERSION COMPOSITED .webp PLATES and faked motion with a slow scale.
// That threw away the best thing these diagrams have. Every one is a React
// component with a real reveal, and several are Tier B in
// docs/diagrams/animation-standards.md, where the motion IS the lesson: a gold
// pulse travelling J1 to F1 to U2 to U1, bars filling 0 to value and stopping
// short, rows stacking front to back in order. A still of a flow diagram is a
// picture of a flow diagram.
//
// So this renders the components themselves and REPLAYS the reveal on each beat.
//
// WHY THE CLASSES ARE DRIVEN BY HAND. useScrollReveal arms on mount and fires
// once on intersection, then disconnects, which is right for a page and useless
// for a loop: the second lap would show four settled diagrams. The reveal is
// expressed entirely as `.dgfrm.armed.in`, so removing and re-adding `in`
// replays it. Reaching past the hook is deliberate and worth the note.
//
// REDUCED MOTION IS STILL HONOURED. The hook refuses to arm under it, so nothing
// here forces motion on: with reduced motion the diagrams simply sit in their
// final state, which is what that setting is asking for.

import { useEffect, useRef, useState } from "react";
import { DIAGRAM_COMPONENTS } from "@/components/guide/diagram-registry";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";
import type { Beat, TextStyle } from "./clusters";
import { ClusterType } from "./ClusterType";

const SECONDS = 10;

const FRAMELESS = `
[data-frameless] .dgfrm{border:0!important;background:transparent!important;
  box-shadow:none!important;padding:0!important;border-radius:0!important}
`;
/** The reveal is re-armed slightly BEFORE the downbeat so its first frames are
 *  spent by the time the word lands, the same reason BUILD carries a lead. */
const REVEAL_LEAD = 0.35;

export function ClusterLive({
  beats,
  label,
  payoff,
  style,
  w = 880,
  fixedT,
}: {
  beats: Beat[];
  label: string;
  payoff: string;
  style: TextStyle;
  w?: number;
  /** Freeze the clock, for inspecting one beat and for screenshots. Without it
   *  a capture lands wherever wall time happened to be, which is how the first
   *  shot of this came back as an empty frame from the opening bar. */
  fixedT?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const fired = useRef<Set<number>>(new Set());
  const h = Math.round((w * 9) / 16);

  useEffect(() => {
    if (fixedT !== undefined) {
      setT(fixedT);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const nt = ((now - start) / 1000) % SECONDS;
      // A wrap means a new lap: let every reveal fire again.
      setT((prev) => {
        if (nt < prev) fired.current.clear();
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fixedT]);

  // Replay the reveal for whichever beat has just come up.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    beats.forEach((b, i) => {
      const at = i === 0 ? 0.05 : b.at - REVEAL_LEAD;
      if (t < at || fired.current.has(i)) return;
      fired.current.add(i);
      const frame = host.querySelector<HTMLElement>(`[data-beat="${i}"] .dgfrm`);
      if (!frame) return;
      // Drop `in`, force a reflow so the browser sees the change, then re-add.
      // Without the reflow the two class writes coalesce and nothing replays.
      frame.classList.remove("in");
      void frame.offsetWidth;
      frame.classList.add("armed", "in");
    });
  }, [t, beats]);

  // BAR ONE IS NOT BLACK. The film opens on two seconds of spinning gerbers
  // before DESIGN lands, so the scene reads before it is labelled. This has no
  // establishing subject of its own, and the first pass simply showed nothing
  // until 2.0: a fifth of the clip, black, which in a feed is where the viewer
  // leaves. The first diagram is therefore up from the start and its WORD still
  // lands on the downbeat, which is the same relationship the film has.
  const shown = (i: number) => {
    const at = i === 0 ? 0 : beats[i].at - REVEAL_LEAD;
    const next = beats[i + 1]?.at ?? SECONDS;
    return t >= at && t < next - 0.12;
  };

  return (
    <div
      data-cluster-live
      ref={hostRef}
      // The frame comes off. `.dgfrm` draws a bordered, padded card because a
      // diagram in a lesson sits in a column of prose and needs an edge. In a
      // clip the whole frame IS the card, so the border reads as a screenshot
      // of a website rather than as a film.
      data-frameless
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#08090d",
        overflow: "hidden",
      }}
    >
      <style>{FRAMELESS}</style>
      {beats.map((b, i) => {
        const Cmp = DIAGRAM_COMPONENTS[`/guide-diagrams/${b.basename}.svg`];
        return (
          <div
            key={b.basename}
            data-beat={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: "6% 8%",
              opacity: shown(i) ? 1 : 0,
              transition: "opacity .22s linear",
              pointerEvents: "none",
            }}
          >
            {/* BARE, and for the same reason the film's band cut is typeless.
                A diagram's default chrome bakes in its own eyebrow, title and
                caption, because the standalone export is a share card that has
                to carry its own context. Here the overlay says all of that, so
                the default render put two titles and two captions in one frame.
                `fig: null` drops the corner figure number too, which belongs to
                a numbered lesson and means nothing in a clip. */}
            <DiagramChromeProvider bare fig={null}>
              <div style={{ width: "100%", maxWidth: 760 }}>
                {Cmp ? <Cmp /> : <p style={{ color: "#ef5350" }}>no component for {b.basename}</p>}
              </div>
            </DiagramChromeProvider>
          </div>
        );
      })}

      <ClusterType beats={beats} label={label} payoff={payoff} style={style} t={t} w={w} h={h} />
    </div>
  );
}
