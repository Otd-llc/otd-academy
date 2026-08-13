"use client";

// One treatment, full viewport, driven from outside.
//
// `data-settled` is set after a rAF FOLLOWING the seek, never in the same tick.
// Between a state change and the paint that realises it there is a window where
// a screenshot is a coin toss; the film found that the expensive way.
//
// This one does NOT pin the theme, unlike round 1's frame. The measurement rig
// flips `data-theme` itself and compares the two renders, so pinning here would
// quietly defeat the only check that catches a hardcoded colour.
//
// ASCII only.

import { useEffect, useState } from "react";
import type { Stage } from "@prisma/client";
import { PieceFrame } from "../Render";
import { PIECES, type PieceKey } from "../variants";
import { SAMPLE_TITLE } from "../../furniture";
import { STAGE_LABELS } from "@/lib/stages";

// This `declare global` used to live in ROUND 1's frame, and this file
// deliberately did not repeat it - two declarations with different shapes are a
// conflict at the type level rather than two independent surfaces. Round 1 has
// been deleted, so it moves here, to the only surface that still drives a seek.
declare global {
  interface Window {
    __seek?: (t: number) => void;
    __pieceInfo?: () => { piece: string; variant: string; seconds: number; w: number; h: number };
  }
}

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
  // The frame IS the viewport on this surface, so this is the delivery aspect.
  const [aspect, setAspect] = useState(16 / 9);
  const key = (piece in PIECES ? piece : "intro") as PieceKey;
  const def = PIECES[key];
  const st = stage as Stage;

  useEffect(() => {
    const read = () => setAspect(window.innerWidth / window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    window.__seek = (next: number) => {
      setSettled(false);
      setT(next);
    };
    window.__pieceInfo = () => ({
      piece: key,
      variant,
      seconds: def.seconds,
      w: window.innerWidth,
      h: window.innerHeight,
    });
    return () => {
      delete window.__seek;
      delete window.__pieceInfo;
    };
  }, [key, variant, def.seconds]);

  useEffect(() => {
    if (settled) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [settled, t]);

  // Measured against the LONGEST real title in the shot list. Measuring against
  // a short sample measures the sample.
  const title = LONGEST || SAMPLE_TITLE[st] || STAGE_LABELS[st];

  return (
    <div
      data-piece-stage
      {...(settled ? { "data-settled": "" } : {})}
      style={{ position: "fixed", inset: 0, background: "var(--color-deep-space)" }}
    >
      <PieceFrame
        piece={key}
        variant={variant}
        stage={st}
        title={title}
        lesson="L1.02 / ESP-NOW Link"
        t={t}
        aspect={aspect}
        guides={guides}
      />
    </div>
  );
}
