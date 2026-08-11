"use client";

// SANDBOX — watch the 10 s cut and swap the track under it. DEV ONLY.
//
// SAME PICTURE, DIFFERENT BED. Every file here was muxed from ONE render of 300
// frames, so switching kit changes only the audio. That matters for judging:
// any difference you hear is the arrangement, not a re-render that drifted.
//
// Switching preserves currentTime and playing state, because losing your place
// every time you compare two tracks makes them impossible to compare.

import { useCallback, useEffect, useRef, useState } from "react";

const SECONDS = 10;
const BAR = 2;
const FPS = 30;
const LANDINGS = [
  { t: 2, word: "DESIGN." },
  { t: 4, word: "BUILD." },
  { t: 6, word: "LEARN." },
  { t: 8, word: "EARN." },
];

export type CutKit = { id: string; title: string; family: string; note: string };

export function CutViewer({ kits }: { kits: CutKit[] }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef(0);
  const [kit, setKit] = useState(kits[0].id);
  const [playing, setPlaying] = useState(false);
  const resume = useRef<{ t: number; play: boolean }>({ t: 0, play: false });

  // Keep place across a source swap.
  const swap = useCallback((id: string) => {
    const v = vidRef.current;
    resume.current = { t: v?.currentTime ?? 0, play: !v?.paused };
    setKit(id);
  }, []);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onLoaded = () => {
      v.currentTime = resume.current.t;
      if (resume.current.play) void v.play();
    };
    v.addEventListener("loadeddata", onLoaded, { once: true });
    v.load();
    return () => v.removeEventListener("loadeddata", onLoaded);
  }, [kit]);

  useEffect(() => {
    const tick = () => {
      const v = vidRef.current;
      if (v) {
        const t = v.currentTime % SECONDS;
        if (headRef.current) headRef.current.style.left = `${(t / SECONDS) * 100}%`;
        if (clockRef.current) {
          clockRef.current.textContent =
            `${t.toFixed(2)}s · bar ${Math.floor(t / BAR) + 1}/5 · frame ${Math.round(t * FPS)}`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const seek = (t: number) => {
    const v = vidRef.current;
    if (v) v.currentTime = Math.min(Math.max(t, 0), SECONDS - 1 / FPS);
  };
  const step = (frames: number) => {
    const v = vidRef.current;
    if (!v) return;
    void v.pause();
    seek(v.currentTime + frames / FPS);
  };

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";

  const families = [...new Set(kits.map((k) => k.family))];

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- no dialogue */}
      <video
        ref={vidRef}
        data-cut
        src={`/_capture/cuts/${kit}.mp4`}
        loop
        playsInline
        controls={false}
        className="block w-full bg-deep-space"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* The bar grid, with the four words where they land. */}
      <div className="relative mt-3 h-9 border-t border-panel-border/60">
        <div ref={headRef} className="absolute inset-y-0 w-px bg-gold-light" style={{ left: 0 }} />
        {[1, 2, 3, 4].map((b) => (
          <div
            key={b}
            className="absolute inset-y-0 w-px bg-signal-blue/30"
            style={{ left: `${((b * BAR) / SECONDS) * 100}%` }}
          />
        ))}
        {LANDINGS.map((l) => (
          <button
            key={l.word}
            type="button"
            onClick={() => seek(l.t)}
            className="absolute top-1 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.18em] text-signal-blue hover:text-gold-light"
            style={{ left: `${(l.t / SECONDS) * 100}%` }}
          >
            {l.word}
          </button>
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={SECONDS}
        step={1 / FPS}
        aria-label="Scrub the cut"
        data-scrub
        className="mt-1 w-full accent-command-gold"
        onInput={(e) => {
          void vidRef.current?.pause();
          seek(Number((e.target as HTMLInputElement).value));
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={playing ? btnOn : btn}
          onClick={() => {
            const v = vidRef.current;
            if (!v) return;
            if (v.paused) void v.play();
            else v.pause();
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => step(-1)}>
          &lt; frame
        </button>
        <button type="button" className={btn} onClick={() => step(1)}>
          frame &gt;
        </button>
        <button type="button" className={btn} onClick={() => seek(0)}>
          Top
        </button>
        <span ref={clockRef} className="ml-2 font-mono text-[10px] tabular-nums tracking-[0.16em] text-gray-3" />
      </div>

      {families.map((f) => (
        <div key={f} className="mt-4 flex flex-wrap items-center gap-2">
          <span className="w-24 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{f}</span>
          {kits
            .filter((k) => k.family === f)
            .map((k) => (
              <button
                key={k.id}
                type="button"
                data-kit={k.id}
                title={k.note}
                className={kit === k.id ? btnOn : btn}
                onClick={() => swap(k.id)}
              >
                {k.title}
              </button>
            ))}
        </div>
      ))}
      <p className="mt-3 font-serif text-sm text-muted">{kits.find((k) => k.id === kit)?.note}</p>
    </div>
  );
}
