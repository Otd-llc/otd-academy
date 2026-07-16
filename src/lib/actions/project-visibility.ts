"use server";

// Admin access-tier toggle action (skill-tree Task 10). `setProjectAccessTier`
// flips a project's `accessTier` (PUBLIC | FREE | PREMIUM) — the dimension the
// /courses skill tree reads to decide preview / free-account-gate / paywall.
// Pure tier flip: it does NOT touch price (`priceCents`/`stripePriceId`) — that
// is a separate admin concern (project-price.ts).
//
// "use server" rule: this file exports ONLY async functions. The zod schema and
// the tier type are module-local — a `export const schema` / `export type {…}`
// here compiles clean under tsc/build but crashes at runtime (use-server rule).
import { revalidatePath } from "next/cache";
import { invalidateProjectGraph } from "@/lib/cache-invalidate";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

// Module-local — NOT exported (see the "use server" note above).
const setProjectAccessTierSchema = z.object({
  slug: z.string().min(1),
  tier: z.enum(["PUBLIC", "FREE", "PREMIUM"]),
});

/**
 * Set a project's access tier (admin-gated).
 *
 * Validates input, asserts the caller is an admin, updates `Project.accessTier`
 * by slug, then revalidates `/courses` so the skill tree reflects the new tier.
 */
export async function setProjectAccessTier(input: {
  slug: string;
  tier: "PUBLIC" | "FREE" | "PREMIUM";
}): Promise<{ ok: true }> {
  const { slug, tier } = setProjectAccessTierSchema.parse(input);
  await requireAdmin();

  await db.project.update({
    where: { slug },
    data: { accessTier: tier },
  });

  // The skill tree reads accessTier; refresh the index after a flip.
  // This one previously worked only by coincidence -- it happens to name /courses,
  // whose implicit tag reaches the cached graph. The tag makes it correct by design.
  invalidateProjectGraph();
  revalidatePath("/courses");

  return { ok: true };
}
