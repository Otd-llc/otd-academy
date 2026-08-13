"use client";

// Round 2's shell: one piece per page, ten treatments, one clock.
//
// THE THEME TOGGLE IS NOT DECORATION. The design law says a variant that sings
// on deep-space can die on ivory, and more usefully: any colour that was
// hardcoded simply fails to flip, in front of you. Round 1 shipped `#fff` for
// every title and nothing caught it, because there was nothing to catch it with.
// Flipping to light here is the test.
//
// The option id sits ABOVE its frame. In a badge inside the frame it becomes
// part of the composition being judged.
//
// ASCII only.

import { useEffect, useRef, useState } from "react";
import type { Stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";
import { STAGE_ORDER, SAMPLE_TITLE } from "../furniture";
import { PIECES, PIECE_KEYS, type PieceKey } from "./variants";
import { PieceFrame } from "./Render";
import { EXITS, type FurnitureOut } from "./exits";

const LONGEST =
  "Solder the board: heavy parts, passives, and a drag-solder pass (plus the hot-air option)";

export function Grid({ piece }: { piece: PieceKey }) {
  const def = PIECES[piece];
  const [t, setT] = useState(def.seconds * 0.6);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState<Stage>("SCHEMATIC");
  const [light, setLight] = useState(false);
  const [longest, setLongest] = useState(false);
  const [guides, setGuides] = useState(true);
  const [wide, setWide] = useState(false);
  // The exit is a first-class dial, not a per-variant afterthought. Every piece
  // arrived with intent and left with a fade until this existed.
  const [exit, setExit] = useState<FurnitureOut[]>(["settle"]);
  const toggleExit = (id: FurnitureOut) =>
    setExit((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);

  useEffect(() => {
    const el = document.documentElement;
    const was = el.dataset.theme;
    el.dataset.theme = light ? "light" : "dark";
    return () => {
      if (was === undefined) delete el.dataset.theme;
      else el.dataset.theme = was;
    };
  }, [light]);

  useEffect(() => {
    if (!playing) return;
    t0.current = performance.now() - t * 1000;
    const tick = () => {
      setT(((performance.now() - t0.current) / 1000) % def.seconds);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, def.seconds]);

  const title = longest ? LONGEST : (SAMPLE_TITLE[stage] ?? STAGE_LABELS[stage]);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; Sandbox &middot; round 2
      </p>
      <h1 className="title-hero mt-2">{def.name}</h1>

      <nav className="mt-4 flex flex-wrap gap-4 border-b border-panel-border/60 pb-4">
        {PIECE_KEYS.map((k) => (
          <a
            key={k}
            href={`/sandbox/video-furniture/r2/${k}`}
            className={`font-mono text-[11px] uppercase tracking-[0.18em] focus-visible:outline-none focus-visible:text-gold-light ${
              k === piece ? "text-command-gold" : "text-muted hover:text-gold-light"
            }`}
          >
            {PIECES[k].name}
          </a>
        ))}
      </nav>

      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-panel-border/60 bg-deep-space/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className="border border-panel-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gold-light hover:border-command-gold focus-visible:border-command-gold focus-visible:outline-none"
          >
            {playing ? "pause" : "play"}
          </button>
          <label className="flex min-w-[260px] flex-1 items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">t</span>
            <input
              type="range"
              min={0}
              max={def.seconds}
              step={0.01}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              className="flex-1 accent-[var(--color-command-gold)]"
            />
            <span className="w-14 font-numeral text-sm tabular-nums text-command-gold">{t.toFixed(2)}s</span>
          </label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
            className="border border-panel-border bg-transparent px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-light focus-visible:border-command-gold focus-visible:outline-none"
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          {[
            ["light", light, setLight],
            ["longest title", longest, setLongest],
            ["wells", guides, setGuides],
            ["2 up", wide, setWide],
          ].map(([label, val, set]) => (
            <label key={String(label)} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <input
                type="checkbox"
                checked={val as boolean}
                onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
              />
              {label as string}
            </label>
          ))}
        </div>
      </div>

      {/* Exits STACK. Each selected one wraps the piece in its own layer, applied
          outermost first, so `shutter + fade` is a hard edge closing over
          something that is also going rather than one overriding the other. */}
      <div className="mb-4 border-b border-panel-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">exit stack</span>
          {EXITS.map((x) => {
            const on = exit.includes(x.id);
            const order = exit.indexOf(x.id) + 1;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => toggleExit(x.id)}
                title={x.note}
                className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:border-command-gold ${
                  on
                    ? "border-command-gold text-command-gold"
                    : "border-panel-border text-muted hover:border-gold-light hover:text-gold-light"
                }`}
              >
                {on ? <span className="font-numeral tabular-nums">{order} </span> : null}
                {x.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setExit([])}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted underline-offset-4 hover:text-gold-light focus-visible:outline-none focus-visible:text-gold-light"
          >
            clear
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {exit.length === 0
            ? "No exit selected, so the piece simply stops. Pick one or several; the number on each is its layer order."
            : exit.map((id) => EXITS.find((x) => x.id === id)?.note).join(" ")}
        </p>
      </div>

      <ul className={`grid gap-x-6 gap-y-8 ${wide ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {def.variants.map((v) => (
          <li key={v.id} className="min-w-0">
            {/* id ABOVE the frame, never inside it */}
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-command-gold">
                {piece}/{v.id}
              </span>
              <span className="title-card text-[15px]">{v.name}</span>
            </div>
            <div
              className="relative mt-2 w-full border border-panel-border/60"
              style={{ aspectRatio: "16 / 9" }}
            >
              <PieceFrame
                piece={piece}
                variant={v.id}
                stage={stage}
                title={title}
                lesson="L1.02 / ESP-NOW Link"
                t={t}
                aspect={16 / 9}
                exit={exit}
                guides={guides && piece === "outro"}
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{v.claim}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
