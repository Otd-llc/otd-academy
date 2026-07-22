"use client";

// The /review deck client island (step 4). Grade-as-you-go over the learner's DUE
// items: pick, see it marked instantly, the server advances the schedule, then
// Next. Option order is SHUFFLED PER ITEM ON THE SERVER (the page sends the shuffled
// display + a display->original permutation), so there is no client-side randomness
// and no hydration mismatch, while repeated exposure still can't train the answer's
// position (response learning). `recordReviewAnswer` is authoritative on scoring +
// XP; the client uses `answerDisplay` only for instant feedback.
import { useRef, useState } from "react";
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
  /** The display index of the correct option (client feedback only). */
  answerDisplay: number;
};

export function ReviewDeck({ items }: { items: ReviewDeckItem[] }) {
  const [pos, setPos] = useState(0);
  const [pickedDisplay, setPickedDisplay] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [xp, setXp] = useState(0);
  const firedRef = useRef(false);
  const fanfare = useFanfare();

  if (pos >= items.length) {
    return (
      <div className="rounded border border-status-green/40 bg-status-green/5 px-4 py-10 text-center">
        <p className="font-display text-2xl tracking-wide text-title">Deck cleared</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {reviewed} reviewed
          {xp > 0 ? ` · +${xp} XP` : ""}
        </p>
        <Link
          href="/courses"
          className="mt-5 inline-block font-mono text-[11px] uppercase tracking-wider text-signal-blue underline-offset-4 hover:underline"
        >
          Back to courses →
        </Link>
      </div>
    );
  }

  const item = items[pos]!;
  const answered = pickedDisplay !== null;
  const correct = answered && pickedDisplay === item.answerDisplay;

  async function pick(displayIdx: number) {
    if (answered || firedRef.current) return;
    firedRef.current = true;
    setPickedDisplay(displayIdx);
    const res = await recordReviewAnswer({
      reviewItemId: item.reviewItemId,
      pick: item.originalIndex[displayIdx]!,
    });
    if (res && "ok" in res && res.ok && "xp" in res && res.xp > 0) {
      setXp((x) => x + res.xp);
      if ("levelUp" in res && res.levelUp) {
        fanfare({ kind: "level", label: res.levelUp.title, xp: res.xp });
      }
    }
  }

  function next() {
    setReviewed((r) => r + 1);
    setPickedDisplay(null);
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

      <p className="mb-5 font-serif text-lg leading-relaxed text-text">{item.q}</p>

      <ul className="space-y-2">
        {item.options.map((opt, displayIdx) => {
          const isPicked = pickedDisplay === displayIdx;
          const isAnswer = displayIdx === item.answerDisplay;
          const reveal = answered && (isPicked || isAnswer);
          const tone = reveal
            ? isAnswer
              ? "border-status-green text-status-green"
              : "border-alert-red text-alert-red line-through"
            : "border-panel-border text-text hover:border-command-gold/60";
          return (
            <li key={displayIdx}>
              <button
                type="button"
                disabled={answered}
                onClick={() => pick(displayIdx)}
                className={`w-full rounded border px-3 py-2 text-left font-serif text-[15px] leading-relaxed transition-colors disabled:cursor-default ${tone}`}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>

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
            type="button"
            onClick={next}
            className="glass-button px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider"
          >
            {pos + 1 < items.length ? "Next →" : "Finish"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
