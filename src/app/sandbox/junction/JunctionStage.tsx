"use client";

// SANDBOX — one junction, ten transitions. DEV ONLY.
//
// PLAYED, NOT SEEKED. The first version awaited a seek on BOTH videos every
// frame, which is what made it unusable: a seek decodes a keyframe and scans
// forward, so it is orders of magnitude dearer than playback and cannot run at
// 30 a second, let alone twice. Continuous playback is hardware-decoded and
// nearly free. The clips now PLAY, a wall clock drives the transition, and the
// only seek is one per loop at the wrap.
//
// This is the opposite of the rule the CUT capture follows, and deliberately.
// An offline render must scrub, because a frame there may take any amount of
// wall time and the picture must not drift. A live preview has the opposite
// constraint: it must keep up. Drift is corrected the way the score viewer does
// it, by nudging the video back only when it strays more than a frame and a half.
//
// TWO VIDEOS, NOT TWENTY. Ten options each with their own pair would be twenty
// decoders. One pair, and the transition is a function applied over them.
//
// OFFSCREEN STAGES PAUSE. Both junctions live on one page; without this, four
// videos decode continuously while you are looking at two of them.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCORE,
  SCORE_SECONDS,
  TRANSITIONS,
  byId,
  nudgeRange,
  progress,
  type Align,
  type Junction,
} from "./transitions";
import { GH, GW, drawGlitch } from "./glitch";

/**
 * Seconds either side of the beat that the loop covers. Wide enough to still
 * show approach and settle when the join is nudged a full bar in either
 * direction, otherwise the nudge pushes the transition off the end of the loop.
 */
const WINDOW = 2.6;
const SPAN = WINDOW * 2;
const FPS = 30;
/** Nudge a video back when it strays more than ~1.5 frames. */
const DRIFT = 0.05;

export function JunctionStage({ junction }: { junction: Junction }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  const rafRef = useRef(0);
  const originRef = useRef(0);
  const tRef = useRef(-WINDOW);
  const playing = useRef(true);
  const visible = useRef(true);
  const tid = useRef(junction.pick);

  const glitchRef = useRef<HTMLCanvasElement>(null);
  const align = useRef<Align>("end");
  const offset = useRef(junction.nudge);
  const frameNo = useRef(0);

  // Audio, and it is the CLOCK when it is on. You cannot nudge a cut onto a
  // beat you cannot hear, and a video clock drifting against the track would
  // make every judgement here wrong by however much it had drifted.
  const actx = useRef<AudioContext | null>(null);
  const buf = useRef<AudioBuffer | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const audioT0 = useRef(0);
  const sound = useRef(false);

  const [ui, setUi] = useState({
    id: junction.pick,
    playing: true,
    align: "end" as Align,
    offset: junction.nudge,
    sound: false,
  });
  const [ready, setReady] = useState(false);

  /**
   * play() returns a promise that REJECTS if anything pauses or re-seeks before
   * it resolves, which the visibility observer and the transition buttons both
   * do routinely. Discarding it with `void` turns that into an unhandled
   * AbortError in the console. It is benign and it is still noise, and noise in
   * the console is how a real error gets missed.
   */
  const start = (v: HTMLVideoElement) => {
    v.play().catch(() => {});
  };

  const clamp = (v: HTMLVideoElement, want: number, lo?: number, hi?: number) => {
    const dur = v.duration || 1;
    return Math.min(Math.max(want, lo ?? 0), Math.min(hi ?? dur - 0.03, dur - 0.03));
  };

  /** Style only. No seeking: this runs every frame. */
  const paint = useCallback(
    (t: number) => {
      const a = aRef.current;
      const b = bRef.current;
      if (!a || !b) return;
      const tr = byId(tid.current);
      // The offset shifts the whole transition against the beat, so "on the
      // beat" can be dialled rather than argued about.
      const tt = t - offset.current;
      const u = progress(tt, tr.half, align.current);
      for (const [side, el] of [["a", a], ["b", b]] as const) {
        const s = tr.style(side, u);
        el.style.opacity = String(s.opacity);
        el.style.transform = s.transform;
        el.style.filter = s.filter;
        el.style.clipPath = s.clipPath;
      }

      const gc = glitchRef.current;
      if (gc) {
        const on = Boolean(tr.glitch) && u > 0 && u < 1;
        gc.style.opacity = on ? "1" : "0";
        if (on && tr.glitch) {
          const ctx = gc.getContext("2d", { alpha: false });
          if (ctx) {
            frameNo.current += 1;
            drawGlitch(ctx, a, b, u, tr.glitch, frameNo.current);
          }
        }
        // Outside the window a glitch transition still has to show A or B;
        // its CSS style returns opacity 0 for both, so hand the shot back.
        if (tr.glitch) {
          a.style.opacity = u <= 0 ? "1" : "0";
          b.style.opacity = u >= 1 ? "1" : "0";
        }
      }

      if (flashRef.current) {
        const near = 1 - Math.min(Math.abs(tt) / (tr.half * 1.6), 1);
        flashRef.current.style.background = tr.flash ?? "transparent";
        flashRef.current.style.opacity = tr.flash ? String(near ** 1.6 * 0.85) : "0";
      }
      if (clockRef.current) {
        clockRef.current.textContent =
          `${t >= 0 ? "+" : ""}${t.toFixed(2)}s from the beat · frame ${Math.round(t * FPS)}`;
      }
      if (scrubRef.current && document.activeElement !== scrubRef.current) {
        scrubRef.current.value = String(t);
      }
    },
    [],
  );

  /** Put both clips where scene time t says, and start or stop them. */
  const place = useCallback(
    (t: number, play: boolean) => {
      const a = aRef.current;
      const b = bRef.current;
      if (!a || !b) return;
      const J = junction;
      a.currentTime = clamp(a, J.a.base + t, J.a.clampFrom, J.a.clampTo);
      b.currentTime = clamp(b, J.b.base + t, J.b.clampFrom, J.b.clampTo);
      if (play) {
        start(a);
        start(b);
      } else {
        a.pause();
        b.pause();
      }
      paint(t);
    },
    [junction, paint],
  );

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    const root = rootRef.current;
    if (!a || !b || !root) return;
    let dead = false;

    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (!e.isIntersecting) {
          a.pause();
          b.pause();
        } else if (playing.current) {
          originRef.current = performance.now() - (tRef.current + WINDOW) * 1000;
          start(a);
          start(b);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(root);

    const wait = (v: HTMLVideoElement) =>
      new Promise<void>((res) => {
        if (v.readyState >= 2) res();
        else v.addEventListener("loadeddata", () => res(), { once: true });
      });

    void Promise.all([wait(a), wait(b)]).then(() => {
      if (dead) return;
      tRef.current = -WINDOW;
      originRef.current = performance.now();
      place(-WINDOW, true);
      setReady(true);

      const tick = (now: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (!playing.current || !visible.current) return;
        // WHEN SOUND IS ON, THE TRACK IS THE CLOCK. Its loop is sample-exact,
        // so reading scene time from it means the picture is positioned against
        // the drum rather than against a wall clock that drifts away from it.
        const ac = actx.current;
        const elapsed =
          sound.current && ac && srcRef.current
            ? (ac.currentTime - audioT0.current) % SPAN
            : (now - originRef.current) / 1000;
        if (elapsed >= SPAN) {
          // One seek per loop, at the wrap. This is the only seek there is.
          originRef.current = now;
          tRef.current = -WINDOW;
          place(-WINDOW, true);
          return;
        }
        const t = elapsed - WINDOW;
        tRef.current = t;
        // Correct drift rather than re-seeking every frame.
        const J = junction;
        const wantA = clamp(a, J.a.base + t, J.a.clampFrom, J.a.clampTo);
        if (Math.abs(a.currentTime - wantA) > DRIFT) a.currentTime = wantA;
        const wantB = clamp(b, J.b.base + t, J.b.clampFrom, J.b.clampTo);
        if (Math.abs(b.currentTime - wantB) > DRIFT) b.currentTime = wantB;
        paint(t);
      };
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      dead = true;
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
      try {
        srcRef.current?.stop();
      } catch {
        /* already stopped */
      }
      void actx.current?.close();
    };
  }, [junction, place, paint]);

  /**
   * Loop the slice of the jingle that surrounds this junction's downbeat.
   *
   * loopStart/loopEnd let one buffer loop a WINDOW around the beat without
   * cutting a separate file, and starting at the same offset means audio scene
   * time and video scene time are the same number from the first sample.
   */
  const startAudio = useCallback(
    (t: number) => {
      const ctx = actx.current;
      const b = buf.current;
      if (!ctx || !b) return;
      srcRef.current?.stop();
      srcRef.current?.disconnect();
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.loop = true;
      s.loopStart = Math.max(0, junction.at - WINDOW);
      s.loopEnd = Math.min(SCORE_SECONDS, junction.at + WINDOW);
      s.connect(ctx.destination);
      s.start(0, junction.at + t);
      srcRef.current = s;
      audioT0.current = ctx.currentTime - (t + WINDOW);
    },
    [junction.at],
  );

  const stopAudio = () => {
    try {
      srcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    srcRef.current?.disconnect();
    srcRef.current = null;
  };

  const toggleSound = async () => {
    if (sound.current) {
      sound.current = false;
      stopAudio();
      setUi((s) => ({ ...s, sound: false }));
      return;
    }
    if (!actx.current) actx.current = new AudioContext();
    const ctx = actx.current;
    await ctx.resume();
    if (!buf.current) {
      const res = await fetch(SCORE);
      buf.current = await ctx.decodeAudioData(await res.arrayBuffer());
    }
    sound.current = true;
    setUi((s) => ({ ...s, sound: true }));
    if (playing.current) startAudio(tRef.current);
  };

  const pause = () => {
    playing.current = false;
    aRef.current?.pause();
    bRef.current?.pause();
    stopAudio();
    setUi((s) => ({ ...s, playing: false }));
  };
  const resume = () => {
    playing.current = true;
    originRef.current = performance.now() - (tRef.current + WINDOW) * 1000;
    place(tRef.current, true);
    if (sound.current) startAudio(tRef.current);
    setUi((s) => ({ ...s, playing: true }));
  };
  const goTo = (t: number) => {
    pause();
    tRef.current = Math.min(Math.max(t, -WINDOW), WINDOW);
    place(tRef.current, false);
  };

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";
  const layer = "absolute inset-0 h-full w-full object-cover";
  const range = nudgeRange(junction);

  return (
    <div ref={rootRef} data-junction={junction.id}>
      <div className="relative overflow-hidden bg-deep-space" style={{ aspectRatio: "16 / 9" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- no dialogue */}
        <video ref={aRef} data-side="a" src={junction.a.src} muted playsInline preload="auto" className={layer} />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- no dialogue */}
        <video ref={bRef} data-side="b" src={junction.b.src} muted playsInline preload="auto" className={layer} />
        <canvas
          ref={glitchRef}
          data-glitch
          width={GW}
          height={GH}
          className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
          style={{ opacity: 0 }}
        />
        <div ref={flashRef} className="pointer-events-none absolute inset-0 z-10" style={{ opacity: 0 }} />
        {!ready ? (
          <span className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
            loading…
          </span>
        ) : null}
      </div>

      <input
        ref={scrubRef}
        type="range"
        min={-WINDOW}
        max={WINDOW}
        step={1 / FPS}
        defaultValue={-WINDOW}
        aria-label={`Scrub ${junction.label}`}
        data-scrub
        className="mt-2 w-full accent-command-gold"
        onInput={(e) => goTo(Number((e.target as HTMLInputElement).value))}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={ui.playing ? btnOn : btn} onClick={() => (ui.playing ? pause() : resume())}>
          {ui.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => goTo(tRef.current - 1 / FPS)}>
          &lt; frame
        </button>
        <button type="button" className={btn} onClick={() => goTo(tRef.current + 1 / FPS)}>
          frame &gt;
        </button>
        <button type="button" className={btn} onClick={() => goTo(0)}>
          On the beat
        </button>
        <button type="button" data-sound className={ui.sound ? btnOn : btn} onClick={() => void toggleSound()}>
          {ui.sound ? "Sound on" : "Sound"}
        </button>
        <span ref={clockRef} className="ml-2 font-mono text-[10px] tabular-nums tracking-[0.16em] text-gray-3" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Align</span>
        {(
          [
            ["end", "Ends on beat"],
            ["centre", "Centred"],
            ["start", "Starts on beat"],
          ] as [Align, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            data-align={k}
            className={ui.align === k ? btnOn : btn}
            onClick={() => {
              align.current = k;
              setUi((s) => ({ ...s, align: k }));
              paint(tRef.current);
            }}
          >
            {label}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Nudge
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={1 / FPS}
            defaultValue={junction.nudge}
            data-offset
            className="w-56 accent-command-gold"
            onInput={(e) => {
              offset.current = Number((e.target as HTMLInputElement).value);
              setUi((s) => ({ ...s, offset: offset.current }));
              paint(tRef.current);
            }}
          />
          <span className="w-14 tabular-nums text-gray-3">
            {ui.offset >= 0 ? "+" : ""}
            {ui.offset.toFixed(2)}s
          </span>
        </label>
        <button
          type="button"
          className={btn}
          onClick={() => {
            offset.current = junction.nudge;
            const el = document.querySelector<HTMLInputElement>(
              `[data-junction='${junction.id}'] [data-offset]`,
            );
            if (el) el.value = String(junction.nudge);
            setUi((s) => ({ ...s, offset: junction.nudge }));
            paint(tRef.current);
          }}
        >
          Reset
        </button>
      </div>
      {/* The limit is FOOTAGE, not the control. Say so, because a frozen
          outgoing shot at the end of the range looks like a broken transition
          rather than the end of the film. */}
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
        footage allows {range.min.toFixed(2)}s to +{range.max.toFixed(2)}s from the beat
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {TRANSITIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-tr={t.id}
            // aria-pressed, not a class check. The inactive style contains
            // `hover:bg-command-gold`, so sniffing the class list for
            // "bg-command-gold" matches every button, active or not.
            aria-pressed={ui.id === t.id}
            title={t.note}
            className={ui.id === t.id ? btnOn : btn}
            onClick={() => {
              tid.current = t.id;
              setUi((s) => ({ ...s, id: t.id }));
              paint(tRef.current);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 max-w-3xl font-serif text-sm text-muted">
        {TRANSITIONS.find((t) => t.id === ui.id)?.note}
      </p>
    </div>
  );
}
