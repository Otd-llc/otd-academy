"use client";

// The /review deck client island (step 4). Grade-as-you-go over the learner's DUE
// items: pick, see it marked instantly, the server advances the schedule, then
// Next. Option order is SHUFFLED PER ITEM ON THE SERVER (the page sends the shuffled
// display + a display->original permutation), so there is no client-side randomness
// and no hydration mismatch, while repeated exposure still can't train the answer's
// position (response learning). `recordReviewAnswer` is authoritative on scoring +
// XP; the correct option is returned in the ANSWER of that response (never
// shipped in the payload), so it can't be read before answering.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { recordReviewAnswer } from "@/lib/actions/logbook";
import { useFanfare } from "@/components/logbook/Fanfare";

export type ReviewDeckItem = {
  reviewItemId: string;
  q: string;
  /** Options in shuffled DISPLAY order. */
  options: string[];
  /** displayIndex -> ORIGINAL option index (what the server scores against). */
  originalIndex: number[];
};

export function ReviewDeck({ items }: { items: ReviewDeckItem[] }) {
  const [pos, setPos] = useState(0);
  const [pickedDisplay, setPickedDisplay] = useState<number | null>(null);
  // The correct DISPLAY index, learned from the server response (not shipped in
  // the payload). Null until answered.
  const [answerDisplay, setAnswerDisplay] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [xp, setXp] = useState(0);
  const firedRef = useRef(false);
  const fanfare = useFanfare();

  // Focus management (audit Phase 7): grading used to `disabled` the focused
  // option (focus dumped to <body>) and next() replaced the card with focus
  // stranded on a removed button. On grade → focus the Next control; on
  // advance → focus the new question.
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLParagraphElement | null>(null);
  const answered = pickedDisplay !== null;
  useEffect(() => {
    if (answered) nextBtnRef.current?.focus();
  }, [answered]);
  useEffect(() => {
    if (pos > 0 && pos < items.length) questionRef.current?.focus();
  }, [pos, items.length]);

  if (pos >= items.length) {
    return (
      <div className="rounded border border-status-green/40 bg-status-green/5 px-4 py-10 text-center">
        <p className="font-display text-2xl tracking-wide text-title">Deck cleared</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {reviewed} reviewed
          {xp > 0 ? ` · +${xp} XP` : ""}
        </p>
        <Link
          href="/logbook"
          className="mt-5 inline-block font-mono text-[11px] uppercase tracking-wider text-signal-blue underline-offset-4 hover:underline"
        >
          Back to your logbook →
        </Link>
      </div>
    );
  }

  const item = items[pos]!;
  const correct = answered && pickedDisplay === answerDisplay;

  async function pick(displayIdx: number) {
    if (answered || firedRef.current) return;
    firedRef.current = true;
    setPickedDisplay(displayIdx);
    const res = await recordReviewAnswer({
      reviewItemId: item.reviewItemId,
      pick: item.originalIndex[displayIdx]!,
    });
    if (res && "ok" in res && res.ok) {
      // Map the server's ORIGINAL correct index to its display slot so the
      // reveal can green it (the payload never carried the answer).
      const disp = item.originalIndex.indexOf(res.answer);
      setAnswerDisplay(disp >= 0 ? disp : null);
      if (res.xp > 0) {
        setXp((x) => x + res.xp);
        if (res.levelUp) {
          fanfare({ kind: "level", label: res.levelUp.title, xp: res.xp });
        }
      }
    }
  }

  function next() {
    setReviewed((r) => r + 1);
    setPickedDisplay(null);
    setAnswerDisplay(null);
    firedRef.current = false;
    setPos((p) => p + 1);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Item {pos + 1} of {items.length}
        </span>
        {xp > 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
            +{xp} XP
          </span>
        ) : null}
      </div>

      <p
        ref={questionRef}
        tabIndex={-1}
        className="mb-5 font-serif text-lg leading-relaxed text-text outline-none"
      >
        {item.q}
      </p>

      <ul
        className="space-y-2"
        role="group"
        aria-label={`Item ${pos + 1} answer options`}
      >
        {item.options.map((opt, displayIdx) => {
          const isPicked = pickedDisplay === displayIdx;
          const isAnswer = displayIdx === answerDisplay;
          const reveal = answered && (isPicked || isAnswer);
          const tone = reveal
            ? isAnswer
              ? "border-status-green text-status-green"
              : "border-alert-red text-alert-red line-through"
            : "border-panel-border text-text hover:border-command-gold/60";
          // aria-disabled + guard (pick() ignores repeat calls), NOT disabled:
          // disabling all options on grade ejected keyboard focus to <body>.
          return (
            <li key={displayIdx}>
              <button
                type="button"
                aria-disabled={answered}
                onClick={() => pick(displayIdx)}
                className={`w-full rounded border px-3 py-2 text-left font-serif text-[15px] leading-relaxed transition-colors ${answered ? "cursor-default" : ""} ${tone}`}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>

      {/* role="status": the Correct / Not quite verdict was a static span,
          silent to screen readers. */}
      <div role="status">
        {answered ? (
          <div className="mt-5 flex items-center justify-between">
            <span
              className={`font-mono text-[11px] uppercase tracking-wider ${
                correct ? "text-status-green" : "text-alert-red"
              }`}
            >
              {correct ? "Correct" : "Not quite"}
            </span>
            <button
              ref={nextBtnRef}
              type="button"
              onClick={next}
              className="glass-button px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider"
            >
              {pos + 1 < items.length ? "Next →" : "Finish"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
