import { db } from "@/lib/db";

// The signed-in user's subscription that needs their attention (a renewal payment failed
// or the sub lapsed), or null. Derived LIVE from the Subscription mirror — no new state.
// Access itself already follows this status (the webhook revokes on any non-active
// status); this is purely for the in-app dunning nudge on /account + the learner home.
const NEEDS_ATTENTION = ["past_due", "unpaid", "incomplete"];

export async function pastDueSubscription(
  userId: string,
): Promise<{ id: string; status: string } | null> {
  return db.subscription.findFirst({
    where: { userId, status: { in: NEEDS_ATTENTION } },
    select: { id: true, status: true },
  });
}
