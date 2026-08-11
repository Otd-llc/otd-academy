"use client";

// SANDBOX - EARN beat arrangements. DEV ONLY.
//
// The flash is LOCKED to Swell, pulled from the flash table rather than retyped,
// so the two rounds cannot drift apart. Nothing here varies except where things
// sit.
//
// The type recipes come from cueCss, so weight, stroke, leading and the hollow
// period are the shipped ones. Only POSITION is local to this round.
//
// ASCII only.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";
import { FLASHES } from "../flash/flashes";
import type { Arrangement } from "./layouts";

// Narrowed at module scope, then re-bound: a module-level `if (!x) throw` does
// not narrow x inside a closure, so the effect below still sees it as possibly
// undefined.
const found = FLASHES.find((f) => f.id === "swell");
if (!found) throw new Error("the picked flash is gone from the table");
const SWELL = found;

export function ArrangeFrame({ a }: { a: Arrangement }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `ar-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.max(1, root.getBoundingClientRect().height);
    const size = {
      word: Math.round(short * TEXT_SCALE.word),
      big: Math.round(short * TEXT_SCALE.big * a.earn.scale),
      url: Math.round(short * TEXT_SCALE.url),
    };
    const style = document.createElement("style");
    style.textContent =
      cueCss(size, 8).replace(/#cuelayer/g, `#${id}`) +
      `
/* Absolute for this round only. The five-cell grid cannot say "move the block
   down six percent and even out the gaps", which is the question being asked.
   The winner converts back into cells. */
#${id} .ab{position:absolute}
#${id} .cta-box{animation:arSwell-${id} 1.75s linear infinite both}
@keyframes arSwell-${id}{${SWELL.frames}}
#${id} .wm{-webkit-mask-image:url(/brand/1kd-icon.svg);mask-image:url(/brand/1kd-icon.svg);
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-position:center;mask-position:center;
  -webkit-mask-size:contain;mask-size:contain;background:var(--command-gold)}
#${id} .u{font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted);text-shadow:0 2px 18px rgba(0,0,0,.9)}
`;
    root.appendChild(style);
    return () => style.remove();
  }, [id, a]);

  return (
    <div
      data-arrange={a.id}
      data-bleed={a.cert.bleed ? "1" : "0"}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local capture plate, not a product image */}
      <img
        data-el="cert"
        src="/_capture/cine/cert-card.png"
        alt=""
        style={{
          position: "absolute",
          width: `${a.cert.w}%`,
          left: `${a.cert.left}%`,
          top: `${a.cert.top}%`,
          transform: `rotate(${a.cert.lean}deg)`,
        }}
      />
      <div ref={hostRef} className="absolute inset-0 z-10">
        <div id={id} style={{ position: "absolute", inset: 0 }}>
          {a.wm ? (
            <div
              data-el="wm"
              className="ab wm"
              // HEIGHT, not width. The flash round's sizes are fractions of the
              // SHORT AXIS, same as TEXT_SCALE; setting them as a width made
              // every mark 1.78x too big on 16:9 and the "medium" one swallowed
              // the ask.
              style={{
                left: `${a.wm.left}%`,
                top: `${a.wm.top}%`,
                height: `${a.wm.size}%`,
                aspectRatio: "1 / 1",
                opacity: a.wm.opacity,
              }}
            />
          ) : null}

          {/* .big must be an ANCESTOR of .k-word: the cue sheet sizes EARN with
              "#cuelayer .big .k-word", so putting both classes on one element
              leaves the word at the small size. */}
          <div
            data-el="earn"
            className="ab big"
            style={{ left: `${a.earn.left}%`, top: `${a.earn.top}%` }}
          >
            <div className="k-word">
              <span className="accent">
                EARN<span className="tdot">.</span>
              </span>
            </div>
          </div>

          <div data-el="cta" className="ab" style={{ left: `${a.cta.left}%`, top: `${a.cta.top}%` }}>
            <span className="cta-box">Start the build</span>
          </div>

          <div
            data-el="url"
            className="ab u"
            style={
              a.url.align === "centre"
                ? { left: 0, right: 0, top: `${a.url.top}%`, textAlign: "center" }
                : a.url.align === "right"
                  ? { right: `${100 - a.url.left}%`, top: `${a.url.top}%` }
                  : { left: `${a.url.left}%`, top: `${a.url.top}%` }
            }
          >
            academy.onethousanddrones.com/beta
          </div>
        </div>
      </div>
    </div>
  );
}
