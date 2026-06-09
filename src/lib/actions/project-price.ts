"use server";

// Admin price-setup action (Task A5, GTM Phase 3). `setProjectPrice` creates the
// Stripe Product + a one-time Price for a project and stores the resulting
// `stripePriceId` (+ a display `priceCents`) on the Project row. The checkout
// action (A3) then sells against that stored price id.
//
// Scope note: this ONLY sets the price. Flagging a project `accessTier: PREMIUM`
// (so the paywall actually offers a Buy button) is a separate admin concern.
//
// v1 idempotency: if a price already exists we just create a new Product/Price
// and overwrite the stored id — acceptable for now (no Stripe-side cleanup).
//
// "use server" rule: this file exports ONLY async functions. No type re-exports
// (a `export type { … }` here crashes at runtime, uncaught by tsc/build).
//
// BUILD-SAFETY: `getStripe()` is called only inside the action body (never at
// import), so importing this module with no Stripe keys is always safe.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { getStripe } from "@/lib/stripe";

const setProjectPriceSchema = z.object({
  projectId: z.cuid(),
  // Whole cents, strictly positive (a free course has no price — use the tier,
  // not a 0 price).
  priceCents: z.number().int().positive(),
});

/**
 * Set (or replace) a project's purchase price.
 *
 * Admin-gated. Validates input, loads the project, creates a Stripe Product then
 * a one-time Price (USD, `unit_amount: priceCents`, no `recurring`), persists the
 * new `stripePriceId` + `priceCents` on the Project, revalidates the admin page +
 * guide hub, and returns the new `{ stripePriceId }`.
 */
export async function setProjectPrice(input: {
  projectId: string;
  priceCents: number;
}): Promise<{ stripePriceId: string }> {
  const { projectId, priceCents } = setProjectPriceSchema.parse(input);
  await requireAdmin();

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, slug: true },
  });
  if (!project) {
    throw new Error("Project not found.");
  }

  // A Stripe Product groups Prices; the one-time Price carries the actual amount.
  const product = await getStripe().products.create({
    name: project.name,
    metadata: { projectId: project.id },
  });
  const price = await getStripe().prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: priceCents,
    // One-time: deliberately NO `recurring` — this is a lifetime unlock, not a sub.
  });

  await db.project.update({
    where: { id: project.id },
    data: { stripePriceId: price.id, priceCents },
  });

  // Admin page shows the current price; the guide hub's paywall reads it.
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath(`/learn/${project.slug}`);

  return { stripePriceId: price.id };
}
