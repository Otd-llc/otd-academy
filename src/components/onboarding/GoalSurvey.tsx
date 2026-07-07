"use client";

// First-run goal survey — one question, shown on /start until the learner has an
// onboardingGoal. Options render as the honeycomb quiz hexes (the A-Q3 look,
// reusing the real .qzh-* classes): picking one lights its hex honey, saves the
// goal, and refreshes /start into the "start here" CTA. Skip records the sentinel
// so we don't re-ask.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingGoal } from "@/lib/actions/onboarding";
import { ONBOARDING_GOAL_OPTIONS } from "@/lib/onboarding-goals";

export function GoalSurvey() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const router = useRouter();

  function choose(goal: string, index: number) {
    setChosen(index); // light the hex immediately for feedback
    start(async () => {
      setError(null);
      try {
        await saveOnboardingGoal({ goal });
        router.refresh();
      } catch {
        setChosen(null);
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <section>
      {/* Honey gradient for the selected hex fill (styled by .qzh-* / #quiz-honey). */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="quiz-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>

      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ First, one question
      </p>
      <h1 className="title-hero mt-2">Why are you here?</h1>
      <p className="mt-3 font-serif text-base text-text">
        Pick the closest. It tailors what we show you next.
      </p>

      <div className="qzh-opts mt-8">
        {ONBOARDING_GOAL_OPTIONS.map((o, i) => (
          <button
            key={o.key}
            type="button"
            disabled={pending}
            onClick={() => choose(o.key, i)}
            data-st={chosen === i ? "ok" : undefined}
            className="qzh-opt"
          >
            <span className="qzh-hex" aria-hidden="true">
              <svg viewBox="0 0 28 32" preserveAspectRatio="none">
                <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" />
              </svg>
              <b>{String.fromCharCode(65 + i)}</b>
            </span>
            <span className="flex flex-col gap-0.5 py-1">
              <span className="text-[1.05rem] leading-snug text-text">
                {o.label}
              </span>
              <span className="text-sm text-muted">{o.subline}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose("skipped", -1)}
          className="font-mono text-xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none disabled:opacity-50"
        >
          Skip
        </button>
        {error && (
          <span className="font-mono text-xs uppercase tracking-wider text-alert-red">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
