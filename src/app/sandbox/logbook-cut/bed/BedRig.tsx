"use client";

// SANDBOX - the five beds, played against THE CUT, on one clock. DEV ONLY.
//
// WHY THIS EXISTS AND WHY IT IS NOT src/app/sandbox/bed.
//
// That rig auditions a bed against a DRAWING of its own grid: a waveform, four
// marker lines, a playhead. It answers "is the arrangement right". It cannot
// answer the only question left here, which is whether the PICTURE and the BED
// hit together - and that question cannot be answered by two things running
// side by side, because a tenth of a second of drift between them is inaudible
// as a description and obvious as a miss.
//
// So the film and the bed share ONE clock, and it is the AUDIO's clock. Scene
// time is read off `AudioContext.currentTime`, never off `performance.now()`:
// a rAF loop and an audio buffer drift apart by whole frames over ten seconds,
// and on a loop that drift accumulates until the words are visibly late. The
// picture follows the sound; the sound is never asked to follow the picture.
//
// THREE THINGS THIS RIG MEASURES THAT LISTENING ALONE CANNOT:
//
//  1. OUTPUT LATENCY IS REAL AND IT IS NOT ZERO. What you HEAR now left the
//     graph `ctx.outputLatency` seconds ago; what you SEE now is on screen now.
//     Unnulled, that offset is 10-50ms of picture-early, which is 0.3 to 1.5
//     frames at 30 - the same order as the deliberate pre-roll, so it would sit
//     underneath every judgement made here. The default nudge is minus the
//     measured latency, and it is adjustable because a display has its own.
//
//  2. THE PICTURE IS SUPPOSED TO BE EARLY. `preRoll` 0.1 - three frames at 30 -
//     is the whole-cut constant, and a word landing exactly on the downbeat is
//     measurably correct and reads late. The waveform therefore carries TWO
//     sets of marks: gold where the bed hits, blue where the WORD lands. If a
//     word settles on the blue line, it is right. Judging against the gold one
//     would fail a correct cut.
//
//  3. THE WEIGHT CURVE, RE-MEASURED IN THE BROWSER. `landing_peaks()` in
//     tools/logbook-bed.py prints the peak in a 0.25s window at all six events
//     on every render, because the curve 0.55/0.78/0.70/1.00 IS the design and
//     a kit whose third landing out-peaks its second has inverted the climb.
//     The same definition runs here on the decoded buffer, normalised to the
//     PATCH landing so the numbers are directly comparable to the curve, and
//     the checks are stated as pass/fail rather than left to be spotted.
//
// THE GRID CLICK TRACK is the ear's version of the marker lines: a blip on each
// of the six events, sample-accurate because it is one pre-rendered buffer
// started against the same anchor rather than a scheduler. A bed that sounds
// early against it IS early.
//
// The WAVs are copied to public/_capture/ (gitignored) by hand - see the page.
//
// ASCII only.

import { useCallback, useEffect, useRef, useState } from "react";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { THE_CUT } from "../assembly";

const SECONDS = 10;
const FPS = 30;
const FRAME = 1 / FPS;
/** The whole-cut picture lead, read off the picked cut rather than typed. */
const PRE = THE_CUT().tuning.preRoll ?? 0;

type Ev = {
  at: number;
  label: string;
  /** Where the curve says this landing should sit, relative to PATCH. */
  target?: number;
  /** True for the four downbeat landings, which is what `preRoll` applies to. */
  word?: boolean;
};

/** The six events, in the order the film has them. Targets are the inherited
 *  weight curve; the pickup and the plating are not on it - one is a cause and
 *  the other is a payoff, and neither is a landing. */
const EVENTS: Ev[] = [
  { at: 1.5, label: "answer" },
  { at: 2.0, label: "LEARN", target: 0.55, word: true },
  { at: 4.0, label: "GAIN", target: 0.78, word: true },
  { at: 6.0, label: "RANK", target: 0.7, word: true },
  { at: 8.0, label: "PATCH", target: 1.0, word: true },
  { at: 8.5, label: "plate" },
];

export type BedKit = {
  id: string;
  title: string;
  note: string;
  /** Heading printed above the first entry carrying it. Two axes are on this
   *  page and they must not read as one flat menu - see the list below. */
  group?: string;
};

// Narrower than it was, to buy the picker a column. The frame still reads at
// 720 and `w` is passed to LogbookLive so its fit-to-frame maths matches the
// pixels rather than a remembered number.
const W = 720;
const WAVE_H = 96;

/** Peak in a 0.25s window at each event - the browser's copy of the Python
 *  `landing_peaks()`, deliberately the same definition so the two agree. */
function peaksOf(buf: AudioBuffer) {
  const ch = buf.getChannelData(0);
  const sr = buf.sampleRate;
  return EVENTS.map((e) => {
    let m = 0;
    const i1 = Math.min(ch.length, Math.floor((e.at + 0.25) * sr));
    for (let i = Math.floor(e.at * sr); i < i1; i += 1) {
      const v = Math.abs(ch[i]);
      if (v > m) m = v;
    }
    return m;
  });
}

/** The six checks the curve implies, stated so a failure is read rather than
 *  noticed. `relay` fails the first one, which is the open defect. */
function checksOf(p: number[]) {
  const [answer, learn, gain, rank, patch, plate] = p;
  return [
    { id: "learn < gain", ok: learn < gain, note: "the climb's first step" },
    { id: "rank < gain", ok: rank < gain, note: "the deliberate dip" },
    { id: "patch highest", ok: patch >= Math.max(answer, learn, gain, rank, plate), note: "the heaviest landing" },
    { id: "answer < learn", ok: answer < learn, note: "a pickup, not a fifth landing" },
    { id: "plate < patch", ok: plate < patch, note: "somewhere left to go" },
  ];
}

/** Rms distance from the design curve, over the four landings. The single
 *  number the picker shows, because it is the whole judgement this rig makes. */
function curveErr(p: number[]) {
  const patch = p[4] || 1;
  let sum = 0;
  let n = 0;
  EVENTS.forEach((e, i) => {
    if (e.target === undefined) return;
    const d = p[i] / patch - e.target;
    sum += d * d;
    n += 1;
  });
  return Math.sqrt(sum / Math.max(1, n));
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function BedRig({
  kits,
  lesson,
  question,
}: {
  kits: BedKit[];
  lesson: FilmLesson;
  question: FilmQuestion;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufs = useRef<Record<string, AudioBuffer>>({});
  const bedSrc = useRef<AudioBufferSourceNode | null>(null);
  const clickSrc = useRef<AudioBufferSourceNode | null>(null);
  const clickBuf = useRef<AudioBuffer | null>(null);
  /** ctx.currentTime at which scene time was `anchorT`. The whole clock. */
  const anchorCtx = useRef(0);
  const anchorT = useRef(0);
  const rafRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** In-flight decodes, so a click and the background sweep cannot fetch the
   *  same 960 KB twice. */
  const inflight = useRef<Map<string, Promise<void>>>(new Map());
  /** Read inside the rAF, so changing the nudge does not restart the audio. */
  const offRef = useRef(0);

  const [kit, setKit] = useState<string>(kits[0]?.id ?? "");
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [clicks, setClicks] = useState(false);
  /** ONE piece of state, not two, because they are set together from one
   *  external reading and two setState calls in one effect is two cascading
   *  renders for a pair of numbers that are never independent at birth. */
  const [av, setAv] = useState<{ lat: number | null; off: number }>({ lat: null, off: 0 });
  const offsetMs = av.off;
  const latencyMs = av.lat;

  useEffect(() => {
    offRef.current = offsetMs / 1000;
  }, [offsetMs]);

  // THE FILM IS A DEEP-SPACE DELIVERABLE, so the page is pinned dark while it
  // is open and put back on the way out. The light overrides live at
  // `:root[data-theme]` and a wrapper cannot scope them, so this is the same
  // reach the sandbox ThemeToggle makes. Without it a browser set to light
  // renders the cut on cream - a perfectly correct render of a picture that
  // will never exist, and every timing judgement made against it is made
  // against the wrong contrast.
  useEffect(() => {
    const el = document.documentElement;
    const was = el.dataset.theme;
    el.dataset.theme = "dark";
    return () => {
      if (was === undefined) delete el.dataset.theme;
      else el.dataset.theme = was;
    };
  }, []);

  // ---- load ----------------------------------------------------------------

  /** Decode one candidate, at most once, whoever asks first. Both the
   *  background sweep and a click land here, so a clicked-but-undecoded
   *  candidate is fetched immediately instead of waiting its turn. */
  const ensure = useCallback(async (id: string) => {
    const ctx = ctxRef.current;
    if (!ctx || bufs.current[id]) return;
    const flight = inflight.current;
    if (flight.has(id)) return flight.get(id);
    const job = (async () => {
      try {
        const res = await fetch(`/_capture/logbook-beds/${id}.wav`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        bufs.current[id] = buf;
        setPeaks((p) => ({ ...p, [id]: peaksOf(buf) }));
        setReady((r) => ({ ...r, [id]: true }));
      } catch {
        /* a candidate that will not decode stays unplayable and says so */
      } finally {
        flight.delete(id);
      }
    })();
    flight.set(id, job);
    return job;
  }, []);

  useEffect(() => {
    let dead = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // THE NUDGE STARTS AT MINUS THE MEASURED LATENCY. `outputLatency` is not
    // implemented everywhere; `baseLatency` is the floor and is, so fall back
    // to it rather than to zero - zero is the one value that is certainly wrong.
    const lat = (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the latency IS a property of an external system created here, read once at construction; there is no store to subscribe to
    setAv({ lat, off: -Math.round(lat) });

    // The grid, as one pre-rendered buffer. A blip per event: brighter and
    // longer on the four landings, so the pickup and the plating are audible
    // as the different things they are.
    const cb = ctx.createBuffer(1, Math.round(SECONDS * ctx.sampleRate), ctx.sampleRate);
    const cd = cb.getChannelData(0);
    for (const e of EVENTS) {
      const f = e.word ? 3000 : 1800;
      const dur = e.word ? 0.05 : 0.03;
      const n = Math.round(dur * ctx.sampleRate);
      const i0 = Math.round(e.at * ctx.sampleRate);
      for (let i = 0; i < n; i += 1) {
        cd[i0 + i] +=
          Math.sin((2 * Math.PI * f * i) / ctx.sampleRate) *
          Math.exp(-i / (n * 0.28)) *
          (e.word ? 0.5 : 0.32);
      }
    }
    clickBuf.current = cb;

    // A BACKGROUND SWEEP, NOT A GATE. Thirty-odd candidates at ~960 KB each is
    // thirty megabytes and thirty decodes; waiting for all of them before the
    // page is usable would make the first click take half a minute. So this
    // walks the list quietly to fill in every curve number, and `ensure()`
    // below jumps the queue for whatever gets clicked.
    void (async () => {
      for (const k of kits) {
        if (dead) return;
        await ensure(k.id);
      }
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(rafRef.current);
      void ctx.close();
    };
  }, [kits, ensure]);

  // ---- the waveform --------------------------------------------------------

  const draw = useCallback((id: string) => {
    const c = canvasRef.current;
    const buf = bufs.current[id];
    if (!c || !buf) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = W * dpr;
    c.height = WAVE_H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, WAVE_H);

    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue("--color-command-gold").trim() || "#c8963e";
    const blue = css.getPropertyValue("--color-signal-blue").trim() || "#4a8fff";
    const border = css.getPropertyValue("--color-panel-border").trim() || "#3a3f50";
    const x = (s: number) => Math.round((s * W) / SECONDS) + 0.5;

    g.strokeStyle = border;
    g.lineWidth = 1;
    for (let b = 0; b <= SECONDS; b += 0.5) {
      g.globalAlpha = b % 2 === 0 ? 1 : 0.35;
      g.beginPath();
      g.moveTo(x(b), 0);
      g.lineTo(x(b), WAVE_H);
      g.stroke();
    }
    g.globalAlpha = 1;

    const ch = buf.getChannelData(0);
    const per = ch.length / W;
    g.fillStyle = gold;
    for (let px = 0; px < W; px += 1) {
      let lo = 0;
      let hi = 0;
      for (let i = Math.floor(px * per); i < Math.floor((px + 1) * per); i += 1) {
        const v = ch[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const y0 = WAVE_H / 2 - hi * (WAVE_H / 2) * 0.94;
      g.fillRect(px, y0, 1, Math.max(1, WAVE_H / 2 - lo * (WAVE_H / 2) * 0.94 - y0));
    }

    // Where the BED hits.
    g.strokeStyle = gold;
    g.lineWidth = 1.5;
    for (const e of EVENTS) {
      g.globalAlpha = e.word ? 1 : 0.5;
      g.beginPath();
      g.moveTo(x(e.at), 0);
      g.lineTo(x(e.at), WAVE_H);
      g.stroke();
    }

    // Where the WORD lands - three frames earlier, on purpose. Dashed, because
    // it is an instruction about the picture and not a feature of the audio.
    g.globalAlpha = 1;
    g.strokeStyle = blue;
    g.setLineDash([3, 3]);
    for (const e of EVENTS) {
      if (!e.word) continue;
      g.beginPath();
      g.moveTo(x(e.at - PRE), 0);
      g.lineTo(x(e.at - PRE), WAVE_H);
      g.stroke();
    }
    g.setLineDash([]);
  }, []);

  useEffect(() => {
    if (ready[kit]) draw(kit);
  }, [kit, ready, draw]);

  // ---- transport -----------------------------------------------------------

  const stopNodes = useCallback(() => {
    for (const r of [bedSrc, clickSrc]) {
      if (!r.current) continue;
      try {
        r.current.stop();
      } catch {
        /* already stopped */
      }
      r.current.disconnect();
      r.current = null;
    }
  }, []);

  /** Start both sources at the same instant, from a SCENE time. One `when` for
   *  both, a hair in the future, or they start on different ticks.
   *
   *  THE NUDGE IS TAKEN OFF HERE AND ONLY HERE. Scene time is audio position
   *  PLUS the nudge, so seeking to a scene time means starting the buffer at
   *  scene minus nudge - and doing that conversion at each call site is how one
   *  of them ends up applying it twice, which reads as "the nudge does nothing
   *  until you press play again". */
  const startAt = useCallback(
    (scene: number, withClicks: boolean, id: string) => {
      const ctx = ctxRef.current;
      const buf = bufs.current[id];
      if (!ctx) return;
      stopNodes();
      void ctx.resume();
      const when = ctx.currentTime + 0.06;
      const at = mod(scene - offRef.current, SECONDS);

      if (buf) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(ctx.destination);
        s.start(when, at);
        bedSrc.current = s;
      }
      if (withClicks && clickBuf.current) {
        const s = ctx.createBufferSource();
        s.buffer = clickBuf.current;
        s.loop = true;
        s.connect(ctx.destination);
        s.start(when, at);
        clickSrc.current = s;
      }
      anchorCtx.current = when;
      anchorT.current = at;
    },
    [stopNodes],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopNodes();
    setPlaying(false);
  }, [stopNodes]);

  const play = useCallback(
    (from: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      startAt(from, clicks, kit);
      // `anchorT` is the AUDIO position startAt just set; the nudge is added
      // back below, per frame, so moving the slider mid-play slides the picture
      // without touching the sound.
      setPlaying(true);
      let last = -Infinity;
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        // 30fps, the rate the film is rendered at, so the preview samples the
        // same clock the deliverable will.
        if (now - last < 1000 / FPS - 1) return;
        last = now;
        const elapsed = ctx.currentTime - anchorCtx.current;
        // Before `when` the sources have not started; hold the first frame
        // rather than showing the tail of the previous lap.
        setT(mod(anchorT.current + Math.max(0, elapsed) + offRef.current, SECONDS));
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [clicks, kit, startAt],
  );

  /** Swap kit WITHOUT restarting the film. The whole point of the rig: the same
   *  moment of picture, two beds, one after the other. */
  const pick = useCallback(
    (id: string) => {
      setKit(id);
      const go = () => {
        if (playing) startAt(t, clicks, id);
      };
      // Already decoded: swap on this frame, which is the whole point of the
      // rig. Not yet: jump it to the front of the queue and swap when it lands.
      if (bufs.current[id]) go();
      else void ensure(id).then(go);
    },
    [playing, startAt, t, clicks, ensure],
  );

  const toggleClicks = useCallback(() => {
    const next = !clicks;
    setClicks(next);
    if (playing) startAt(t, next, kit);
  }, [clicks, playing, startAt, t, kit]);

  /** Seeking always stops. A scrub restarting the buffer sixty times a second
   *  is a machine gun, not a seek. */
  const seek = useCallback(
    (to: number) => {
      if (playing) stop();
      setT(mod(to, SECONDS));
    },
    [playing, stop],
  );

  useEffect(() => stop, [stop]);

  // ---- chrome --------------------------------------------------------------

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold " +
    "hover:text-deep-space disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-command-gold";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";
  const small =
    "rounded border border-panel-border px-2 py-1 font-mono text-[10px] uppercase " +
    "tracking-[0.14em] text-muted transition-colors hover:border-command-gold hover:text-command-gold";

  const p = peaks[kit];
  const patchPeak = p?.[4] || 1;
  const rel = p ? p.map((v) => v / patchPeak) : null;
  const checks = rel ? checksOf(rel) : null;
  const failed = checks?.filter((c) => !c.ok) ?? [];
  const current = kits.find((k) => k.id === kit);

  return (
    // TWO COLUMNS, AND THE LEFT ONE STICKS. With thirty-odd candidates the old
    // single column put the picker below the fold, so choosing meant scrolling
    // away from the only thing that can answer the question - you were picking
    // a bed by reading about it. The frame, the transport and the waveform now
    // stay put while the list scrolls beside them.
    //
    // The prose moved with it: a note renders only for the SELECTED entry, under
    // the frame. Thirty paragraphs stacked in a list is not a menu, and the note
    // is wanted at the moment you are listening rather than while scanning.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_292px] lg:items-start">
      <div className="lg:sticky lg:top-4">
        <div className="border border-panel-border/50" style={{ maxWidth: W }}>
          <LogbookLive
            arrangement="quiet"
            lesson={lesson}
            libraryTotal={0}
            libraryDone={0}
            questions={[question]}
            tuning={THE_CUT().tuning}
            fixedT={t}
            w={W}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5" style={{ maxWidth: W }}>
          <button
            type="button"
            className={playing ? btnOn : btn}
            disabled={!ready[kit]}
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
          <span className="font-numeral text-sm tabular-nums text-command-gold">
            {t.toFixed(3)}s
          </span>
          <button
            type="button"
            className={clicks ? btnOn : small}
            onClick={toggleClicks}
            title="A blip on each of the six events. The ear's version of the marker lines."
          >
            Grid
          </button>
          {EVENTS.map((e) => (
            <button
              key={e.label}
              type="button"
              className={small}
              // A quarter second BEFORE the event, so a jump shows the approach
              // rather than the aftermath.
              onClick={() => seek(e.at - 0.25)}
              title={`jump to ${e.at.toFixed(1)}s`}
            >
              {e.label}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={0}
          max={SECONDS}
          step={FRAME}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          className="mt-2 w-full accent-command-gold"
          style={{ maxWidth: W }}
          aria-label="scrub"
        />

        <div className="mt-2 overflow-x-auto" style={{ maxWidth: W }}>
          <div className="relative" style={{ width: W, height: WAVE_H }}>
            <canvas ref={canvasRef} style={{ width: W, height: WAVE_H, display: "block" }} />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gold-light"
              style={{
                transform: `translateX(${(t / SECONDS) * W}px)`,
                boxShadow: "0 0 6px var(--color-gold-light)",
              }}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2" style={{ maxWidth: W }}>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            nudge
          </span>
          <input
            type="range"
            min={-120}
            max={120}
            step={1}
            value={offsetMs}
            onChange={(e) => setAv((a) => ({ ...a, off: Number(e.target.value) }))}
            className="w-36 accent-signal-blue"
            aria-label="audio video nudge"
          />
          <span className="font-numeral text-sm tabular-nums text-signal-blue">
            {offsetMs > 0 ? "+" : ""}
            {offsetMs} ms
          </span>
          <button
            type="button"
            className={small}
            onClick={() => setAv((a) => ({ ...a, off: -Math.round(a.lat ?? 0) }))}
          >
            &minus;latency
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">
            <span className="text-command-gold">gold</span> = bed hits &middot;{" "}
            <span className="text-signal-blue">blue</span> = word lands{" "}
            {Math.round(PRE * FPS)}f earlier
          </span>
        </div>

        {/* The selected candidate, and only it: prose and numbers together. */}
        <div className="mt-4 border-t border-panel-border/60 pt-3" style={{ maxWidth: W }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="title-card">{current?.title ?? kit}</p>
            {rel ? (
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                  failed.length ? "text-danger-coral" : "text-status-green"
                }`}
              >
                {failed.length
                  ? `${failed.length} fail: ${failed.map((c) => c.id).join(", ")}`
                  : "curve clean"}
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                decoding&hellip;
              </span>
            )}
            {rel ? (
              <span className="font-mono text-[11px] tabular-nums text-muted">
                {EVENTS.map((e, i) => `${e.label} ${rel[i].toFixed(2)}`).join("   ")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{current?.note}</p>
        </div>
      </div>

      {/* ---- the picker ---- */}
      <div className="lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
        {kits.map((k, i) => {
          const kp = peaks[k.id];
          const kerr = kp ? curveErr(kp) : null;
          const bad = kp ? checksOf(kp.map((v) => v / (kp[4] || 1))).filter((c) => !c.ok) : [];
          const head = k.group && k.group !== kits[i - 1]?.group ? k.group : null;
          const on = kit === k.id;
          return (
            <div key={k.id}>
              {head ? (
                <p className="mt-4 border-t border-panel-border/50 pb-1 pt-3 font-mono text-[9px] uppercase leading-tight tracking-[0.16em] text-signal-blue">
                  {head}
                </p>
              ) : null}
              {/* NOT DISABLED WHILE UNDECODED. Disabling it was the obvious
                  thing and it is wrong here: the sweep fills in from the top,
                  so the entries a listener most wants to reach - the newest
                  ones, at the bottom - would be the last to become clickable.
                  A click jumps the queue instead. */}
              <button
                type="button"
                onClick={() => pick(k.id)}
                className={`flex w-full items-baseline justify-between gap-2 rounded border px-2 py-1 text-left transition-colors ${
                  on
                    ? "border-command-gold bg-command-gold/15"
                    : "border-transparent hover:border-panel-border"
                } ${ready[k.id] ? "" : "opacity-60"}`}
              >
                <span
                  className={`truncate font-mono text-[11px] uppercase tracking-[0.08em] ${
                    on ? "text-command-gold" : "text-text"
                  }`}
                >
                  {k.title}
                </span>
                {/* THE ONE NUMBER WORTH SEEING WHILE SCANNING. Curve error is the
                    whole judgement this rig makes, so it is the only thing in the
                    row besides the name - coloured rather than explained, because
                    a menu is for choosing and the reading happens on the left. */}
                <span
                  className={`shrink-0 font-mono text-[10px] tabular-nums ${
                    kerr === null
                      ? "text-gray-3"
                      : bad.length
                        ? "text-danger-coral"
                        : kerr < 0.05
                          ? "text-status-green"
                          : "text-muted"
                  }`}
                >
                  {kerr === null ? "···" : kerr.toFixed(3)}
                  {bad.length ? " !" : ""}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

