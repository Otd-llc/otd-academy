"use client";

// B9b — a Do list whose steps each carry the EVIDENCE that the step worked.
// Ticking a step reveals its proof, so the evidence CONFIRMS rather than
// pre-empts: the tick becomes a question with an answer instead of a box the
// learner clicks on faith. A step with no authored proof stays a plain tick.
//
// CLIENT component, because ticking is local state. That state is SESSION-ONLY
// and deliberately so, matching SelfCheckBlock: it resets on every page load so
// the list can be re-run. Persisting it is a separate decision — the stage gate
// already stores attestations, and a Do list that double-stores them creates two
// sources of truth about the same claim.

import { useId, useState } from "react";
import { Inline } from "@/components/guide/InlineText";

export function DoStepsBlock({
  title,
  body,
  steps,
}: {
  title: string;
  body: string;
  steps: { text: string; proof?: string }[];
}) {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const baseId = useId();

  return (
    <div>
      {body ? (
        <p className="mb-3 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
      <section className="border-l-2 border-command-gold pl-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
          Do · {title}
        </span>
        <ul className="mt-2.5 border-t border-panel-border/60">
          {steps.map((s, i) => {
            const proofId = `${baseId}-proof-${i}`;
            const open = done[i] === true;
            const hasProof = Boolean(s.proof);
            return (
              <li key={i} className="border-b border-panel-border/60 py-2.5">
                <button
                  type="button"
                  onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                  aria-pressed={open}
                  {...(hasProof
                    ? { "aria-expanded": open, "aria-controls": proofId }
                    : {})}
                  className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
                >
                  <span
                    aria-hidden
                    className={`mt-[5px] h-3.5 w-3.5 shrink-0 border border-command-gold/60 transition-colors ${
                      open ? "bg-command-gold" : ""
                    }`}
                  />
                  <span className="font-serif text-[15px] leading-relaxed text-muted">
                    {/* plain: this sits inside the step's toggle button, and a
                        glossary trigger is itself a button. */}
                    <Inline text={s.text} plain />
                  </span>
                </button>
                {open && s.proof ? (
                  <p id={proofId} className="mt-1.5 flex gap-2.5 pl-[26px]">
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold"
                    >
                      you should see
                    </span>
                    {/* text-muted, NOT gray-3: the proof line is the payload of the
                        whole block, and gray-3 fails WCAG AA in both themes. */}
                    <span className="font-serif text-[14px] leading-relaxed text-muted">
                      <Inline text={s.proof} />
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
