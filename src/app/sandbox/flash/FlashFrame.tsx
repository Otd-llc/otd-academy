"use client";

// SANDBOX - how the CTA flashes, and the watermark above it. DEV ONLY.
//
// The first attempt copied hex's tray literally: command-gold to gold-light,
// a squash, a faint wash. Rejected. So this is the range rather than another
// single guess, from a barely-there edge lift to the box inverting solid.
//
// THESE RUN LIVE, not scrubbed. A flash is a few frames long and cannot be
// judged from a still; the film's own copy is pinned to scene time as always.
//
// THE WATERMARK is the brand icon used as a MASK over a gold token, not an
// <img>. The asset carries a hardcoded #E2E8F0 fill, so dropping it in would
// put an off-palette slate on the frame and it would not follow a theme. As a
// mask the colour is var(--command-gold) and the opacity is ours.
//
// ASCII only in this file.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";
// The table lives in a PLAIN module: a server component importing it from here
// would receive client references rather than values.
import type { FlashStyle } from "./flashes";

/** Watermark placement. Size is a fraction of the SHORT axis, as all type is. */
export type Wm = { size: number; opacity: number; cell: "c-ml" | "c-bl"; nudgeY?: number } | null;

export const WM_DEFAULT: Wm = { size: 0.36, opacity: 0.11, cell: "c-ml" };

export function FlashFrame({
  flash,
  watermark = WM_DEFAULT,
}: {
  flash: FlashStyle;
  watermark?: Wm;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `fl-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.max(1, root.getBoundingClientRect().height);
    const style = document.createElement("style");
    style.textContent =
      cueCss(
        {
          word: Math.round(short * TEXT_SCALE.word),
          big: Math.round(short * TEXT_SCALE.big * 1.2),
          url: Math.round(short * TEXT_SCALE.url),
        },
        8,
      ).replace(/#cuelayer/g, `#${id}`) +
      `
#${id} .cta-box{display:inline-block;border:1px solid var(--command-gold);border-radius:2px;
  padding:.62em 1.15em;font-family:'Space Mono',monospace;text-transform:uppercase;
  letter-spacing:.22em;color:var(--command-gold);background:transparent;
  font-size:${Math.round(short * TEXT_SCALE.url * 1.55)}px;
  text-shadow:0 2px 18px rgba(0,0,0,.9)}
/* The sweep needs a gradient to move; every other style leaves it unused and
   transparent, so it costs nothing. */
#${id} .cta-box{background-image:linear-gradient(100deg,transparent 35%,
  rgba(232,184,101,.30) 50%,transparent 65%);background-size:220% 100%;
  background-repeat:no-repeat;background-position:-140% 0}
/* MATCHES cueCss's OWN SELECTOR, deliberately. That sheet ships
   "#id .cue.held.mark .cta-box{animation:cCta ...}", one id plus four classes;
   a plainer "#id .cta-box" loses on specificity, so every style here silently
   ran the FILM's animation instead of its own. Eight different labels, one
   flash on screen, and the state counts matched exactly because of it. Same
   selector, declared later, wins. */
@keyframes fl-${flash.id}{${flash.frames}}
#${id} .cue.held.mark .cta-box{animation:fl-${flash.id} 1.75s linear infinite both}
/* MASK, not an img: the asset has a hardcoded slate fill. */
#${id} .wm{-webkit-mask-image:url(/brand/1kd-icon.svg);mask-image:url(/brand/1kd-icon.svg);
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  -webkit-mask-size:contain;mask-size:contain;
  background:var(--command-gold);
  opacity:${watermark?.opacity ?? 0};
  width:${Math.round(short * (watermark?.size ?? 0))}px;
  height:${Math.round(short * (watermark?.size ?? 0))}px;
  transform:translateY(${watermark?.nudgeY ?? 0}%)}
`;
    root.appendChild(style);
    return () => style.remove();
  }, [id, flash]);

  return (
    <div
      data-flash={flash.id}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
      <img
        src="/_capture/cine/cert-card.png"
        alt=""
        style={{ position: "absolute", width: "46%", left: "46%", top: "18%", transform: "rotate(-6deg)" }}
      />
      <div ref={hostRef} className="pointer-events-none absolute inset-0 z-10">
        <div id={id}>
          <div className="cue held f1 c-tl big" style={{ opacity: 1 }}>
            <div className="k-grow">
              <div className="k-mask">
                <div className="k-word">
                  <span className="accent">
                    EARN<span className="tdot">.</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3 by default, which is the band that was actually empty. It
              was sharing c-bl with the ask, so it sat on the box's top-left
              corner rather than in the space above it. */}
          {watermark ? (
            <div className={`cue held mark ${watermark.cell}`} style={{ opacity: 1 }}>
              <div className="wm" />
            </div>
          ) : null}

          <div className="cue held mark c-bl" style={{ opacity: 1 }}>
            <span className="cta-box">Start the build</span>
          </div>

          <div className="cue held mark c-band centre" style={{ opacity: 1 }}>
            <div className="mark">
              <div className="mark-url">academy.onethousanddrones.com/beta</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
