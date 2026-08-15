"use client";

// One stage, one shape, full viewport, driven from outside. DEV/EXPORT ONLY.
//
// THE CAPTURE SURFACE. Everything else in this sandbox is for looking at; this
// route exists so a renderer can walk the film frame by frame at delivery size.
// It carries nothing else - no page chrome, no controls, no other stages -
// because anything else on the page is another thing that can repaint between
// the seek and the shot.
//
// TWO CONTRACTS WITH THE RENDERER, and both matter.
//
//   `window.__seek(t)` sets scene time. The renderer drives the clock; there is
//   no wall clock here at all. `fixedT` was already the prop for this - the same
//   one the `?t=` freeze uses - so the film does not learn a new way to be
//   still.
//
//   `[data-settled]` says the frame is finished. LogbookLive clears it at the
//   top of every pin cycle and sets it after the rAF pass, so it means "every
//   animation under this stage is pinned to this scene time", not "the element
//   exists". Screenshotting before it appears is how 24 of 120 frames came back
//   different between two identical runs of an unchanged tree.
//
// The stage fills the viewport exactly, so the renderer sets the delivery size
// as the viewport and the screenshot IS the frame - no scaling step, no
// resample, and `w` reaches the fit maths as the real pixel width.
//
// ASCII only.

import { useEffect, useRef, useState } from "react";
import {
  LogbookLive,
  type FilmLesson,
  type FilmQuestion,
} from "./LogbookLive";
import { THE_CUT } from "./assembly";
import { FORMATS, type FormatId } from "./formats/formats";

// `__seek` / `__filmInfo` are declared once, in `src/types/capture-surface.d.ts`.
// Two `declare global` blocks for one global drift into incompatible shapes and
// only announce it when somebody fixes one of them.
//
// This surface has NOT migrated to the promise form of the contract: the settle
// signal is raised by `LogbookLive` (a child), and this route's renderer lives
// in the extracted `otd-promo` repo, so the change cannot be verified from
// here. Until it does, a driver here still waits on `[data-settled]`.

export function FrameStage({
  fmt,
  lesson,
  question,
}: {
  fmt: FormatId;
  lesson: FilmLesson;
  question: FilmQuestion;
}) {
  const f = FORMATS.find((x) => x.id === fmt) ?? FORMATS[0];
  const [t, setT] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The viewport IS the frame. Measured rather than assumed, because the fit
  // maths takes a pixel width and passing it a number the DOM disagrees with is
  // the whole class of bug this round kept finding.
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // THE DELIVERABLE IS DEEP SPACE. The probe frame came back on cream because
  // this route, unlike the two preview rigs, never pinned the theme - and a
  // renderer does not notice, it just encodes 300 correct renders of the wrong
  // palette. Same reach the bed rig and the format grid make.
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
    window.__seek = (next: number) => setT(next);
    window.__filmInfo = () => ({
      fmt: f.id,
      w: window.innerWidth,
      h: window.innerHeight,
      seconds: 10,
    });
    return () => {
      delete window.__seek;
      delete window.__filmInfo;
    };
  }, [f.id]);

  return (
    <div
      ref={box}
      style={{ position: "fixed", inset: 0, background: "var(--color-deep-space, #08090d)" }}
    >
      {size ? (
        <LogbookLive
          arrangement="quiet"
          lesson={lesson}
          libraryTotal={0}
          libraryDone={0}
          questions={[question]}
          tuning={THE_CUT().tuning}
          fixedT={t}
          w={size.w}
          aspect={size.w / size.h}
          safe={f.safe ?? {}}
        />
      ) : null}
    </div>
  );
}
