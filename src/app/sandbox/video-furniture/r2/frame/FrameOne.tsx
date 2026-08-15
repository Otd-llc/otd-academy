"use client";

// One treatment, full viewport, driven from outside.
//
// THE SETTLE CONTRACT IS THE PROMISE `__seek` RETURNS. Await it; the frame is
// then safe to measure or photograph. There used to be two contracts in this
// repo -- promise-await (`__cutSet`) and attribute-poll (`data-settled`) -- and
// a consumer that picked the wrong one got a silent blind path rather than an
// error. `__seek` now matches `__cutSet`, so there is one contract and one way
// to be wrong.
//
// The promise resolves after the rAF FOLLOWING the paint that carries the seek,
// never in the same tick. Between a state change and the paint that realises it
// there is a window where a screenshot is a coin toss; the film found that the
// expensive way.
//
// `data-settled` remains, carrying the settled `t`, but it is NOT the contract.
// It is there so a human scrubbing this page in a browser can see which time
// the frame is showing. Polling it is how the old blind path worked: the
// attribute is present at mount, so `waitForSelector` returns instantly and
// every sample reads frame 0 while every assertion still counts itself. Carrying
// the value at least makes a poller's mistake visible instead of silent.
//
// This one does NOT pin the theme, unlike round 1's frame. The measurement rig
// flips `data-theme` itself and compares the two renders, so pinning here would
// quietly defeat the only check that catches a hardcoded colour.
//
// ASCII only.

import { useEffect, useRef, useState } from "react";
import type { Stage } from "@prisma/client";
import { PieceFrame } from "../Render";
import { PIECES, type PieceKey } from "../variants";
import { DEFAULT_ENTRY, HAIRLINE_ENTRY } from "../entries";
import { SAMPLE_TITLE } from "../../furniture";
import { STAGE_LABELS } from "@/lib/stages";

// The `declare global` for `__seek` used to live here AND in the film stage,
// which is a conflict at the type level the moment the two shapes diverge --
// exactly what happened when this surface started returning a promise. It now
// lives once, in `src/types/capture-surface.d.ts`, alongside the reason.
//
// THIS FILE IS THE REFERENCE IMPLEMENTATION of that contract: `__seek` returns
// a promise, resolved one frame after the paint that carries the seek.

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
  // Resolver for the in-flight `__seek`. Held in a ref rather than state so
  // resolving it cannot itself schedule a render.
  const settleRef = useRef<(() => void) | null>(null);
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
    window.__seek = (next: number) =>
      new Promise<void>((resolve) => {
        // A seek that arrives while another is in flight resolves the old one
        // rather than stranding its awaiter forever. A dropped promise in a
        // capture loop reads as a hang with no message.
        settleRef.current?.();
        settleRef.current = resolve;
        setSettled(false);
        setT(next);
      });
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
      // Unblock anyone mid-await on teardown, for the same reason.
      settleRef.current?.();
      settleRef.current = null;
    };
  }, [key, variant, def.seconds]);

  useEffect(() => {
    if (settled) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [settled, t]);

  // Resolve one frame AFTER `settled` commits, not in the rAF that requests it.
  // The rAF above runs before the paint that carries the new time, so resolving
  // there would hand back a promise that settles on the frame BEFORE the one
  // asked for -- which is precisely the coin-toss screenshot this contract
  // exists to remove.
  useEffect(() => {
    if (!settled || !settleRef.current) return;
    const id = requestAnimationFrame(() => {
      const resolve = settleRef.current;
      settleRef.current = null;
      resolve?.();
    });
    return () => cancelAnimationFrame(id);
  }, [settled]);

  // Measured against the LONGEST real title in the shot list. Measuring against
  // a short sample measures the sample.
  const title = LONGEST || SAMPLE_TITLE[st] || STAGE_LABELS[st];

  return (
    <div
      data-piece-stage
      {...(settled ? { "data-settled": String(t) } : {})}
      style={{ position: "fixed", inset: 0, background: "var(--color-deep-space)" }}
    >
      <PieceFrame
        // The measurement surface must render what the round renders, or it
        // measures a piece nobody is looking at. `hairline` is the converted
        // set and carries its own stack.
        entry={key === "lower" ? HAIRLINE_ENTRY : DEFAULT_ENTRY}
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
