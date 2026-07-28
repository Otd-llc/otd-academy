// The verdict rule for the /review deck, kept in its own dependency-free module.
//
// It lives here rather than in ReviewDeck.tsx for a practical reason: that file
// imports `recordReviewAnswer`, which transitively pulls next-auth, and next-auth
// does not resolve under vitest. Importing the component to test one pure function
// fails at collection. Here it is trivially testable — see
// src/lib/__tests__/review-verdict.test.ts.
//
// The rule it enforces: the correct option is known ONLY from the server's
// response (it is deliberately never shipped in the page payload, so it can't be
// read before answering). A pick whose save failed therefore carries NO verdict.
// Collapsing that case into "wrong" is what told a learner whose session had
// expired that a right answer was wrong.

/** `awaiting` = picked, but the server never told us the answer. Not a verdict. */
export type ReviewVerdict = "unanswered" | "awaiting" | "correct" | "wrong";

export function reviewVerdict(
  pickedDisplay: number | null,
  answerDisplay: number | null,
): ReviewVerdict {
  if (pickedDisplay === null) return "unanswered";
  if (answerDisplay === null) return "awaiting";
  return pickedDisplay === answerDisplay ? "correct" : "wrong";
}

/** True only for a real grade — never for an ungraded or unanswered card. */
export function isGraded(v: ReviewVerdict): boolean {
  return v === "correct" || v === "wrong";
}
