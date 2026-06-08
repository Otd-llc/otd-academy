"use server";

// Admin entitlement actions (Task A5). `grantEntitlement` comps a learner access
// to a project — the manual unlock path until the Stripe webhook lands (Phase 3).
// Admin-gated and idempotent: re-granting the same (user, project) is a no-op on
// the existing GRANT row (the [userId, projectId] unique backs the upsert).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

const grantEntitlementSchema = z.object({
  userId: z.cuid(),
  projectId: z.cuid(),
});

export async function grantEntitlement(
  input: unknown,
): Promise<{ ok: true }> {
  const { userId, projectId } = grantEntitlementSchema.parse(input);
  await requireAdmin();

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { slug: true },
  });

  // Idempotent: `update: {}` leaves an existing GRANT (and its createdAt)
  // untouched, so re-granting neither throws nor duplicates.
  await db.entitlement.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {},
    create: { userId, projectId, source: "GRANT" },
  });

  revalidatePath(`/learn/${project.slug}`);
  return { ok: true };
}
