"use client";

// SANDBOX — the 10 s academy cut, built to the hex blueprint. DEV ONLY.
//
// FIVE BARS AT 120 BPM, exactly as the hex cuts are. Bar 1 establishes with no
// type; the four cues land on the downbeats at 2.0 / 4.0 / 6.0 / 8.0.
//
//   0.0  stack explode        (establishes, then DESIGN. at 2.0)
//   4.0  board turning        BUILD.
//   6.0  the click and pass   LEARN.
//   8.0  the certificate      EARN. + the URL
//
// The stack gets two bars because it is the opening and needs to read before it
// is labelled; the rest get one each. Segment boundaries sit ON downbeats, so a
// cut never lands off the grid once there is a kick under it.
//
// COMPOSITED BY THE BROWSER, NOT IN POST, which is the hex rule: the cue layer
// sits over the picture in the same page, so one screenshot carries both. A
// separate transparent overlay comped in ffmpeg would mean two renders and a
// second copy of the cue sheet to keep in sync.
//
// EVERY ANIMATION IS SCRUBBED, NEVER PLAYED. Each cue is paused and its
// currentTime pinned to scene time, and the segment videos are SEEKED rather
// than played, so a frame can take any amount of wall time to draw without the
// picture drifting. That is the whole reason the hex cuts are reproducible.
//
// CUE TIME WRAPS. Each cue is evaluated at t and at t + SECONDS, so a window
// whose fade runs past the end shows its tail at the start of the next lap and
// the seam stays continuous.

import { useEffect, useRef } from "react";
import { CUES, TEXT_SCALE, cueCss } from "./cue-layer";
import { SPECS, formatFor, insets, placeEarn, type Format } from "./earn-place";
import { byId, progress, type Align } from "../../junction/transitions";
import { GH, GW, drawGlitch } from "../../junction/glitch";

export const SECONDS = 10;

/** Picture segments, on bar boundaries. `from` indexes into each clip. */
//
// DESIGN AND BUILD ARE ONE SEGMENT, NOT TWO. This used to splice stack.mp4 and
// board.mp4 with a hard cut at 4.0 s: a gerber stack turning at one rate, then a
// board turning at another. So the handoff that was actually designed -- the
// sheets collapsing onto the board's MEASURED thickness, a held beat at matched
// thickness, then a cross-fade with the turntable never breaking -- existed only
// in /sandbox/edge and was never in the film. handoff.mp4 is that rig rendered
// straight, and its cross-fade already lands on 4.0, which is BUILD's downbeat.
//
// PER FORMAT, because the picture cannot be cropped into a new aspect. The
// videos are drawn with object-fit:cover, so feeding a 16:9 render to a 9:16
// frame throws away the outer 68% of the width -- which is where the whole
// certificate lives. Each aspect gets its own render of the same rig.
//
// BAND AND WIDE SHARE ONE PICTURE. Band is not a 1920x640 render; it is the
// 16:9 cut shown through object-fit:cover on a narrow slice. Only the type
// margin changes, so re-rendering the picture for it would be two identical
// files. Wide keeps the unsuffixed names it already has.
const pictureFor = (format: Format) => {
  // Band shares wide's HANDOFF, because that half is the 3D rig and the rig
  // centres its own subject identically at both. It needs its own FINISH: the
  // certificate is centred for band and offset for wide, and that is the whole
  // point of the band variant.
  const handoff = format === "band" || format === "wide" ? "" : `-${format}`;
  const s = format === "wide" ? "" : `-${format}`;
  return [
    { at: 0.0, src: `/_capture/cut/handoff${handoff}.mp4`, from: 0.0 },
    // 1.6, not 0.4. Reading the exam from almost the start of the clip left
    // only four tenths of head, so the LEARN join could barely be pulled
    // earlier. The push-in is 4.6 s from scale 1 to 1.07, so entering at 1.6
    // starts it around 1.02 and costs nothing visible.
    { at: 6.0, src: `/_capture/cut/finish${s}.mp4`, from: 1.6 },
    // 5.8 = the exam half plus the card's 1.2 s pre-roll, which is where the
    // card's own t=0 sits inside finish.mp4. The exam half was lengthened and
    // the card given a pre-roll so BOTH sides of this join have footage either
    // side of the beat to be nudged against. build-finish.mjs owns those two
    // numbers and this one must follow them, IN EVERY FORMAT: the per-aspect
    // renders keep the same segment map so the joins do not have to be
    // re-nudged five times.
    { at: 8.0, src: `/_capture/cut/finish${s}.mp4`, from: 7.0 },
  ];
};

/**
 * The joins, as chosen in /sandbox/junction.
 *
 * UNTIL NOW THE FILM HARD-CUT AT EVERY SEGMENT BOUNDARY. The transitions were
 * built, judged and picked in the sandbox and none of them had ever been in a
 * render: CutStage simply flipped opacity between videos on the beat.
 *
 * `nudge` moves the join off its nominal downbeat, and `align: end` means the
 * incoming shot ARRIVES at beat + nudge rather than straddling it. So the
 * segment's `at` stays the reference the clip offsets are computed from, while
 * the picture actually changes over a window ending at `at + nudge`.
 */
//
// NUDGE 0, NOT +1.0. The +1.0 was picked by eye before there was a track to
// hear, and with sound it is plainly wrong: `rev-long` is a two-second reversed
// crash placed by its END on the LEARN beat, so it RESOLVES at 6.0 and the
// picture was still on the board until 7.0. A riser exists to deliver a moment;
// landing the cut a second after it wastes the entire swell.
//
// The same correction applies to the second join even though only the first was
// reported: the stutter drop lands on 8.0 and push was ending at 9.0.
const JOINS: Record<number, { transition: string; align: Align; nudge: number }> = {
  1: { transition: "glitch-rgb", align: "end", nudge: 0 },
  2: { transition: "push", align: "end", nudge: 0 },
};

/**
 * THE LOOP SEAM, which was a hard cut nobody chose.
 *
 * At 10.0 the picture jumped from a settled certificate to a closed gerber
 * stack. On a social cut that plays on repeat the seam is watched as often as
 * any other join, and it was the only one still unconsidered.
 *
 * It can be a real transition because there is real footage on BOTH sides: the
 * card half of finish.mp4 runs to 9.4 while the last segment only reads to 9.0,
 * so 0.3 s of certificate remains past the end of the cut, and handoff.mp4
 * begins at its own 0.0. The transition therefore runs across the START of the
 * loop, dissolving the leftover tail of the card into the opening stack.
 *
 * half 0.15, not more: the card tail is only 0.4 s long and running past it
 * would freeze the outgoing side on its last frame.
 */
const SEAM_DEFAULT = "dip";
const SEAM = { align: "start" as Align, half: 0.15 };
const SEAM_SPAN = SEAM.half * 2;

declare global {
  interface Window {
    __cutReady?: boolean;
    __cutSet?: (t: number) => Promise<void>;
    __cutMeta?: { segments: number; cues: number };
    /** What the placement rule INTENDED, so a render can be checked against it
     *  rather than against a number retyped into the check. */
    __cutPlaced?: unknown;
  }
}

export function CutStage({
  format = "wide",
  autoplay = false,
  seam,
}: {
  /** Everything the frame needs is derived from this: size, safe rows, the
   *  word's scale, where the certificate sits, and which picture to load. A
   *  loose w/h pair let a caller ask for 1080x1920 and silently get wide's
   *  placement over a centre-cropped 16:9 picture. */
  format?: Format;
  autoplay?: boolean;
  /** Transition id for the loop stitch. Omit for the default. */
  seam?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const spec = SPECS[format];
  const { w, h, safe } = spec;
  const SEGMENTS = pictureFor(format);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const root = rootRef.current;
      if (!root || disposed) return;

      const short = Math.min(w, h);
      const size = {
        word: Math.round(short * TEXT_SCALE.word),
        // The 1.34 lives on the format, not in TEXT_SCALE: it exists so the
        // word can hold a narrow left column on its own, and the three aspects
        // that have no left column set it to 1.
        big: Math.round(short * TEXT_SCALE.big * spec.wordScale),
        url: Math.round(short * TEXT_SCALE.url),
      };

      const placed = placeEarn(format);
      const style = document.createElement("style");
      // Per-side gutters, so the grid corners clear the platform's own
      // furniture. `c-br` is where BUILD sits and where the action rail is.
      style.textContent = cueCss(size, insets(spec), placed);
      root.appendChild(style);

      // ── picture ──────────────────────────────────────────────────────────
      const videos = SEGMENTS.map((seg) => {
        const v = document.createElement("video");
        v.src = seg.src;
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        v.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0";
        root.appendChild(v);
        return v;
      });
      // SETTLE ON error TOO, not just loadeddata. A missing per-format picture
      // fires `error` and never fires `loadeddata`, so waiting only on the
      // happy path left __cutReady undefined forever and every caller reported
      // a timeout instead of a 404. A render that cannot load its picture
      // should say which file, immediately.
      const failures = await Promise.all(
        videos.map(
          (v) =>
            new Promise<string | null>((res) => {
              if (v.readyState >= 2) return res(null);
              v.addEventListener("loadeddata", () => res(null), { once: true });
              v.addEventListener("error", () => res(v.src.split("/").pop() ?? v.src), { once: true });
            }),
        ),
      );
      if (disposed) return;
      const bad = failures.filter(Boolean);
      if (bad.length) {
        throw new Error(`cut picture missing for format "${format}": ${bad.join(", ")}`);
      }

      // ── transition layers ────────────────────────────────────────────────
      // Between the picture and the cues: a transition happens TO the footage,
      // and the type sits over whatever it produces.
      const glitchCanvas = document.createElement("canvas");
      glitchCanvas.width = GW;
      glitchCanvas.height = GH;
      glitchCanvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;z-index:5;opacity:0;pointer-events:none";
      root.appendChild(glitchCanvas);

      const flashLayer = document.createElement("div");
      flashLayer.style.cssText =
        "position:absolute;inset:0;z-index:6;opacity:0;pointer-events:none";
      root.appendChild(flashLayer);

      // ── cue layer ────────────────────────────────────────────────────────
      const layer = document.createElement("div");
      layer.id = "cuelayer";
      const els = CUES.map((c) => {
        const d = document.createElement("div");
        // A slot cue drops its grid cell entirely: `.slot` is absolute, so the
        // cell class would be inert anyway, and leaving it on invites someone
        // to "fix" the layout by editing a cell that does nothing.
        d.className = c.slot
          ? `cue slot s-${c.slot} ${c.anim} ${c.align ?? ""} ${c.big ? "big" : ""}`
          : `cue ${c.cell} ${c.anim} ${c.align ?? ""} ${c.big ? "big" : ""}`;
        if (c.html) {
          d.innerHTML = c.html;
        } else {
          d.innerHTML = `<div class="k-grow"><div class="k-mask"><div class="k-word">${c.word}</div></div></div>`;
          if (c.hold) {
            d.dataset.hold = "1";
            d.style.setProperty("--hold", `${c.d}s`);
            d.style.setProperty("--growTo", String(c.hold));
            const g = d.querySelector<HTMLElement>(".k-grow");
            if (g) g.style.transformOrigin = c.align === "right" ? "right center" : "left center";
          }
          const word = d.querySelector<HTMLElement>(".k-word");
          if (c.anim === "p2" && word) {
            // Split TEXT NODES ONLY, so the accent span and the hollow period
            // survive the per-character wrapping.
            const walk = (n: Node) => {
              if (n.nodeType === 3) {
                const f = document.createDocumentFragment();
                for (const ch of n.textContent ?? "") {
                  const s = document.createElement("span");
                  s.className = "ch";
                  s.textContent = ch;
                  f.appendChild(s);
                }
                (n as ChildNode).replaceWith(f);
              } else [...n.childNodes].forEach(walk);
            };
            walk(word);
            [...word.querySelectorAll<HTMLElement>(".ch")].forEach((s, i) => {
              s.style.animationDelay = `${i * 0.035}s`;
            });
          }
          if (c.anim === "s1" && word) {
            // Two halves, clipped left and right, that MEET on the beat.
            const inner = word.innerHTML;
            word.innerHTML =
              `<span class="half l">${inner}</span><span class="half r">${inner}</span>` +
              `<span style="visibility:hidden">${inner}</span>`;
          }
        }
        layer.appendChild(d);
        return d;
      });
      root.appendChild(layer);

      const seek = (v: HTMLVideoElement, time: number) =>
        new Promise<void>((res) => {
          const target = Math.min(Math.max(time, 0), Math.max((v.duration || 1) - 0.02, 0));
          if (Math.abs(v.currentTime - target) < 0.002) return res();
          v.addEventListener("seeked", () => res(), { once: true });
          v.currentTime = target;
        });

      /**
       * Cues, evaluated at t AND t + SECONDS so a window that overruns the clip
       * shows its tail at the head of the next lap. Factored out because the
       * seam branch returns early and would otherwise skip the type entirely,
       * leaving the first frames of the loop bare.
       */
      const paintCues = (t: number) => {
        CUES.forEach((c, i) => {
          const el = els[i];
          const start = c.t - (c.lead ?? 0);
          let local = -1;
          for (const probe of [t, t + SECONDS]) {
            const u = probe - start;
            if (u >= 0 && u <= c.d + 0.4) local = u;
          }
          if (local < 0) {
            el.classList.remove("held");
            el.style.opacity = "0";
            return;
          }
          el.classList.add("held");
          // Opacity is COMPUTED, never transitioned: a transition cannot seek.
          const fadeIn = Math.min(local / 0.18, 1);
          const fadeOut = local > c.d ? Math.max(1 - (local - c.d) / 0.28, 0) : 1;
          el.style.opacity = String(fadeIn * fadeOut);
          for (const a of el.getAnimations({ subtree: true })) {
            a.pause();
            try {
              a.currentTime = local * 1000;
            } catch {
              /* an animation with no timeline yet */
            }
          }
        });
      };

      const applyAt = async (t: number) => {
        // A segment's clip time is ALWAYS from + (t - at); `at` is the reference,
        // not the moment the picture changes. The join decides that.
        const clipTime = (i: number) => SEGMENTS[i].from + (t - SEGMENTS[i].at);

        // Which join, if any, is mid-transition at this instant. Ownership
        // switches when the transition completes, not on the segment boundary,
        // so a nudged join keeps showing the outgoing shot past its own `at`.
        let idx = 0;
        let active: { i: number; u: number } | null = null;

        // THE SEAM comes first, because it is the one join that spans the wrap.
        // The outgoing side is the LAST segment read a full loop later, which is
        // the certificate tail that exists past the end of the cut.
        const last = SEGMENTS.length - 1;
        if (t < SEAM_SPAN) {
          const u = progress(t, SEAM.half, SEAM.align);
          const outTime = SEGMENTS[last].from + (t + SECONDS - SEGMENTS[last].at);
          await Promise.all([seek(videos[last], outTime), seek(videos[0], clipTime(0))]);
          const tr = byId(seam ?? SEAM_DEFAULT);
          for (let i = 0; i < videos.length; i += 1) {
            const v = videos[i];
            if (i !== 0 && i !== last) {
              v.style.opacity = "0";
              continue;
            }
            const s = tr.style(i === 0 ? "b" : "a", u);
            v.style.opacity = String(s.opacity);
            v.style.transform = s.transform;
            v.style.filter = s.filter;
            v.style.clipPath = s.clipPath;
          }
          if (glitchCanvas) glitchCanvas.style.opacity = "0";
          if (flashLayer) {
            flashLayer.style.background = tr.flash ?? "transparent";
            flashLayer.style.opacity = tr.flash
              ? String((1 - Math.abs(u - 0.5) * 2) ** 1.6 * 0.85)
              : "0";
          }
          paintCues(t);
          return;
        }

        for (let i = 1; i < SEGMENTS.length; i += 1) {
          const join = JOINS[i];
          if (!join) {
            if (t >= SEGMENTS[i].at) idx = i;
            continue;
          }
          const tr = byId(join.transition);
          const u = progress(t - (SEGMENTS[i].at + join.nudge), tr.half, join.align);
          if (u >= 1) idx = i;
          else if (u > 0) {
            idx = i - 1;
            active = { i, u };
            break;
          }
        }

        // Seek every video that is on screen. During a transition that is TWO,
        // and both must be positioned or the outgoing side freezes mid-join.
        const live = active ? [active.i - 1, active.i] : [idx];
        await Promise.all(live.map((i) => seek(videos[i], clipTime(i))));

        for (let i = 0; i < videos.length; i += 1) {
          const v = videos[i];
          if (!live.includes(i)) {
            v.style.opacity = "0";
            v.style.transform = "none";
            v.style.filter = "none";
            v.style.clipPath = "none";
            continue;
          }
          if (!active) {
            v.style.opacity = "1";
            v.style.transform = "none";
            v.style.filter = "none";
            v.style.clipPath = "none";
            continue;
          }
          const tr = byId(JOINS[active.i].transition);
          const s = tr.style(i === active.i ? "b" : "a", active.u);
          v.style.opacity = String(s.opacity);
          v.style.transform = s.transform;
          v.style.filter = s.filter;
          v.style.clipPath = s.clipPath;
        }

        // Glitch transitions carry the picture on a canvas: their style returns
        // opacity 0 for both sides, so without this the frame would be empty.
        if (glitchCanvas) {
          const tr = active ? byId(JOINS[active.i].transition) : null;
          const on = Boolean(active && tr?.glitch);
          glitchCanvas.style.opacity = on ? "1" : "0";
          if (on && active && tr?.glitch) {
            const ctx = glitchCanvas.getContext("2d", { alpha: false });
            if (ctx) {
              // Seeded from the FRAME INDEX, not a counter, so a scrubbed
              // capture tears identically however many times it is rendered.
              drawGlitch(
                ctx,
                videos[active.i - 1] as HTMLVideoElement & { videoWidth: number; videoHeight: number },
                videos[active.i] as HTMLVideoElement & { videoWidth: number; videoHeight: number },
                active.u,
                tr.glitch,
                Math.round(t * 30),
              );
            }
          }
        }
        if (flashLayer) {
          const tr = active ? byId(JOINS[active.i].transition) : null;
          flashLayer.style.background = tr?.flash ?? "transparent";
          flashLayer.style.opacity =
            active && tr?.flash ? String((1 - Math.abs(active.u - 0.5) * 2) ** 1.6 * 0.85) : "0";
        }

        paintCues(t);
      };

      window.__cutSet = applyAt;
      window.__cutMeta = { segments: SEGMENTS.length, cues: CUES.length };
      window.__cutPlaced = { format, w, h, safe, ...placed };
      await applyAt(0);
      window.__cutReady = true;

      let raf = 0;
      if (autoplay) {
        const start = performance.now();
        let busy = false;
        const tick = async (now: number) => {
          if (!busy) {
            busy = true;
            await applyAt((((now - start) / 1000) % SECONDS));
            busy = false;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        delete window.__cutSet;
        delete window.__cutReady;
        for (const v of videos) v.pause();
        root.innerHTML = "";
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
    // `format` covers w, h, safe, the word scale, the card and the picture, so
    // it is the only dependency the effect actually has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, autoplay, seam]);

  return (
    <div
      ref={rootRef}
      data-cut-stage
      style={{ position: "relative", width: w, height: h, background: "#08090d", overflow: "hidden" }}
    />
  );
}
