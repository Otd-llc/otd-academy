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
      {questions.map((q, qi) => {
        const newSection = q.section && q.section !== questions[qi - 1]?.section;
        return (
          <Fragment key={q.id}>
            {newSection && (
              <p className="pt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-command-gold">
                // {q.section}
              </p>
            )}
            <fieldset className="glass-card space-y-3 p-5">
              <legend className="font-serif text-base leading-relaxed text-gray-1">
                {qi + 1}. {q.prompt}
              </legend>
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="flex cursor-pointer items-center gap-2 font-mono text-sm text-gray-1"
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    disabled={locked}
                  />
                  {opt}
                </label>
              ))}
            </fieldset>
          </Fragment>
        );
      })}

      {result && !result.passed && (
        <div className="glass-card border-alert-red/45 p-5">
          <p className="font-display text-2xl tracking-wider text-white">
            {result.score} / {result.total}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-alert-red">
            Not passed — {passThreshold}% required. Review and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
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
          className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
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
