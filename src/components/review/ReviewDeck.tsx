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
import { isGraded, reviewVerdict } from "@/lib/review-verdict";

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
  // The THIRD state. A failed save is not a wrong answer: the correct option
  // only ever arrives in the response, so when the call fails we do not know
  // the answer and MUST NOT grade. Previously the failure branch was silent,
  // leaving answerDisplay null — which made `correct` false and announced
  // "Not quite" to a learner who may well have been right.
  const [saveError, setSaveError] = useState<null | "auth" | "error">(null);
  const firedRef = useRef(false);
  const fanfare = useFanfare();

  // Focus management (audit Phase 7): grading used to `disabled` the focused
  // option (focus dumped to <body>) and next() replaced the card with focus
  // stranded on a removed button. On grade → focus the Next control; on
  // advance → focus the new question.
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const questionRef = useRef<HTMLParagraphElement | null>(null);
  const answered = pickedDisplay !== null;
  const verdict = reviewVerdict(pickedDisplay, answerDisplay);
  // Grade ONLY once the server has told us the answer. Deriving the verdict from
  // `answered` alone treats "we never found out" as "you were wrong".
  const graded = isGraded(verdict);
  // Focus the Next control when it appears — it renders on `graded`, not on
  // `answered`, so keying this on `answered` would fire while it is still absent.
  useEffect(() => {
    if (graded) nextBtnRef.current?.focus();
  }, [graded]);
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
  const correct = verdict === "correct";

  async function pick(displayIdx: number) {
    if (answered || firedRef.current) return;
    firedRef.current = true;
    setPickedDisplay(displayIdx);
    setSaveError(null);
    let res: Awaited<ReturnType<typeof recordReviewAnswer>> | null = null;
    try {
      res = await recordReviewAnswer({
        reviewItemId: item.reviewItemId,
        pick: item.originalIndex[displayIdx]!,
      });
    } catch {
      // A Zod throw inside the action, or a transport failure. Same outcome as
      // any other non-success: we have no answer, so we cannot grade.
      res = null;
    }
    if (res && "ok" in res && res.ok) {
      if (res.xp > 0) {
        setXp((x) => x + res.xp);
        if (res.levelUp) {
          fanfare({ kind: "level", label: res.levelUp.title, xp: res.xp });
        }
      }
      // Map the server's ORIGINAL correct index to its display slot so the
      // reveal can green it (the payload never carried the answer).
      const disp = item.originalIndex.indexOf(res.answer);
      if (disp >= 0) {
        setAnswerDisplay(disp);
        return;
      }
      // Defensive: originalIndex is a permutation of every option, so the answer
      // is always in it. If that ever stops holding there is nothing to reveal,
      // and leaving answerDisplay null would strand the card — no verdict AND no
      // Next control, since both now render on `graded`. Fall through instead.
    }
    // Not graded. Roll the pick back so nothing on screen reads as a verdict,
    // surface why, and release firedRef so the learner can retry the same item
    // (the schedule did not advance, so a retry is not a second attempt).
    setSaveError(
      res && "needsAuth" in res && res.needsAuth ? "auth" : "error",
    );
    setPickedDisplay(null);
    firedRef.current = false;
  }

  function next() {
    setReviewed((r) => r + 1);
    setPickedDisplay(null);
    setAnswerDisplay(null);
    setSaveError(null);
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
          // Key the reveal on `graded`, not `answered`: between the pick and the
          // server's reply we know nothing, and `answered` alone would tint the
          // picked option red line-through for the whole in-flight window.
          const reveal = graded && (isPicked || isAnswer);
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
        {saveError ? (
          <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-alert-red">
            {saveError === "auth" ? (
              <>
                Your session expired, so this answer was not saved.{" "}
                <Link href="/sign-in" className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                and pick again.
              </>
            ) : (
              "That answer could not be graded. Pick again to retry."
            )}
          </p>
        ) : null}
        {graded ? (
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
