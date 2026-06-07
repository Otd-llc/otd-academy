"use client";

// Interactive multiple-choice comprehension check (the `quiz` content block).
//
// Client-scored with immediate, per-question feedback (the "testing effect" works
// best WITH feedback): the learner picks an answer per question, hits "Check
// answers", and sees each option marked correct/incorrect, the explanation, and a
// running score — then can retry. This is ADDITIVE to the stage work-gate, not a
// replacement, so it never blocks the build pipeline.
//
// Scoring stays client-side for instant feedback. SOFT-GATING: when a learner
// gets every question right AND the card supplies a `quizContext` (revisionId +
// stage), we persist the pass via `recordQuizPass` so the stage exit gate can
// require it (ANDed with the work-gate). Without a context (e.g. the editor
// preview), the quiz is a pure self-check and records nothing.

import { useState } from "react";
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
  const [selected, setSelected] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [checked, setChecked] = useState(false);
  const [passed, setPassed] = useState(context?.passed ?? false);
  const [recording, setRecording] = useState(false);

  const allAnswered = selected.every((s) => s !== null);
  const score = questions.reduce(
    (n, q, i) => (selected[i] === q.answer ? n + 1 : n),
    0,
  );

  function pick(qi: number, oi: number) {
    if (checked) return;
    setSelected((prev) => prev.map((s, i) => (i === qi ? oi : s)));
  }
  function reset() {
    setSelected(questions.map(() => null));
    setChecked(false);
  }

  async function check() {
    setChecked(true);
    // Record the pass once, only on a perfect score with a live card context.
    if (
      !passed &&
      context &&
      questions.every((q, i) => selected[i] === q.answer)
    ) {
      setRecording(true);
      try {
        const res = await recordQuizPass({
          enrollmentId: context.enrollmentId,
          stage: context.stage,
          score: questions.length,
          total: questions.length,
        });
        if (res.ok) setPassed(true);
      } catch {
        // Soft: a failed write never blocks the self-check. The gate simply
        // stays closed until a pass is successfully recorded.
      } finally {
        setRecording(false);
      }
    }
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

      {questions.map((q, qi) => (
        <fieldset key={qi} className="space-y-2">
          <legend className="font-serif text-base leading-relaxed text-gray-1">
            {qi + 1}. {q.q}
          </legend>
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => {
              const isSel = selected[qi] === oi;
              const isCorrect = oi === q.answer;
              let cls =
                "flex w-full items-center gap-2.5 rounded border px-3 py-2 text-left font-serif text-sm transition-colors ";
              if (!checked) {
                cls += isSel
                  ? "border-command-gold bg-command-gold/10 text-gray-1"
                  : "border-panel-border text-muted hover:border-command-gold/50";
              } else if (isCorrect) {
                cls += "border-status-green bg-status-green/10 text-status-green";
              } else if (isSel) {
                cls += "border-alert-red bg-alert-red/10 text-alert-red";
              } else {
                cls += "border-panel-border text-muted opacity-60";
              }
              const marker =
                checked && isCorrect
                  ? "✓"
                  : checked && isSel
                    ? "✗"
                    : String.fromCharCode(65 + oi);
              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => pick(qi, oi)}
                  disabled={checked}
                  aria-pressed={isSel}
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
          {checked && q.explain ? (
            <p className="mt-1 font-serif text-sm italic text-muted">
              {q.explain}
            </p>
          ) : null}
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={!allAnswered}
            className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check answers
          </button>
        ) : (
          <>
            <span className="font-mono text-sm font-bold uppercase tracking-wider text-command-gold">
              {score} / {questions.length} correct
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
            <button
              type="button"
              onClick={reset}
              className="rounded border border-panel-border px-3 py-2 font-mono text-xs uppercase tracking-wider text-link-muted transition-colors hover:border-command-gold"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  );
}
