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
import { DEFAULT_EXIT, type FurnitureOut } from "./exits";
import { DEFAULT_ENTRY, HAIRLINE_ENTRY, type EntryEffect } from "./entries";
import { Mixer } from "./Mixer";
import { TYPES, TYPE_KEYS, type VideoType } from "./videotypes";

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
  const [exit, setExit] = useState<FurnitureOut[]>([DEFAULT_EXIT]);
  // The ENTRY stack, the other half of the dimension. Both live in the mixer
  // column now rather than in the page's top bar, so the transport and the
  // controls it is read against are one object.
  // `hairline` is the converted set, so it starts from a stack that actually
  // describes it rather than from a bare fade.
  const [entry, setEntry] = useState<EntryEffect[]>(piece === "hairline" ? HAIRLINE_ENTRY : DEFAULT_ENTRY);
  // The TYPE scopes the round: which pieces are relevant, which shapes ship,
  // and what furniture this type needs that nobody has built.
  const [vtype, setVtype] = useState<VideoType>("tutorial");
  const spec = TYPES[vtype];
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

      {/* WORK AREA LEFT, MIXER RIGHT. The treatment grid narrows rather than
          moves - one column fewer, same place - so the thing being judged does
          not jump when the controls appear. `lg:items-start` is load-bearing:
          grid items stretch by default, which leaves `position: sticky` nothing
          to slide against. */}
      {/* TABS ARE THE VIDEO TYPES. Six, closed, from the research - the 127
          planned videos are not one kind of thing, and the furniture differs
          sharply between them. */}
      <div className="mb-4 border-b border-panel-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            &#9656; video type
          </span>
          {TYPE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setVtype(k)}
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] focus-visible:border-command-gold focus-visible:outline-none ${
                k === vtype
                  ? "border-command-gold text-command-gold"
                  : "border-panel-border text-muted hover:border-gold-light hover:text-gold-light"
              }`}
            >
              {TYPES[k].name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{spec.furniture}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          shapes {spec.shapes.join(" / ")} &middot; uses {spec.pieces.length} pieces
          {spec.pieces.includes(piece) ? "" : " · THIS TYPE DOES NOT USE THIS PIECE"}
        </p>
        {spec.missing.length ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-danger-coral">
            not built: {spec.missing.join(" &middot; ")}
          </p>
        ) : null}
        {spec.directions.length > 1 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              directions
            </span>
            {spec.directions.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.note}
                onClick={() => setEntry(d.entry)}
                className="border border-panel-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:border-gold-light hover:text-gold-light focus-visible:border-command-gold focus-visible:outline-none"
              >
                {d.id}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <ul className={`grid gap-x-6 gap-y-8 ${wide ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
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
                entry={entry}
                guides={guides && piece === "outro"}
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{v.claim}</p>
          </li>
        ))}
      </ul>

      <Mixer
        t={t}
        seconds={def.seconds}
        onSeek={(next) => {
          setPlaying(false);
          setT(next);
        }}
        entry={entry}
        setEntry={setEntry}
        exit={exit}
        setExit={setExit}
      />
      </div>
    </main>
  );
}
