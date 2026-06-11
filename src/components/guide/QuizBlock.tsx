"use client";

// Interactive multiple-choice comprehension check (the `quiz` content block).
//
// GRADE-AS-YOU-GO: each question is scored the instant you pick. A correct pick
// locks green with its explanation; a wrong pick is marked, struck out, and ruled
// out, and you pick again from what's left — instant feedback + immediate
// correction, the strongest form of the testing effect. The quiz is solved once
// every question is green.
//
// SOFT-GATING: when every question is correct AND the card supplies a context
// (enrollmentId + stage), the pass is persisted via `recordQuizPass` so the stage
// exit gate can require it (ANDed with the work-gate). The server re-scores the
// submitted picks against the card's real keys, so a fabricated submission can't
// open the gate. Without a context (e.g. the editor preview) the quiz is a pure
// self-check and records nothing.

import { useEffect, useState } from "react";
import { recordQuizPass } from "@/lib/actions/quiz";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
}

/** Live-card context that turns the quiz into a recorded stage gate. */
export interface QuizContext {
  enrollmentId: string;
  stage: string;
  /** This learner has already passed this stage's quiz. */
  passed: boolean;
}

export function QuizBlock({
  prompt,
  questions,
  context,
}: {
  prompt?: string;
  questions: QuizQuestion[];
  context?: QuizContext;
}) {
  // `selected[qi]` is the learner's latest pick on question qi; `wrong[qi]` is the
  // set of options they've already ruled out (picked wrong) there.
  const [selected, setSelected] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [wrong, setWrong] = useState<number[][]>(() => questions.map(() => []));
  const [passed, setPassed] = useState(context?.passed ?? false);
  const [recording, setRecording] = useState(false);

  const isSolved = (qi: number) => selected[qi] === questions[qi].answer;
  const solvedCount = questions.reduce(
    (n, _q, i) => (isSolved(i) ? n + 1 : n),
    0,
  );
  const allSolved = solvedCount === questions.length;

  // Record the pass once, the moment every question is solved (live context only).
  // Solving means each `selected` entry equals its key, so submitting the picks is
  // a genuine all-correct submission the server will accept.
  useEffect(() => {
    if (!allSolved || passed || recording || !context) return;
    let cancelled = false;
    setRecording(true);
    recordQuizPass({
      enrollmentId: context.enrollmentId,
      stage: context.stage,
      answers: selected as number[],
    })
      .then((res) => {
        if (!cancelled && res.ok) setPassed(true);
      })
      .catch(() => {
        // Soft: a failed write never blocks the self-check; the gate just stays
        // closed until a pass records.
      })
      .finally(() => {
        if (!cancelled) setRecording(false);
      });
    return () => {
      cancelled = true;
    };
    // Trigger only on the all-solved transition; the rest are read at that point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSolved]);

  function pick(qi: number, oi: number) {
    if (isSolved(qi)) return; // locked once correct
    if (wrong[qi].includes(oi)) return; // already ruled out
    setSelected((prev) => prev.map((s, i) => (i === qi ? oi : s)));
    if (oi !== questions[qi].answer) {
      setWrong((prev) => prev.map((w, i) => (i === qi ? [...w, oi] : w)));
    }
  }

  function reset() {
    setSelected(questions.map(() => null));
    setWrong(questions.map(() => []));
  }

  return (
    <section className="glass-card space-y-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
          {prompt ?? "Quick check"}
        </p>
        {context ? (
          passed ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-status-green/50 bg-status-green/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-status-green">
              ✓ passed · gate
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-panel-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              required to advance
            </span>
          )
        ) : null}
      </div>

      {questions.map((q, qi) => {
        const solved = isSolved(qi);
        const ruledOut = wrong[qi];
        const missed = ruledOut.length > 0 && !solved;
        return (
          <fieldset key={qi} className="space-y-2">
            <legend className="font-serif text-base leading-relaxed text-gray-1">
              {qi + 1}. {q.q}
            </legend>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answer;
                const isRuledOut = ruledOut.includes(oi);
                let cls =
                  "flex w-full items-center gap-2.5 rounded border px-3 py-2 text-left font-serif text-sm transition-colors ";
                let marker: string;
                if (solved && isAnswer) {
                  cls +=
                    "border-status-green bg-status-green/10 text-status-green";
                  marker = "✓";
                } else if (isRuledOut) {
                  cls +=
                    "border-alert-red/60 bg-alert-red/5 text-alert-red/70 line-through";
                  marker = "✗";
                } else if (solved) {
                  cls += "border-panel-border text-muted opacity-50";
                  marker = String.fromCharCode(65 + oi);
                } else {
                  cls +=
                    "border-panel-border text-muted hover:border-command-gold/50";
                  marker = String.fromCharCode(65 + oi);
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => pick(qi, oi)}
                    disabled={solved || isRuledOut}
                    className={cls}
                  >
                    <span className="w-4 shrink-0 text-center font-mono text-xs font-bold">
                      {marker}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {solved && q.explain ? (
              <p className="mt-1 font-serif text-sm italic text-muted">
                {q.explain}
              </p>
            ) : missed ? (
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-alert-red">
                Not quite — try another.
              </p>
            ) : null}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-4">
        <span
          className={
            "font-mono text-sm font-bold uppercase tracking-wider " +
            (allSolved ? "text-status-green" : "text-command-gold")
          }
        >
          {solvedCount} / {questions.length} correct
        </span>
        {recording ? (
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Recording…
          </span>
        ) : context && passed ? (
          <span className="font-mono text-xs uppercase tracking-wider text-status-green">
            ✓ recorded for the stage gate
          </span>
        ) : null}
        {selected.some((s) => s !== null) ? (
          <button
            type="button"
            onClick={reset}
            className="rounded border border-panel-border px-3 py-2 font-mono text-xs uppercase tracking-wider text-link-muted transition-colors hover:border-command-gold"
          >
            Start over
          </button>
        ) : null}
      </div>
    </section>
  );
}
