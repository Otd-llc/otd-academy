import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth-helpers";
import { dueReviewItems } from "@/lib/logbook/review-load";
import { ReviewDeck, type ReviewDeckItem } from "@/components/review/ReviewDeck";

// Fisher-Yates on the server (RSC): the client receives the shuffled display order
// + the display->original permutation, so there is no client randomness / hydration
// mismatch, and repeated review can't train the answer's screen position.
function shuffleIndices(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

// The spaced-review deck (step 4). Private + signed-in only (non-public path, gated
// by the route gate; this redirect is the defense-in-depth backstop). Per-user, so
// nothing to cache — dynamic by default under cacheComponents.
export const metadata: Metadata = {
  title: "Review",
  robots: { index: false, follow: false },
};

export default async function ReviewPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const user = { id: userId };

  // Overdue-first selection (dueReviewItems orders by dueOn), then de-mass the
  // PRESENTATION order so a session isn't strictly oldest-first blocks of one stage.
  const raw = await dueReviewItems(user.id, new Date());
  const itemOrder = shuffleIndices(raw.length);
  const items: ReviewDeckItem[] = itemOrder.map((ri) => {
    const it = raw[ri]!;
    const order = shuffleIndices(it.options.length); // display -> original
    return {
      reviewItemId: it.reviewItemId,
      q: it.q,
      options: order.map((oi) => it.options[oi]!),
      originalIndex: order,
      answerDisplay: order.indexOf(it.answer),
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          Spaced review
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-wide text-title">
          Review deck
        </h1>
        <p className="mt-2 font-serif text-[15px] leading-relaxed text-muted">
          Questions you have already seen, resurfaced on a spacing schedule. Answer
          each one to push it further out; a miss brings it back sooner.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded border border-panel-border/60 px-4 py-10 text-center">
          <p className="font-serif text-base text-text">Nothing due right now.</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
            Come back later, or answer more lesson quizzes to fill the deck.
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-block font-mono text-[11px] uppercase tracking-wider text-signal-blue underline-offset-4 hover:underline"
          >
            Back to courses →
          </Link>
        </div>
      ) : (
        <ReviewDeck items={items} />
      )}
    </main>
  );
}
