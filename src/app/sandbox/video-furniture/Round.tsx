"use client";

// The round's controls and grid.
//
// ONE CLOCK FOR EVERY TILE, and it is a scrubber rather than a play button by
// default. Judging motion by watching it loop is how the Logbook round kept
// approving frames that were wrong at the instant that mattered - the useful
// question is almost always "what does it look like at t=0.4", and a slider
// answers that where a loop does not. Play is there for the final read.
//
// EVERY TILE IS 16:9 AT TRUE PROPORTION, and the type sizes are shares of the
// tile, so what you see is the composition at any delivery size. That is the
// one property the previous round did not have, and it cost a re-encode.
//
// ASCII only.

import { useEffect, useRef, useState } from "react";
import type { Stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";
import { PIECES, SAMPLE_TITLE, STAGE_ORDER } from "./furniture";
import { Furniture } from "./Pieces";
import { outroFits, END_SCREEN_WINDOW, MIN_VIDEO_SECONDS } from "./youtube";

export function Round() {
  const [t, setT] = useState(0.9);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState<Stage>("SCHEMATIC");
  const [guides, setGuides] = useState(true);
  const [longest, setLongest] = useState(false);
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);

  const span = Math.max(...PIECES.map((p) => p.seconds));

  useEffect(() => {
    if (!playing) return;
    t0.current = performance.now() - t * 1000;
    const tick = () => {
      const el = ((performance.now() - t0.current) / 1000) % span;
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // t is intentionally omitted: including it restarts the loop every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, span]);

  // The worst case in the real shot list, for stress-testing every treatment.
  const LONGEST =
    "Solder the board: heavy parts, passives, and a drag-solder pass (plus the hot-air option)";
  const title = longest ? LONGEST : (SAMPLE_TITLE[stage] ?? STAGE_LABELS[stage]);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6">
      <header className="border-b border-panel-border/60 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          &#9656; Sandbox &middot; round 1
        </p>
        <h1 className="title-hero mt-3">Video furniture</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Four wrappers for the YouTube cut, three treatments each. The guides carry{" "}
          <strong>127 titled youtube slots with no video</strong>. That is this is what turns
          a screencast into one of them. Pick one treatment per piece; the picks
          become a cut sheet in <code>otd-promo</code> and this page is deleted.
        </p>
        <p className="mt-4 max-w-3xl border-l-2 border-command-gold pl-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-gold-light">
          Scrub, do not watch. Every value is a function of t, so the slider is the
          honest instrument. A loop hides the instant that is wrong.
        </p>
      </header>

      {/* ---- controls ---- */}
      <div className="sticky top-0 z-10 -mx-4 mb-8 mt-6 border-b border-panel-border/60 bg-deep-space/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="border border-panel-border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-gold-light hover:border-command-gold"
          >
            {playing ? "pause" : "play"}
          </button>
          <label className="flex flex-1 items-center gap-3 min-w-[280px]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">t</span>
            <input
              type="range"
              min={0}
              max={span}
              step={0.01}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              className="flex-1 accent-[var(--color-command-gold)]"
            />
            <span className="w-14 font-mono text-xs tabular-nums text-gold-light">
              {t.toFixed(2)}s
            </span>
          </label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
            className="border border-panel-border bg-transparent px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-gold-light"
          >
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <input type="checkbox" checked={longest} onChange={(e) => setLongest(e.target.checked)} />
            longest real title
          </label>
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            end-screen wells
          </label>
        </div>
      </div>

      {PIECES.map((piece) => {
        const fit = piece.id === "outro" ? outroFits(piece.seconds, 240) : null;
        return (
          <section key={piece.id} className="mb-14">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="title-card">{piece.name}</h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                {piece.seconds}s
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted">{piece.role}</p>

            {fit ? (
              <p
                className={`mt-3 border-l-2 pl-3 font-mono text-[11px] leading-relaxed ${
                  fit.ok ? "border-command-gold text-gold-light" : "border-danger-coral text-danger-coral"
                }`}
              >
                {fit.ok
                  ? `end screen OK - ${piece.seconds}s sits inside YouTube's last ${END_SCREEN_WINDOW.minSeconds}-${END_SCREEN_WINDOW.maxSeconds}s window (video must be >= ${MIN_VIDEO_SECONDS}s)`
                  : fit.reasons.join(" / ")}
              </p>
            ) : null}

            <div className="mt-5 grid gap-6 lg:grid-cols-3">
              {piece.variants.map((v) => (
                <figure key={v.id} className="min-w-0">
                  <div
                    className="relative w-full border border-panel-border/60 bg-deep-space"
                    style={{ aspectRatio: "16 / 9" }}
                  >
                    <Furniture
                      piece={piece.id}
                      variant={v.id}
                      stage={stage}
                      title={title}
                      lesson="L1.02 / ESP-NOW Link"
                      t={Math.min(t, piece.seconds)}
                      guides={guides && piece.id === "outro"}
                    />
                  </div>
                  <figcaption className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-command-gold">
                        {piece.id}/{v.id}
                      </span>
                      <span className="text-sm text-gold-light">{v.name}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{v.claim}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
