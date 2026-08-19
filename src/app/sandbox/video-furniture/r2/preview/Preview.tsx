"use client";

// AUDITION THE PIECE WITH ITS BED, LIVE. Play it, hear it, swap the bed without
// stopping, and judge motion and sound together -- which is the only way either
// can actually be judged.
//
// WHY THIS EXISTS RATHER THAN MORE RENDERED MP4s. A baked video answers one
// question per render: this picture, this bed. Choosing between a dozen beds
// that way means a dozen encodes and a folder of files to keep straight, and by
// the time the last one renders you have forgotten the first. Here the bed is a
// dropdown and the change is instantaneous, so the comparison is A/B rather than
// A-then-later-B.
//
// THE AUDIO CLOCK IS THE MASTER, and that is the load-bearing decision.
// `AudioContext.currentTime` is driven by the sound card; `requestAnimationFrame`
// is driven by the display. They are different clocks and they drift -- so if the
// picture ran on rAF and the bed ran on the audio clock, a landing that is exact
// at t=0 would be visibly early or late by the end of an 8-second piece. Reading
// `t` OUT of the audio clock every frame means the picture follows the sound, and
// a landing cannot drift by construction.
//
// This is a SANDBOX surface, not a renderer. It plays in real time on purpose.
// The capture path still scrubs and must keep scrubbing -- see render-furniture.
//
// ASCII only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Stage } from "@prisma/client";
import { PieceFrame } from "../Render";
import { PIECES, type PieceKey } from "../variants";
import { DEFAULT_ENTRY, HAIRLINE_ENTRY } from "../entries";
import { STAGE_ORDER } from "../../furniture";

type Bed = {
  kit: string;
  file: string;
  bars: number;
  seconds: number;
  landings: number[];
  desc: string;
};
type Manifest = { bpm: number; beat: number; bar: number; pieces: Record<string, Bed[]> };

const AUDITIONABLE: PieceKey[] = ["intro", "outro"];

export function Preview() {
  const [piece, setPiece] = useState<PieceKey>("outro");
  const [variantIdx, setVariantIdx] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [stage, setStage] = useState<string>("SCHEMATIC");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [bedKit, setBedKit] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const def = PIECES[piece];
  const seconds = def.seconds;
  const variant = def.variants[Math.min(variantIdx, def.variants.length - 1)];

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const buffers = useRef<Map<string, AudioBuffer>>(new Map());
  // When the current lap started, on the AUDIO clock.
  const lapStart = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    fetch("/_beds/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`beds manifest ${r.status}`))))
      .then(setManifest)
      .catch((e) => setErr(`No beds found. Run \`python tools/furniture-bed.py\`. (${e.message})`));
  }, []);

  const beds = useMemo(() => manifest?.pieces?.[piece] ?? [], [manifest, piece]);
  useEffect(() => {
    if (beds.length && !beds.some((b) => b.kit === bedKit)) setBedKit(beds[0].kit);
  }, [beds, bedKit]);

  const audio = useCallback(() => {
    if (!ctxRef.current) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new C();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = g;
    }
    return ctxRef.current;
  }, []);

  const load = useCallback(async (file: string) => {
    if (buffers.current.has(file)) return buffers.current.get(file)!;
    const ctx = audio();
    const res = await fetch(`/_beds/${file}`);
    if (!res.ok) throw new Error(`${file} ${res.status}`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers.current.set(file, buf);
    return buf;
  }, [audio]);

  /** Start (or restart) the bed at `offset` seconds into the piece. */
  const startBed = useCallback(async (offset: number) => {
    const bed = beds.find((b) => b.kit === bedKit);
    if (!bed || muted) return;
    try {
      const ctx = audio();
      const buf = await load(bed.file);
      srcRef.current?.stop();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gainRef.current!);
      // The bed and the piece are the same length by construction, so an offset
      // in one is the same offset in the other. If that ever stops being true
      // the mismatch belongs in a check, not in a fudge factor here.
      src.start(0, Math.min(offset, buf.duration - 0.001));
      srcRef.current = src;
      lapStart.current = ctx.currentTime - offset;
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [beds, bedKit, muted, audio, load]);

  const stopBed = useCallback(() => {
    try { srcRef.current?.stop(); } catch { /* already stopped */ }
    srcRef.current = null;
  }, []);

  // THE TRANSPORT. `t` is read out of the audio clock, never accumulated from
  // frame deltas -- accumulating drifts, and drift is exactly what this surface
  // exists to rule out.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const ctx = ctxRef.current;
      if (ctx && !muted && srcRef.current) {
        const elapsed = ctx.currentTime - lapStart.current;
        if (elapsed >= seconds) {
          void startBed(0);
          setT(0);
        } else {
          setT(elapsed);
        }
      } else {
        // Muted: no audio clock to follow, so fall back to wall time. Fine here
        // because with no sound there is nothing to drift AGAINST.
        setT((prev) => (prev + 1 / 60 >= seconds ? 0 : prev + 1 / 60));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, seconds, muted, startBed]);

  const play = async () => {
    await audio().resume();
    await startBed(t >= seconds - 0.01 ? 0 : t);
    setPlaying(true);
  };
  const pause = () => { stopBed(); setPlaying(false); };
  const scrub = (v: number) => {
    setT(v);
    if (playing) void startBed(v);
  };

  // Swapping the bed WHILE PLAYING keeps position, which is the whole point:
  // you hear the same moment of picture against a different bed, back to back.
  useEffect(() => {
    if (playing) void startBed(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedKit, muted]);

  useEffect(() => () => { stopBed(); void ctxRef.current?.close(); }, [stopBed]);

  // THE THEME GOES ON documentElement, NOT ON A WRAPPER. The palette tokens are
  // defined against `:root`, so `data-theme` on an inner div sets an attribute
  // nothing is listening for -- the picker said "dark" while the frame rendered
  // light. This is the same way export-diagrams.ts flips it, and the reason that
  // file does it there rather than on a container.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-theme");
    el.setAttribute("data-theme", theme);
    return () => { if (prev) el.setAttribute("data-theme", prev); else el.removeAttribute("data-theme"); };
  }, [theme]);

  const bed = beds.find((b) => b.kit === bedKit);
  const bar = manifest?.bar ?? 2;
  const label = { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, opacity: 0.6 };
  const field: React.CSSProperties = {
    background: "transparent", color: "inherit", border: "1px solid currentColor",
    padding: "4px 8px", font: "inherit", fontSize: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0b0d12", color: "#e8e6e1", fontFamily: "ui-monospace, monospace" }}>
      {/* The consent banner and the dev overlay both sit over the transport on
          this surface. They belong on the product; they do not belong on top of
          the controls you are trying to judge a piece with. Hidden here only. */}
      <style>{`[class*="c15t-"], nextjs-portal, [data-nextjs-toast] { display: none !important; }`}</style>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "grid", placeItems: "center" }}>
        <div style={{ position: "relative", width: "min(100%, calc((100vh - 190px) * 16 / 9))", aspectRatio: "16 / 9", containerType: "size", background: theme === "dark" ? "#0b0d12" : "#f5f4ef" }}>
          <PieceFrame
            entry={piece === "lower" ? HAIRLINE_ENTRY : DEFAULT_ENTRY}
            piece={piece}
            variant={variant.id}
            stage={stage as Stage}
            title="Solder the board: heavy parts, passives, and a drag-solder pass"
            lesson="L1.02 / ESP-NOW Link"
            t={t}
            aspect={16 / 9}
            guides={false}
          />
        </div>
      </div>

      <div style={{ flex: "0 0 auto", padding: "10px 14px", borderTop: "1px solid #2a2f3a", display: "flex", flexDirection: "column", gap: 8 }}>
        {err && <div style={{ color: "#ff9a9a", fontSize: 12 }}>{err}</div>}

        {/* THE SCRUB, with the bar lines drawn on it. A landing that is meant to
            sit on a downbeat can be checked by eye against the ticks rather than
            by counting seconds. */}
        <div style={{ position: "relative" }}>
          <input type="range" min={0} max={seconds} step={1 / 60} value={t}
                 onChange={(e) => scrub(Number(e.target.value))} style={{ width: "100%" }} />
          <div style={{ position: "relative", height: 14, marginTop: -2 }}>
            {Array.from({ length: Math.floor(seconds / bar) + 1 }, (_, i) => (
              <span key={i} style={{ position: "absolute", left: `${(i * bar / seconds) * 100}%`, fontSize: 9, opacity: 0.55, transform: "translateX(-50%)" }}>
                {i * bar}s
              </span>
            ))}
            {bed?.landings.map((L) => (
              <span key={L} title={`landing ${L}s`} style={{ position: "absolute", left: `${(L / seconds) * 100}%`, top: -14, width: 2, height: 12, background: "#d4a02a", transform: "translateX(-50%)" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={playing ? pause : play} style={{ ...field, minWidth: 74, cursor: "pointer" }}>
            {playing ? "pause" : "play"}
          </button>
          <span style={{ fontSize: 12, minWidth: 96 }}>
            {t.toFixed(2)}s &middot; beat {(t / (manifest?.beat ?? 0.5)).toFixed(1)}
          </span>

          <label style={label}>piece{" "}
            <select value={piece} onChange={(e) => { pause(); setT(0); setVariantIdx(0); setPiece(e.target.value as PieceKey); }} style={field}>
              {AUDITIONABLE.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          <label style={label}>variant{" "}
            <select value={variantIdx} onChange={(e) => setVariantIdx(Number(e.target.value))} style={field}>
              {def.variants.map((v: { id: string }, i: number) => <option key={v.id} value={i}>{v.id}</option>)}
            </select>
          </label>

          <label style={label}>bed{" "}
            <select value={bedKit ?? ""} onChange={(e) => setBedKit(e.target.value)} style={field}>
              {beds.length === 0 && <option value="">none</option>}
              {beds.map((b) => <option key={b.kit} value={b.kit}>{b.kit}</option>)}
            </select>
          </label>

          <label style={label}>theme{" "}
            <select value={theme} onChange={(e) => setTheme(e.target.value as "dark" | "light")} style={field}>
              <option value="dark">dark</option><option value="light">light</option>
            </select>
          </label>

          <label style={label}>stage{" "}
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={field}>
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label style={{ ...label, display: "flex", alignItems: "center", gap: 5 }}>
            <input type="checkbox" checked={muted} onChange={(e) => { setMuted(e.target.checked); if (e.target.checked) stopBed(); }} />
            mute
          </label>
        </div>

        {bed && (
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            {bed.bars} bars &middot; {bed.seconds}s &middot; landings {bed.landings.map((l) => `${l}s`).join(" / ")}
            {bed.desc ? ` -- ${bed.desc}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
