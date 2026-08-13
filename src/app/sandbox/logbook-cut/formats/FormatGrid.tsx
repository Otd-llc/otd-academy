"use client";

// SANDBOX - the picked cut and the picked bed, in every shape we ship. DEV ONLY.
//
// WHY THIS IS NOT A CROP PREVIEW. The obvious way to check a vertical cut is to
// render 16:9 and letterbox or centre-crop it, and for this film that would be
// worse than useless: every subject is sized by `fitScale(id, w, h)` and the
// type layer places its words in the CORNERS off the same w and h. Crop the
// frame and the words are simply outside it - you would be reviewing a vertical
// cut with the copy missing and concluding the copy needs moving.
//
// So each shape is a real re-frame. `LogbookLive` takes an `aspect` now, the
// fit and the corners resolve against the frame the platform will actually
// show, and what is on screen here is what an encode at that ratio produces.
//
// ONE CLOCK FOR ALL FOUR, and it is the audio's. Four stages on four clocks
// would drift apart within a lap and the whole point is to compare the same
// instant in four shapes.
//
// THE SAFE AREAS ARE APPROXIMATE AND SAY SO. Platform chrome is not published
// as a spec and it moves; the bands drawn here are the commonly-cited ones and
// they are a prompt to look, not a certificate.
//
// ASCII only.

import { useCallback, useEffect, useRef, useState } from "react";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { THE_CUT } from "../assembly";

const SECONDS = 10;
const FPS = 30;
const FRAME = 1 / FPS;
const PRE = THE_CUT().tuning.preRoll ?? 0;
const BED = "/_capture/logbook-beds/comp-k-open-master.wav";

const EVENTS = [
  { at: 1.5, label: "answer" },
  { at: 2.0, label: "LEARN" },
  { at: 4.0, label: "GAIN" },
  { at: 6.0, label: "RANK" },
  { at: 8.0, label: "PATCH" },
  { at: 8.5, label: "plate" },
];

type Fmt = {
  id: string;
  label: string;
  px: string;
  where: string;
  aspect: number;
  w: number;
  /** Fractions of the frame the platform's own chrome tends to cover. */
  safe?: { bottom?: number; right?: number; top?: number };
};

// Widths are display sizes, not delivery sizes - the delivery pixels are in
// `px` and the encode reads those. What matters here is that all four are
// legible side by side.
const FORMATS: Fmt[] = [
  {
    id: "16x9",
    label: "16:9",
    px: "1920 x 1080",
    where: "YouTube, X, LinkedIn, site embed",
    aspect: 16 / 9,
    w: 360,
  },
  {
    id: "1x1",
    label: "1:1",
    px: "1080 x 1080",
    where: "feed square, LinkedIn, X",
    aspect: 1,
    w: 258,
  },
  {
    id: "4x5",
    label: "4:5",
    px: "1080 x 1350",
    where: "Instagram / Facebook feed",
    aspect: 4 / 5,
    w: 238,
    safe: { bottom: 0.06 },
  },
  {
    id: "9x16",
    label: "9:16",
    px: "1080 x 1920",
    where: "Shorts, Reels, TikTok",
    aspect: 9 / 16,
    w: 206,
    // The band a caption block and the action rail tend to occupy. Cited
    // ranges vary and no platform publishes it; these are the common ones.
    safe: { bottom: 0.2, right: 0.13, top: 0.08 },
  },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function FormatGrid({
  lesson,
  question,
}: {
  lesson: FilmLesson;
  question: FilmQuestion;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufRef = useRef<AudioBuffer | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const anchorCtx = useRef(0);
  const anchorT = useRef(0);
  const rafRef = useRef(0);
  const offRef = useRef(0);

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [safe, setSafe] = useState(true);
  const [av, setAv] = useState<{ lat: number | null; off: number }>({ lat: null, off: 0 });

  useEffect(() => {
    offRef.current = av.off / 1000;
  }, [av.off]);

  // The deliverable is deep space; a light root would be a correct render of a
  // picture that will never exist. Same reach the bed rig makes.
  useEffect(() => {
    const el = document.documentElement;
    const was = el.dataset.theme;
    el.dataset.theme = "dark";
    return () => {
      if (was === undefined) delete el.dataset.theme;
      else el.dataset.theme = was;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const lat = (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once off the AudioContext at construction; there is no store to subscribe to
    setAv({ lat, off: -Math.round(lat) });
    void (async () => {
      try {
        const res = await fetch(BED);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (dead) return;
        bufRef.current = buf;
        setReady(true);
      } catch {
        /* stays unplayable and says so */
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(rafRef.current);
      void ctx.close();
    };
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (srcRef.current) {
      try {
        srcRef.current.stop();
      } catch {
        /* already stopped */
      }
      srcRef.current.disconnect();
      srcRef.current = null;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(
    (from: number) => {
      const ctx = ctxRef.current;
      const buf = bufRef.current;
      if (!ctx || !buf) return;
      stop();
      void ctx.resume();
      const when = ctx.currentTime + 0.06;
      const at = mod(from - offRef.current, SECONDS);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(ctx.destination);
      s.start(when, at);
      srcRef.current = s;
      anchorCtx.current = when;
      anchorT.current = at;
      setPlaying(true);
      let last = -Infinity;
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - last < 1000 / FPS - 1) return;
        last = now;
        setT(mod(anchorT.current + Math.max(0, ctx.currentTime - anchorCtx.current) + offRef.current, SECONDS));
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  const seek = useCallback(
    (to: number) => {
      if (playing) stop();
      setT(mod(to, SECONDS));
    },
    [playing, stop],
  );

  useEffect(() => stop, [stop]);

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";
  const small =
    "rounded border border-panel-border px-2 py-1 font-mono text-[10px] uppercase " +
    "tracking-[0.14em] text-muted transition-colors hover:border-command-gold hover:text-command-gold";

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-1.5 border-b border-panel-border/60 bg-deep-space/95 px-4 py-3 sm:-mx-6 sm:px-6">
        <button
          type="button"
          className={playing ? btnOn : btn}
          disabled={!ready}
          onClick={() => (playing ? stop() : play(t))}
        >
          {playing ? "Stop" : "Play"}
        </button>
        <button type="button" className={small} onClick={() => seek(0)}>
          Top
        </button>
        <button type="button" className={small} onClick={() => seek(t - FRAME)}>
          &minus;1f
        </button>
        <button type="button" className={small} onClick={() => seek(t + FRAME)}>
          +1f
        </button>
        <span className="font-numeral text-sm tabular-nums text-command-gold">{t.toFixed(3)}s</span>
        {EVENTS.map((e) => (
          <button key={e.label} type="button" className={small} onClick={() => seek(e.at - PRE)}>
            {e.label}
          </button>
        ))}
        <button
          type="button"
          className={safe ? btnOn : small}
          onClick={() => setSafe((v) => !v)}
          title="Approximate platform chrome. Not a published spec."
        >
          Safe areas
        </button>
        <input
          type="range"
          min={0}
          max={SECONDS}
          step={FRAME}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          className="mt-1 w-full accent-command-gold"
          aria-label="scrub"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-4">
        {FORMATS.map((f) => (
          <figure key={f.id} style={{ width: f.w }}>
            <div className="relative border border-panel-border/50">
              <LogbookLive
                arrangement="quiet"
                lesson={lesson}
                libraryTotal={0}
                libraryDone={0}
                questions={[question]}
                tuning={THE_CUT().tuning}
                fixedT={t}
                w={f.w}
                aspect={f.aspect}
              />
              {safe && f.safe ? (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {(["top", "bottom"] as const).map((side) =>
                    f.safe?.[side] ? (
                      <div
                        key={side}
                        className="absolute inset-x-0"
                        style={{
                          [side]: 0,
                          height: `${(f.safe[side] as number) * 100}%`,
                          background:
                            "repeating-linear-gradient(45deg, rgba(217,122,106,.18) 0 6px, transparent 6px 12px)",
                          borderTop: side === "bottom" ? "1px solid rgba(217,122,106,.5)" : undefined,
                          borderBottom: side === "top" ? "1px solid rgba(217,122,106,.5)" : undefined,
                        }}
                      />
                    ) : null,
                  )}
                  {f.safe.right ? (
                    <div
                      className="absolute inset-y-0 right-0"
                      style={{
                        width: `${f.safe.right * 100}%`,
                        background:
                          "repeating-linear-gradient(45deg, rgba(217,122,106,.18) 0 6px, transparent 6px 12px)",
                        borderLeft: "1px solid rgba(217,122,106,.5)",
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <figcaption className="mt-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold">
                {f.label} <span className="text-gray-3">{f.px}</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {f.where}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
