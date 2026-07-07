"use client";

// First-run goal survey — one question, shown on /start until the learner has an
// onboardingGoal. Each option is a hairline row (content surface, not a filled
// card); picking one saves it and refreshes /start, which then renders the
// "start here" CTA. Skip records the sentinel so we don't re-ask.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingGoal } from "@/lib/actions/onboarding";
import { ONBOARDING_GOAL_OPTIONS } from "@/lib/onboarding-goals";

export function GoalSurvey() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function choose(goal: string) {
    start(async () => {
      setError(null);
      try {
        await saveOnboardingGoal({ goal });
        router.refresh();
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ First, one question
      </p>
      <h1 className="title-hero mt-2">What brings you to OTD Academy?</h1>
      <p className="mt-3 font-serif text-base text-text">
        Pick the closest. It tailors what we show you next.
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {ONBOARDING_GOAL_OPTIONS.map((o) => (
          <li key={o.key}>
            <button
              type="button"
              disabled={pending}
              onClick={() => choose(o.key)}
              className="group flex w-full items-center justify-between gap-4 border-b border-panel-border/60 py-5 text-left transition-colors hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none disabled:opacity-50"
            >
              <span className="font-serif text-lg text-text group-hover:text-gold-light">
                {o.label}
              </span>
              <span
                aria-hidden
                className="font-mono text-command-gold transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose("skipped")}
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
