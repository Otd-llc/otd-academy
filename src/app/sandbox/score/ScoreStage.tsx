"use client";

// SANDBOX — the cut against any of 36 tracks. DEV ONLY.
//
// ONE SILENT PICTURE, MANY TRACKS. Muxing every option into its own mp4 would be
// 36 copies of the same 3 MB render for 36 different 240 kB tracks. The video
// loads once and the audio is swapped under it, so switching is instant and the
// picture provably cannot differ between options.
//
// AUDIO IS THE CLOCK, VIDEO FOLLOWS. A <video> and an <audio> played together
// drift, and on a beat-driven cut drift is the one thing that ruins the
// judgement being made. The track runs through Web Audio, whose currentTime is
// sample-accurate, and the video is corrected toward it whenever it strays more
// than a frame and a half. Correcting EVERY frame would stutter; correcting on
// a threshold holds sync without touching currentTime most frames.

import { useCallback, useEffect, useRef, useState } from "react";

const SECONDS = 10;
const BAR = 2;
const FPS = 30;
/** Snap the picture back once it is more than ~1.5 frames adrift. */
const DRIFT = 0.05;
const WORDS = [
  { t: 2, word: "DESIGN." },
  { t: 4, word: "BUILD." },
  { t: 6, word: "LEARN." },
  { t: 8, word: "EARN." },
];

export type Track = { id: string; title: string; note: string };
export type Group = { id: string; label: string; tracks: Track[] };

export function ScoreStage({ groups }: { groups: Group[] }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const bufs = useRef<Record<string, AudioBuffer>>({});
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startedAt = useRef(0);
  const rafRef = useRef(0);

  const all = groups.flatMap((g) => g.tracks);
  const [track, setTrack] = useState(all[0].id);
  const [playing, setPlaying] = useState(false);
  const [decoded, setDecoded] = useState<ReadonlySet<string>>(() => new Set());
  const loaded = decoded.size;
  // Latest-value ref, written AFTER commit. The audio graph is built once and
  // its callbacks outlive any single render, so they need the current track;
  // writing during render is what was wrong, not the ref.
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    gainRef.current = g;
    let dead = false;
    void (async () => {
      for (const t of all) {
        try {
          const r = await fetch(`/_capture/jingles/${t.id}.mp3`);
          const b = await ctx.decodeAudioData(await r.arrayBuffer());
          if (dead) return;
          bufs.current[t.id] = b;
          // WHICH ids decoded, not just HOW MANY. The buttons disable
          // themselves until their own buffer exists, and they were reading
          // `bufs.current` during render to decide - a ref read in render,
          // which is also simply wrong: a ref mutation does not re-render, so
          // a button only ever un-disabled as a side effect of some OTHER
          // track's count bumping this state. State carries the same fact and
          // makes the button update when its own track is ready.
          setDecoded((s) => (s.has(t.id) ? s : new Set(s).add(t.id)));
        } catch {
          /* a track that will not decode stays unplayable */
        }
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(rafRef.current);
      void ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the track list is static
  }, []);

  const stopAudio = useCallback(() => {
    if (srcRef.current) {
      try {
        srcRef.current.stop();
      } catch {
        /* already stopped */
      }
      srcRef.current.disconnect();
      srcRef.current = null;
    }
  }, []);

  /** Start (or restart) the track at `offset`, and slave the video to it. */
  const startAudio = useCallback(
    (id: string, offset: number) => {
      const ctx = ctxRef.current;
      const buf = bufs.current[id];
      if (!ctx || !buf || !gainRef.current) return;
      stopAudio();
      void ctx.resume();
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(gainRef.current);
      s.start(0, offset % SECONDS);
      srcRef.current = s;
      startedAt.current = ctx.currentTime - (offset % SECONDS);
    },
    [stopAudio],
  );

  useEffect(() => {
    const tick = () => {
      const ctx = ctxRef.current;
      const v = vidRef.current;
      if (ctx && v) {
        const t = srcRef.current ? (ctx.currentTime - startedAt.current) % SECONDS : v.currentTime % SECONDS;
        if (srcRef.current && !v.paused && Math.abs(v.currentTime % SECONDS - t) > DRIFT) {
          v.currentTime = t;
        }
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

  const play = useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    startAudio(trackRef.current, v.currentTime % SECONDS);
    void v.play();
    setPlaying(true);
  }, [startAudio]);

  const pause = useCallback(() => {
    vidRef.current?.pause();
    stopAudio();
    setPlaying(false);
  }, [stopAudio]);

  /** Swap the track without losing the bar you are listening to. */
  const swap = useCallback(
    (id: string) => {
      setTrack(id);
      trackRef.current = id;
      const v = vidRef.current;
      if (playing && v) startAudio(id, v.currentTime % SECONDS);
    },
    [playing, startAudio],
  );

  const seek = (t: number) => {
    const v = vidRef.current;
    if (!v) return;
    const x = Math.min(Math.max(t, 0), SECONDS - 1 / FPS);
    v.currentTime = x;
    if (playing) startAudio(trackRef.current, x);
  };

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";

  const current = all.find((t) => t.id === track);

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- no dialogue */}
      <video
        ref={vidRef}
        data-score
        src="/_capture/cuts/silent.mp4"
        muted
        loop
        playsInline
        className="block w-full bg-deep-space"
      />

      <div className="relative mt-3 h-9 border-t border-panel-border/60">
        <div ref={headRef} data-head className="absolute inset-y-0 w-px bg-gold-light" style={{ left: 0 }} />
        {[1, 2, 3, 4].map((b) => (
          <div
            key={b}
            className="absolute inset-y-0 w-px bg-signal-blue/30"
            style={{ left: `${((b * BAR) / SECONDS) * 100}%` }}
          />
        ))}
        {WORDS.map((w) => (
          <button
            key={w.word}
            type="button"
            onClick={() => seek(w.t)}
            className="absolute top-1 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.18em] text-signal-blue hover:text-gold-light"
            style={{ left: `${(w.t / SECONDS) * 100}%` }}
          >
            {w.word}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={playing ? btnOn : btn} onClick={() => (playing ? pause() : play())}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => seek(0)}>
          Top
        </button>
        <span ref={clockRef} className="ml-2 font-mono text-[10px] tabular-nums tracking-[0.16em] text-gray-3" />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
          {loaded}/{all.length} decoded
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">{g.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                data-track={t.id}
                title={t.note}
                disabled={!decoded.has(t.id)}
                className={track === t.id ? btnOn : btn}
                onClick={() => swap(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-4 font-serif text-sm text-muted">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
          {current?.title}
        </span>{" "}
        {current?.note}
      </p>
    </div>
  );
}
