"use client";

// The single-piece capture stage. See page.tsx for why it is separate.
//
// `data-settled` is set after a rAF following the seek, not on the seek itself.
// The film learned that the hard way: between a state change and the paint that
// realises it there is a window where a screenshot is a coin toss, and 24 of 120
// frames came back different between two runs of an unchanged tree because of
// it. Nothing here animates on a wall clock, so one rAF is enough - but it has
// to be there.
//
// ASCII only.

import { useEffect, useState } from "react";
import type { Stage } from "@prisma/client";
import { Furniture } from "../Pieces";
import { PIECES, SAMPLE_TITLE } from "../furniture";
import { STAGE_LABELS } from "@/lib/stages";

declare global {
  interface Window {
    __seek?: (t: number) => void;
    __pieceInfo?: () => { piece: string; variant: string; seconds: number; w: number; h: number };
  }
}

/** The longest title the shot list actually contains. Measuring against a
 *  placeholder is measuring the placeholder. */
const LONGEST =
  "Solder the board: heavy parts, passives, and a drag-solder pass (plus the hot-air option)";

export function FrameOne({
  piece,
  variant,
  stage,
  guides,
}: {
  piece: string;
  variant: string;
  stage: string;
  guides: boolean;
}) {
  const [t, setT] = useState(0);
  const [settled, setSettled] = useState(false);
  const [longest, setLongest] = useState(true);

  const def = PIECES.find((p) => p.id === piece) ?? PIECES[0];
  const st = stage as Stage;

  // The deliverable is deep space. This page never inherits a theme toggle, and
  // a renderer does not notice a cream background - it just encodes every frame
  // of the wrong palette.
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
    window.__seek = (next: number) => {
      setSettled(false);
      setT(next);
    };
    window.__pieceInfo = () => ({
      piece: def.id,
      variant,
      seconds: def.seconds,
      w: window.innerWidth,
      h: window.innerHeight,
    });
    // A test hook for the stress case, so a checker can flip it without the UI.
    (window as unknown as { __setLongest?: (v: boolean) => void }).__setLongest = setLongest;
    return () => {
      delete window.__seek;
      delete window.__pieceInfo;
    };
  }, [def.id, def.seconds, variant]);

  // Settle AFTER a paint, never in the same tick as the state change.
  useEffect(() => {
    if (settled) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [settled, t]);

  const title = longest ? LONGEST : (SAMPLE_TITLE[st] ?? STAGE_LABELS[st]);

  return (
    <div
      data-piece-stage
      {...(settled ? { "data-settled": "" } : {})}
      style={{ position: "fixed", inset: 0, background: "var(--color-deep-space, #08090d)" }}
    >
      <Furniture
        piece={def.id}
        variant={variant}
        stage={st}
        title={title}
        lesson="L1.02 / ESP-NOW Link"
        t={t}
        guides={guides}
      />
    </div>
  );
}
