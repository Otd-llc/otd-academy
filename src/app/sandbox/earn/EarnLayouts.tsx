"use client";

// SANDBOX — where the certificate and the EARN type go. DEV ONLY.
//
// THE PROBLEM IS COMPOSITION, NOT TYPE. The certificate is a cream plate filling
// the frame, and both EARN and the URL sit on top of it. The cue layer is built
// for dark picture: gold type, an ivory title colour, and a black text-shadow
// bloom instead of a scrim. Every one of those is the wrong tool against a light
// background, and the bloom in particular turns to mud. Adding a scrim would
// fix the contrast and break the house rule that type sits ON picture.
//
// So the fix is to compose the frame instead: the certificate does not have to
// fill it. Each variant below gives the type its own dark field and lets the
// card occupy what is left.
//
// REAL CUE CSS, NOT AN IMITATION. cueCss() is the same stylesheet the cut
// renders with, so the weight, the stroke, the 0.84 leading and the hollow
// period are the shipped ones. A hand-rolled approximation would be judging a
// different thing.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";

const W = 880;
const H = Math.round((W * 9) / 16);

type Cell = "c-tl" | "c-tr" | "c-bl" | "c-br" | "c-band";

export type Layout = {
  id: string;
  label: string;
  note: string;
  /** Certificate box, as percentages of the frame. */
  cert: { w: number; left: number; top: number; rotate?: number };
  earn: { cell: Cell; align?: "right" | "centre"; big?: boolean };
  url: { cell: Cell; align?: "right" | "centre" };
};

export function EarnLayouts({ layouts }: { layouts: Layout[] }) {
  return (
    <ul className="mt-6 border-t border-panel-border/60">
      {layouts.map((l, i) => (
        <li key={l.id} className="border-b border-panel-border/60 py-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-numeral text-base tabular-nums text-command-gold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="title-card">{l.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
              card {l.cert.w}% · x {l.cert.left}% · y {l.cert.top}%
              {l.cert.rotate ? ` · ${l.cert.rotate}°` : ""}
            </span>
          </div>
          <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{l.note}</p>
          <Frame layout={l} />
        </li>
      ))}
    </ul>
  );
}

function Frame({ layout }: { layout: Layout }) {
  const ref = useRef<HTMLDivElement>(null);
  const raw = useId();
  // useId emits colons, which are not valid in a CSS id selector.
  const id = `earn-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // The cue stylesheet is written against the id #cuelayer, so each frame
    // gets its own copy scoped to its own id. Ten frames sharing one id would
    // be ten elements matching the same selector, which happens to work and is
    // exactly the sort of thing that stops working later.
    const size = {
      word: Math.round(H * TEXT_SCALE.word),
      big: Math.round(H * TEXT_SCALE.big),
      url: Math.round(H * TEXT_SCALE.url),
    };
    const style = document.createElement("style");
    style.textContent = cueCss(size, 8).replace(/#cuelayer/g, `#${id}`);
    root.appendChild(style);
    return () => style.remove();
  }, [id]);

  const { cert, earn, url } = layout;

  return (
    <div
      ref={ref}
      data-layout={layout.id}
      className="relative mt-3 overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
      <img
        src="/_capture/cine/cert-card.png"
        alt=""
        style={{
          position: "absolute",
          width: `${cert.w}%`,
          left: `${cert.left}%`,
          top: `${cert.top}%`,
          transform: cert.rotate ? `rotate(${cert.rotate}deg)` : undefined,
          transformOrigin: "center",
        }}
      />
      <div id={id}>
        <div
          className={`cue held f1 ${earn.cell} ${earn.align ?? ""} ${earn.big === false ? "" : "big"}`}
          style={{ opacity: 1 }}
        >
          <div className="k-grow">
            <div className="k-mask">
              {/* The hollow period as JSX rather than the D html constant: it
                  renders the same markup and needs no innerHTML. */}
              <div className="k-word">
                <span className="accent">
                  EARN<span className="tdot">.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={`cue held mark ${url.cell} ${url.align ?? ""}`} style={{ opacity: 1 }}>
          <div className="mark">
            <div className="mark-url">academy.onethousanddrones.com/beta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
