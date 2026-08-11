"use client";

// SANDBOX - a call to action under EARN. DEV ONLY.
//
// WHAT IS MISSING TODAY. The last beat lands the word, shows the certificate,
// and prints a URL along the bottom in muted mono. That URL is a MARK, not an
// ask: it says where this lives, not what to do. The hex cut ends the same way,
// which was right for a product you can look at and wrong for a course someone
// has to enrol in.
//
// TWO AXES, JUDGED SEPARATELY. The treatments below all carry the same words so
// only the typography varies; the wordings all use one treatment so only the
// language varies. Comparing six things that differ in two ways at once is how
// you end up picking neither.
//
// THE CTA LANDS AFTER EARN, not with it. EARN is at 8.0 and the final bar has a
// half-beat at 9.0, so the ask arrives a beat behind the payoff: reward, then
// request. Everything here is drawn in its settled state; the timing is a
// separate call.
//
// ASCII only in this file.

import { useEffect, useId, useRef } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";

/** Layout G, the locked EARN composition. */
const CARD = { w: 46, left: 46, top: 18, lean: -6 };
const WORD_SCALE = 1.2;

export type Treatment =
  | "bare"
  | "rule"
  | "framed"
  | "arrow"
  | "stacked"
  | "badge";

export type Variant = {
  id: string;
  label: string;
  note: string;
  treatment: Treatment;
  /** The ask. Plain text; the hollow period is added by `dot`. */
  words: string;
  /** Close it with the hollow period the four cue words use. */
  dot?: boolean;
  /** Drop the bottom URL band, because this variant carries the URL itself. */
  ownUrl?: boolean;
};

const URL_TEXT = "academy.onethousanddrones.com/beta";

export function CtaFrame({ variant }: { variant: Variant }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `cta-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.max(1, root.getBoundingClientRect().height);
    const style = document.createElement("style");
    style.textContent =
      cueCss(
        {
          word: Math.round(short * TEXT_SCALE.word),
          big: Math.round(short * TEXT_SCALE.big * WORD_SCALE),
          url: Math.round(short * TEXT_SCALE.url),
        },
        8,
      ).replace(/#cuelayer/g, `#${id}`) +
      // The CTA's own recipe. Mono, gold, wider tracked and larger than the
      // URL: Bebas would compete with EARN directly above it, and the muted
      // mono of the URL is deliberately recessive. This sits between them.
      `
#${id} .cta{font-family:'Space Mono',monospace;text-transform:uppercase;
  letter-spacing:.22em;color:var(--command-gold);
  font-size:${Math.round(short * (17 / 460))}px;text-shadow:0 2px 18px rgba(0,0,0,.9)}
#${id} .cta-wrap{display:inline-block}
#${id} .cta-rule{display:block;width:2.6em;height:1px;background:var(--command-gold);
  margin:0 0 .7em;opacity:.8}
#${id} .cta-box{display:inline-block;border:1px solid var(--command-gold);
  padding:.62em 1.15em;border-radius:2px}
#${id} .cta-mark{color:var(--command-gold);margin-right:.55em}
#${id} .cta-sub{display:block;margin-top:.75em;font-family:'Space Mono',monospace;
  text-transform:uppercase;letter-spacing:.18em;color:var(--muted);
  font-size:${Math.round(short * TEXT_SCALE.url)}px;text-shadow:0 2px 18px rgba(0,0,0,.9)}
/* ABOVE the ask, not in front of it. Inline, the badge pushed the line to 47%
   of the frame width while the card starts at 46%, so the tag clipped the
   certificate. Stacked it costs no width at all. */
#${id} .cta-badge{display:block;width:max-content;border:1px solid var(--command-gold);
  padding:.3em .55em;margin:0 0 .8em;font-size:.7em;letter-spacing:.2em}
`;
    root.appendChild(style);
    return () => style.remove();
  }, [id]);

  const { treatment, words, dot, ownUrl } = variant;
  const label = (
    <>
      {words}
      {dot ? <span className="tdot">.</span> : null}
    </>
  );

  return (
    <div
      data-cta={variant.id}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
      <img
        src="/_capture/cine/cert-card.png"
        alt=""
        style={{
          position: "absolute",
          width: `${CARD.w}%`,
          left: `${CARD.left}%`,
          top: `${CARD.top}%`,
          transform: `rotate(${CARD.lean}deg)`,
        }}
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

          {/* The ask, in the row BELOW the word, left column. */}
          <div className="cue held mark c-bl" style={{ opacity: 1, alignSelf: "start" }}>
            <span className="cta-wrap">
              {treatment === "rule" ? <span className="cta-rule" /> : null}
              {treatment === "badge" ? <span className="cta cta-badge">Open beta</span> : null}
              {treatment === "framed" ? (
                <span className="cta-box cta">{label}</span>
              ) : (
                <span className="cta">
                  {treatment === "arrow" ? <span className="cta-mark">&#9656;</span> : null}
                  {label}
                </span>
              )}
              {treatment === "stacked" ? <span className="cta-sub">{URL_TEXT}</span> : null}
            </span>
          </div>

          {/* The URL keeps the bottom band unless the variant carries its own. */}
          {ownUrl ? null : (
            <div className="cue held mark c-band centre" style={{ opacity: 1 }}>
              <div className="mark">
                <div className="mark-url">{URL_TEXT}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
