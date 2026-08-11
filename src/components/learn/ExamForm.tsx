"use client";

// Client island: renders the final-exam questions (NO answer key in the payload),
// grouped by build stage so it reads as a capstone, and submits to the
// server-scored submitExam. On a PASS it swaps in the CertificateReveal (the "you
// earned it" moment + continuation); on a fail it shows the score and lets the
// learner retry (re-takes are allowed).
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitExam } from "@/lib/actions/exam";
import {
  CertificateReveal,
  type NextLessonLink,
} from "@/components/learn/CertificateReveal";

interface Question {
  id: string;
  prompt: string;
  options: string[];
  section?: string;
}

export function ExamForm({
  projectId,
  questions,
  passThreshold,
  userName,
  projectName,
  slug,
  nextLessons,
}: {
  projectId: string;
  questions: Question[];
  passThreshold: number;
  userName: string;
  projectName: string;
  slug: string;
  nextLessons: NextLessonLink[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<
    { score: number; total: number; passed: boolean } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const locked = result !== null && result.passed; // passed → freeze the form

  // Passed: the whole form becomes the certificate reveal.
  if (result?.passed) {
    return (
      <CertificateReveal
        userName={userName}
        projectName={projectName}
        score={result.score}
        total={result.total}
        slug={slug}
        nextLessons={nextLessons}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* The honey gradient the selected hex fills with. `.qzh-hex polygon`
          references `url(#quiz-honey)`, so without this def a picked option
          renders an EMPTY hex and looks like nothing happened. QuizBlock ships
          the same def for the same reason. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="quiz-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>
      {questions.map((q, qi) => {
        const newSection = q.section && q.section !== questions[qi - 1]?.section;
        return (
          <Fragment key={q.id}>
            {newSection && (
              <p className="pt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-command-gold">
                // {q.section}
              </p>
            )}
            <fieldset className="border-t border-panel-border/60 pt-5">
              <legend className="font-serif text-base leading-relaxed text-text">
                {qi + 1}. {q.prompt}
              </legend>
              {/* HONEYCOMB OPTIONS, the same language the guide's quiz uses.
                  This screen rendered a native <input type="radio"> with
                  `text-gray-1` labels — a legacy token the design system
                  reserves for un-migrated internal screens, never a public one.
                  So the FINAL EXAM was the single assessment surface that did
                  not look like the product, while the inline checks a learner
                  meets on every card did. Same interaction, one visual language
                  now. The `.qzh-*` recipes already exist in globals.css and are
                  reused verbatim rather than reinvented. */}
              <div
                className="qzh-opts mt-3"
                // The question id, addressable. The native radios carried it as
                // `name`; the honeycomb buttons do not, and without it nothing
                // outside React can tell which question it is looking at.
                data-qid={q.id}
                role="radiogroup"
                aria-label={`Question ${qi + 1} answer options`}
              >
                {q.options.map((opt, oi) => {
                  const picked = answers[q.id] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      // aria-disabled, not `disabled`: disabling the button you
                      // just clicked ejects keyboard focus to <body>. QuizBlock
                      // learned this; the click guard below does the work.
                      aria-disabled={locked}
                      data-st={picked ? "ok" : undefined}
                      className="qzh-opt"
                      onClick={() => {
                        if (locked) return;
                        setAnswers((a) => ({ ...a, [q.id]: oi }));
                      }}
                    >
                      <span className="qzh-hex" aria-hidden="true">
                        <svg viewBox="0 0 28 32" preserveAspectRatio="none">
                          <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" />
                        </svg>
                        <b>{String.fromCharCode(65 + oi)}</b>
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Fragment>
        );
      })}

      {result && !result.passed && (
        <div className="glass-card border-alert-red/45 p-5">
          <p className="font-display text-2xl tracking-wider text-title">
            {result.score} / {result.total}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-alert-red">
            Not passed. {passThreshold}% required. Review and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
          >
            Try again
          </button>
        </div>
      )}

      {!result && (
        <button
          type="button"
          disabled={!allAnswered || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const res = await submitExam({ projectId, answers });
                setResult(res);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not submit.");
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
        >
          {pending ? "Scoring…" : "Submit exam"}
        </button>
      )}
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
