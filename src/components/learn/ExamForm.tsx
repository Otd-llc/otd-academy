"use client";

// Client island: renders the exam questions (NO answer key in the payload) and
// submits selected answers to the server-scored submitExam. Shows the score +
// pass/mastery result returned by the server.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitExam } from "@/lib/actions/exam";

interface Question {
  id: string;
  prompt: string;
  options: string[];
}

export function ExamForm({
  projectId,
  questions,
  passThreshold,
}: {
  projectId: string;
  questions: Question[];
  passThreshold: number;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<
    { score: number; total: number; passed: boolean } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="glass-card space-y-3 p-5">
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
                disabled={result !== null}
              />
              {opt}
            </label>
          ))}
        </fieldset>
      ))}

      {result ? (
        <div
          className={`glass-card border-l-4 p-5 ${
            result.passed ? "border-l-status-green" : "border-l-alert-red"
          }`}
        >
          <p className="font-display text-2xl tracking-wider text-white">
            {result.score} / {result.total}
          </p>
          <p
            className={`mt-1 font-mono text-xs uppercase tracking-wider ${
              result.passed ? "text-status-green" : "text-alert-red"
            }`}
          >
            {result.passed
              ? "✓ Passed — board MASTERED"
              : `Not passed — ${passThreshold}% required`}
          </p>
        </div>
      ) : (
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
