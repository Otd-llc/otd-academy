"use client";

// SANDBOX - one candidate, on the REAL QuizBlock, looping. DEV ONLY.
//
// The component is the shipping one, unmodified and given neither a `context`
// nor a `logbook`, which is the case its own header calls the editor preview:
// with neither it touches no server action and records nothing. Every pick here
// is a real click on a real option, so what is being judged is the thing that
// would ship rather than a mock of it.
//
// THE CLOCK IS THE FILM'S CLOCK. Same scrub-never-play contract: the loop
// advances scene time, and after every change each animation under the stage is
// paused and its currentTime pinned. That is what lets `?t=` freeze a candidate
// mid-fill for a screenshot, and it is also the reason every candidate is
// written as keyframes - a CSS transition cannot be seeked, so the ones the
// base sheet declares are switched off in `select-anim`.
//
// ASCII only.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { QuizBlock, type QuizQuestion } from "@/components/guide/QuizBlock";
import { CLICK, CYCLE, type SelectAnim } from "./select-anim";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SelectStage({
  anim,
  question,
  fixedT,
  w = 520,
}: {
  anim: SelectAnim;
  question: QuizQuestion;
  fixedT?: number;
  w?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(fixedT ?? 0);
  const [live, setLive] = useState(false);
  const frozen = fixedT !== undefined;

  // Off-screen stages stop. Eight live loops each re-rendering a QuizBlock is
  // enough to make the page it is judged on stutter.
  useEffect(() => {
    const el = host.current;
    if (!el || frozen) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), {
      rootMargin: "160px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [frozen]);

  useEffect(() => {
    if (frozen || !live) return;
    let raf = 0;
    let last = -Infinity;
    const start = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - last < 33) return; // 30fps, the rate the film renders at
      last = now;
      setT(((now - start) / 1000) % CYCLE);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, live]);

  // ONE forward-only reconcile: state the target, fix it up, and press the
  // component's own "Start over" when the lap wraps. Clicking is not reversible,
  // so a seek backwards has to be expressed as a reset rather than as a rewind.
  useIso(() => {
    const root = host.current;
    if (!root) return;
    if (t < CLICK) {
      Array.from(root.querySelectorAll("button"))
        .find((b) => b.textContent?.trim() === "Start over")
        ?.click();
    } else {
      const field = root.querySelector("fieldset");
      if (field && !field.querySelector('[data-st="ok"]')) {
        field.querySelectorAll<HTMLButtonElement>(".qzh-opt")[question.answer]?.click();
      }
    }
    // PIN TWICE, AND THE SECOND ONE IS THE ONE THAT WORKS.
    //
    // The click changes `data-st` through React state, which does not commit
    // until after this effect returns - so the DOM here is still the pre-click
    // DOM and the animations that state selects do not exist yet. Pinning now
    // finds nothing, and they start on wall clock. A running loop hides this
    // because the next tick corrects it; a FROZEN frame has no next tick, so
    // every `?t=` screenshot came back with the animation already over, which
    // is exactly the failure the freeze param exists to prevent.
    //
    // The rAF callback runs after the commit and after paint, so by then the
    // animations exist and can be seeked.
    const pin = () => {
      for (const a of root.getAnimations({ subtree: true })) {
        a.pause();
        try {
          (a as unknown as { currentTime: number }).currentTime = Math.max(0, (t - CLICK) * 1000);
        } catch {
          /* an animation can be replaced mid-pin; the next pass re-pins it */
        }
      }
    };
    pin();
    const raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
  }, [t, question, anim.id]);

  return (
    <div
      ref={host}
      data-qsel={anim.id}
      style={{
        position: "relative",
        width: "100%",
        background: "var(--color-deep-space, #08090d)",
        border: "1px solid var(--color-panel-border)",
        padding: "18px 20px",
        overflow: "hidden",
      }}
    >
      <style>{anim.css}</style>
      <div style={{ width: w, maxWidth: "100%" }}>
        <QuizBlock prompt="Quick check" questions={[question]} />
      </div>
    </div>
  );
}
