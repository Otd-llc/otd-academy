// Tier 3 (design §2, deferred then built): a per-user rate limit on the
// authenticated Stripe checkout/portal actions. Complementary to Stripe's own
// account-wide 100 req/s limit — a flood degrades real buyers' checkout.
//
// FAIL-OPEN: a Stripe session is reversible (it expires), so an Upstash outage
// must not block a real purchase. Throws on a deny; the caller actions already
// surface thrown errors to the UI.
import { enforce } from "@/lib/abuse-limit";
import { userCheck } from "@/lib/abuse-policy";
import { defenseEnabled } from "@/lib/abuse-defense-flag";

export async function enforceCheckoutLimit(userId: string): Promise<void> {
  if (!(await defenseEnabled())) return;
  const verdict = await enforce([userCheck(userId)], "open");
  if (!verdict.ok) {
    throw new Error("Too many checkout attempts. Please try again shortly.");
  }
}
