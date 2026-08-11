"use client";

// SANDBOX — audition the promo bed against its own beat grid. DEV ONLY.
//
// A bed cannot be judged from a filename and a table of numbers. The numbers
// say the arc is right; only listening says whether it is GOOD. So each kit
// gets its waveform drawn with the four landings marked where they actually
// fall, and a playhead, so what you hear and where it lands are the same
// picture.
//
// The markers are computed from the tempo, never typed in: 120 BPM, four beats
// to a bar, five bars, so the landings are at 2, 4, 6 and 8 seconds and the
// loop is exactly 10.000 s. If a bed ever renders at the wrong length the
// markers will visibly stop lining up with the transients, which is a better
// alarm than an assertion buried in a script.

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const BAR = (60 / BPM) * 4; // 2.000 s
const BARS = 5;
const SECONDS = BAR * BARS; // 10.000 s
const LANDINGS = [
  { bar: 1, word: "DESIGN.", note: "the sheets explode" },
  { bar: 2, word: "BUILD.", note: "collapse hands over to the board" },
  { bar: 3, word: "LEARN.", note: "the exam click" },
  { bar: 4, word: "EARN.", note: "the certificate" },
];

export type Kit = { id: string; title: string; note: string };

const W = 900;
const H = 120;

export function BedAudition({ kits, dir = "beds" }: { kits: Kit[]; dir?: string }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufs = useRef<Record<string, AudioBuffer>>({});
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef(0);
  const startedAt = useRef(0);

  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const heads = useRef<Record<string, HTMLDivElement | null>>({});

  /** Envelope per pixel column, so a 480,000-sample buffer draws in 900 strokes. */
  const draw = useCallback((id: string, buf: AudioBuffer) => {
    const c = canvases.current[id];
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = W * dpr;
    c.height = H * dpr;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);

    const ch = buf.getChannelData(0);
    const per = ch.length / W;
    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue("--color-command-gold").trim() || "#c8963e";
    const blue = css.getPropertyValue("--color-signal-blue").trim() || "#4a8fff";
    const border = css.getPropertyValue("--color-panel-border").trim() || "#3a3f50";

    // Bar lines behind the waveform, so the grid reads as the field it sits on.
    g.strokeStyle = border;
    g.lineWidth = 1;
    for (let b = 0; b <= BARS; b += 1) {
      const x = Math.round((b * BAR * W) / SECONDS) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }

    g.fillStyle = gold;
    for (let x = 0; x < W; x += 1) {
      let lo = 0;
      let hi = 0;
      for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i += 1) {
        const v = ch[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const y0 = H / 2 - hi * (H / 2) * 0.94;
      const y1 = H / 2 - lo * (H / 2) * 0.94;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }

    // The landings on top, in blue: this is data about the audio, not the audio.
    g.strokeStyle = blue;
    g.lineWidth = 1.5;
    for (const l of LANDINGS) {
      const x = Math.round((l.bar * BAR * W) / SECONDS) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
  }, []);

  useEffect(() => {
    let dead = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    void (async () => {
      for (const k of kits) {
        try {
          const res = await fetch(`/_capture/${dir}/${k.id}.mp3`);
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          if (dead) return;
          bufs.current[k.id] = buf;
          draw(k.id, buf);
          setReady((r) => ({ ...r, [k.id]: true }));
        } catch {
          /* a kit that will not decode simply stays unplayable */
        }
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(rafRef.current);
      void ctx.close();
    };
  }, [kits, dir, draw]);

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
    for (const el of Object.values(heads.current)) if (el) el.style.opacity = "0";
    setPlaying(null);
  }, []);

  const play = useCallback(
    (id: string) => {
      const ctx = ctxRef.current;
      const buf = bufs.current[id];
      if (!ctx || !buf) return;
      stop();
      void ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      src.connect(ctx.destination);
      src.start();
      srcRef.current = src;
      startedAt.current = ctx.currentTime;
      setPlaying(id);
      src.onended = () => {
        if (srcRef.current === src) stop();
      };

      const head = heads.current[id];
      const tick = () => {
        if (head) {
          const t = (ctx.currentTime - startedAt.current) % SECONDS;
          head.style.opacity = "1";
          head.style.transform = `translateX(${(t / SECONDS) * W}px)`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [loop, stop],
  );

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={loop ? btnOn : btn} onClick={() => setLoop((v) => !v)}>
          Loop
        </button>
        <button type="button" className={btn} onClick={stop} disabled={!playing}>
          Stop
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {BPM} BPM · bar {BAR.toFixed(1)}s · {BARS} bars · {SECONDS.toFixed(3)}s
        </span>
      </div>

      {/* The word each blue line carries, on the same grid as the canvas. WORD
          ONLY: the landings are 180 px apart and the descriptions ran straight
          through each other, so what should have been a legend read as one
          smeared line of text. The descriptions moved to the list below. */}
      <div className="relative mt-8 hidden sm:block" style={{ width: W, height: 14 }}>
        {LANDINGS.map((l) => (
          <span
            key={l.word}
            className="absolute top-0 border-l border-signal-blue/40 pl-2 font-mono text-[10px] uppercase tracking-[0.2em] text-signal-blue"
            style={{ left: (l.bar * BAR * W) / SECONDS }}
          >
            {l.word}
          </span>
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {LANDINGS.map((l) => (
          <div key={l.word} className="flex items-baseline gap-2">
            <dt className="font-numeral text-sm tabular-nums text-command-gold">
              {(l.bar * BAR).toFixed(1)}s
            </dt>
            <dd className="m-0 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">{l.note}</dd>
          </div>
        ))}
      </dl>

      {kits.map((k) => (
        <section key={k.id} data-kit={k.id} className="mt-10 border-t border-panel-border/60 pt-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <button
              type="button"
              data-play={k.id}
              className={playing === k.id ? btnOn : btn}
              disabled={!ready[k.id]}
              onClick={() => (playing === k.id ? stop() : play(k.id))}
            >
              {playing === k.id ? "Stop" : "Play"}
            </button>
            <span className="title-card">{k.title}</span>
            <span className="font-serif text-sm text-muted">{k.note}</span>
          </div>
          <div className="relative mt-3 overflow-x-auto">
            <div className="relative" style={{ width: W, height: H }}>
              <canvas
                ref={(el) => {
                  canvases.current[k.id] = el;
                }}
                style={{ width: W, height: H, display: "block" }}
              />
              <div
                ref={(el) => {
                  heads.current[k.id] = el;
                }}
                className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gold-light opacity-0"
                style={{ boxShadow: "0 0 6px var(--color-gold-light)" }}
              />
            </div>
          </div>
          {!ready[k.id] ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">decoding…</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
