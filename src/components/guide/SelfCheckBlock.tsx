"use client";

// SelfCheckBlock — the per-section "Check yourself", evolved to the C5
// write-then-compare pattern: the learner must WRITE an attempt (forced
// generation) before the authored answer unlocks, then compares. Retrieval
// practice with feedback beats a passive "Show" reveal.
//
// CLIENT component. Interactive but SESSION-ONLY (not persisted): a self-check
// resets to its fresh, interactive state on every page load so it can always be
// re-attempted (persisting the reveal would lock it open forever). Body is
// "…question?  answer." — split at the last "?" so the prompt is the question
// and the rest is the reveal (unchanged authoring format, so every existing
// check upgrades with no content edits).

import { useState } from "react";
import { Inline } from "@/components/guide/InlineText";
import { trackFormativeCheck } from "@/lib/analytics-client";

const TEXTAREA =
  "w-full resize-none rounded border border-panel-border bg-transparent px-3 py-2 font-serif text-[15px] leading-relaxed text-text placeholder:text-gray-3 focus:border-command-gold focus:outline-none";

export function SelfCheckBlock({
  body,
  severity,
}: {
  body: string;
  severity: "critical" | "warn" | "info";
}) {
  const cut = body.lastIndexOf("?");
  const question = cut >= 0 ? body.slice(0, cut + 1).trim() : body.trim();
  const answer = cut >= 0 ? body.slice(cut + 1).trim() : "";
  const accent = severity === "critical" ? "text-alert-red" : "text-command-gold";

  // Session-only, NOT persisted: a self-check should always greet the learner
  // fresh (a blank attempt, answer hidden) so it's re-attemptable every visit.
  // Persisting the revealed state would lock it open forever with no way to
  // re-test — so on every page load it resets to the interactive gated state.
  const [attempt, setAttempt] = useState("");
  const [revealed, setRevealed] = useState(false);

  const canReveal = attempt.trim().length >= 3;

  // No answer authored → a plain reflection prompt (no textarea/reveal).
  if (!answer) {
    return (
      <section className="border-t border-panel-border/60 pt-5">
        <p className={`mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${accent}`}>
          Check yourself
        </p>
        <p className="font-serif text-base leading-relaxed text-text">
          <Inline text={question} />
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-panel-border/60 pt-5">
      <p className={`mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${accent}`}>
        Check yourself
      </p>
      <p className="mb-3 font-serif text-base leading-relaxed text-text">
        <Inline text={question} />
      </p>
      {!revealed ? (
        // Write-first: an editable attempt, then the reveal unlocks once written.
        <>
          <textarea
            className={TEXTAREA}
            rows={2}
            placeholder="Write an attempt first, then compare…"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            aria-label="Your answer"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canReveal}
              onClick={() => {
                setRevealed(true);
                // Reveal is a one-time false->true transition, so this fires once.
                trackFormativeCheck("self_check", "revealed");
              }}
              className="glass-button px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
            >
              Compare with the answer
            </button>
            {!canReveal ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                write an attempt to unlock
              </span>
            ) : null}
          </div>
        </>
      ) : (
        // Compared: the editable box is gone — your attempt reads back READ-ONLY
        // beside the authored answer, a clean two-part compare (no lingering form).
        <>
          <div className="border-l-2 border-panel-border/70 pl-3">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Your answer
            </p>
            <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">
              {attempt.trim() || "(left blank)"}
            </p>
          </div>
          <div className="mt-3 border-l-2 border-command-gold/50 pl-3">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">
              The answer
            </p>
            <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">
              <Inline text={answer} />
            </p>
          </div>
        </>
      )}
    </section>
  );
}
