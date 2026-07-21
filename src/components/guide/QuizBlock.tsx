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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recordQuizPass } from "@/lib/actions/quiz";
import {
  recordQuizAnswer,
  recordLessonComplete,
  recordStageQuizAnswer,
} from "@/lib/actions/logbook";
import { Inline } from "@/components/guide/InlineText";
import { XpTick } from "@/components/library/XpTick";
import { patchLabel, artForBadge } from "@/lib/logbook/patches";
import { useFanfare } from "@/components/logbook/Fanfare";
import { trackSigninToLogClicked } from "@/lib/analytics-client";

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

/** Logbook XP wiring (design §9.3 + Phase 2). `questionKeys` is aligned
 *  index-for-index with `questions` and computed SERVER-SIDE (questionKey is
 *  node:crypto). `state` is today's per-key state. `signInHref` is the
 *  callbackUrl-carrying sign-in link. Discriminated by `mode`: library quizzes
 *  award per pick + complete the lesson; course (build-guide) quizzes award per
 *  pick against the guide card (completion is the separate stage gate). */
export type QuizLogbook = {
  signedIn: boolean;
  signInHref: string;
  questionKeys: string[];
  state: Record<string, "earned" | "locked" | "open">;
} & (
  | { mode: "library"; slug: string }
  | { mode: "course"; enrollmentId: string; stage: string }
);

export function QuizBlock({
  prompt,
  questions,
  context,
  logbook,
}: {
  prompt?: string;
  questions: QuizQuestion[];
  context?: QuizContext;
  logbook?: QuizLogbook;
}) {
  // `selected[qi]` is the learner's latest pick on question qi; `wrong[qi]` is the
  // set of options they've already ruled out (picked wrong) there.
  const [selected, setSelected] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [wrong, setWrong] = useState<number[][]>(() => questions.map(() => []));
  const [passed, setPassed] = useState(context?.passed ?? false);
  const [recording, setRecording] = useState(false);

  // Logbook XP overlay (Library only). Async + optimistic (design §3): the award
  // POST is fired on the FIRST pick and never awaited before the instant grade.
  // Server owns the amount — the client renders res.xp, never a guess.
  const lb = logbook;
  const [xpShown, setXpShown] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [qLocked, setQLocked] = useState<boolean[]>(() =>
    questions.map((_q, i) => lb?.state[lb.questionKeys[i]] === "locked"),
  );
  const qEarnedPrior = questions.map(
    (_q, i) => lb?.state[lb.questionKeys[i]] === "earned",
  );
  const [completion, setCompletion] = useState<{
    xp: number;
    badges: string[];
  } | null>(null);
  const answerChain = useRef<Promise<unknown>[]>(
    questions.map(() => Promise.resolve() as Promise<unknown>),
  );
  const firedAnswer = useRef<boolean[]>(questions.map(() => false));
  const completeFired = useRef(false);
  const fanfare = useFanfare();

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
    fireAnswer(qi, oi);
  }

  // Record the FIRST pick's outcome to the Logbook (design §9.3). One call per
  // question: a wrong first pick writes the QuizLock (which the completion check
  // depends on) and greys the slot; a correct first pick awards, and the tick
  // shows the SERVER's amount. Chained per question so a lock lands before any
  // later award for the same key.
  function fireAnswer(qi: number, oi: number) {
    if (!lb?.signedIn) return;
    const key = lb.questionKeys[qi];
    if (!key) return;
    if (firedAnswer.current[qi] || qEarnedPrior[qi] || qLocked[qi]) return;
    firedAnswer.current[qi] = true;
    answerChain.current[qi] = answerChain.current[qi]
      .then(() =>
        lb.mode === "course"
          ? recordStageQuizAnswer({
              enrollmentId: lb.enrollmentId,
              stage: lb.stage,
              questionKey: key,
              pick: oi,
            })
          : recordQuizAnswer({ slug: lb.slug, questionKey: key, pick: oi }),
      )
      .then((res) => {
        if (!res || !("ok" in res) || !res.ok) return;
        if ("correct" in res && res.correct) {
          if (res.xp > 0) {
            setXpShown((prev) => prev.map((v, i) => (i === qi ? res.xp : v)));
          } else {
            setQLocked((prev) => prev.map((v, i) => (i === qi ? true : v)));
          }
          if (res.levelUp) {
            fanfare({ kind: "level", label: res.levelUp.title, xp: res.xp });
          }
        } else {
          setQLocked((prev) => prev.map((v, i) => (i === qi ? true : v)));
        }
      })
      .catch(() => {});
  }

  // Record the lesson completion once every question is solved (design §5). Wait
  // for the per-question writes so the server sees each key "attempted today"
  // (a correct award OR a lock). A quiet "lesson logged" line renders on success.
  useEffect(() => {
    // Course quizzes have no logbook "completion" — the stage gate (recordQuizPass)
    // + STAGE_CLEAR handle progress. Only library lessons log a completion here.
    if (!lb?.signedIn || lb.mode !== "library" || !allSolved || completeFired.current)
      return;
    completeFired.current = true;
    const slug = lb.slug;
    Promise.allSettled(answerChain.current)
      .then(() => recordLessonComplete({ slug }))
      .then((res) => {
        if (res && "ok" in res && res.ok) {
          setCompletion({ xp: res.xp, badges: res.newBadges });
          if (res.levelUp) {
            fanfare({ kind: "level", label: res.levelUp.title, xp: res.xp });
          }
          for (const b of res.newBadges) {
            fanfare({ kind: "patch", label: patchLabel(b), art: artForBadge(b) });
          }
        }
      })
      .catch(() => {});
    // Fire only on the all-solved transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSolved]);

  function reset() {
    setSelected(questions.map(() => null));
    setWrong(questions.map(() => []));
  }

  return (
    <section className="space-y-7">
      {/* honey gradient for the correct hex fill (styled by .qzh-* in globals.css) */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="quiz-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>

      {/* Open the check as a section on the field — a gold hairline + eyebrow,
          no boxed card (this is the build-guide console language, not a form). */}
      <div className="title-rule" aria-hidden="true" />

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
          {prompt ?? "Quick check"}
        </p>
        {context ? (
          passed ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-status-green/50 bg-status-green/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-status-green">
              ✓ Powered · gate
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-panel-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              ⬡ Gate · pass to advance
            </span>
          )
        ) : null}
      </div>

      {questions.map((q, qi) => {
        const solved = isSolved(qi);
        const ruledOut = wrong[qi];
        const missed = ruledOut.length > 0 && !solved;
        return (
          <fieldset key={qi} className="relative pl-14">
            {/* legend first (the accessible caption); the gold Saira question
                numeral floats in the left gutter (decorative). */}
            <legend className="font-serif text-base leading-relaxed text-gray-1">
              <Inline text={q.q} />
            </legend>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 font-numeral text-[2.5rem] font-extrabold leading-none text-command-gold"
            >
              {String(qi + 1).padStart(2, "0")}
            </span>

            <div className="qzh-opts mt-3">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answer;
                const isRuledOut = ruledOut.includes(oi);
                // ok = locked correct · bad = ruled out · dim = a non-answer once
                // the question is solved · undefined = still pickable.
                const st =
                  solved && isAnswer
                    ? "ok"
                    : isRuledOut
                      ? "bad"
                      : solved
                        ? "dim"
                        : undefined;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => pick(qi, oi)}
                    disabled={solved || isRuledOut}
                    data-st={st}
                    className="qzh-opt"
                  >
                    <span className="qzh-hex" aria-hidden="true">
                      <svg viewBox="0 0 28 32" preserveAspectRatio="none">
                        <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" />
                      </svg>
                      <b>{String.fromCharCode(65 + oi)}</b>
                    </span>
                    {/* plain: the option label lives inside the answer button. */}
                    <span><Inline text={opt} plain /></span>
                  </button>
                );
              })}
            </div>

            {solved ? (
              <div className="mt-3 space-y-1">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
                  ⬡ Powered — locked in.
                </p>
                {q.explain ? (
                  <p className="font-serif text-sm italic text-muted">
                    <Inline text={q.explain} />
                  </p>
                ) : null}
              </div>
            ) : missed ? (
              <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-alert-red">
                Not quite — ruled out, pick again.
              </p>
            ) : null}

            {/* Logbook XP slot (signed-in Library only): the tick on a fresh
                award, or a muted marker for an already-logged / locked question. */}
            {lb?.signedIn ? (
              <div className="mt-2 min-h-[1.1rem]">
                {xpShown[qi] != null ? (
                  <XpTick amount={xpShown[qi]!} />
                ) : qEarnedPrior[qi] ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    Logged today
                  </span>
                ) : qLocked[qi] ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">
                    Locked today · +0
                  </span>
                ) : null}
              </div>
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
            className="font-mono text-xs uppercase tracking-wider text-muted underline-offset-4 transition-colors hover:text-command-gold hover:underline"
          >
            Start over
          </button>
        ) : null}

        {/* Signed-out reader: the tick slot becomes the signup driver. */}
        {lb && !lb.signedIn ? (
          <Link
            href={lb.signInHref}
            onClick={() =>
              trackSigninToLogClicked(lb.mode === "library" ? lb.slug : lb.stage)
            }
            className="font-mono text-xs uppercase tracking-wider text-command-gold underline-offset-4 transition-colors hover:text-gold-light hover:underline"
          >
            Sign in to log XP
          </Link>
        ) : null}

        {completion ? (
          <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
            Lesson logged{completion.xp > 0 ? ` +${completion.xp} XP` : ""}
            {completion.badges.length > 0
              ? ` · ${completion.badges.map(patchLabel).join(", ")}`
              : ""}
          </span>
        ) : null}
      </div>
    </section>
  );
}
