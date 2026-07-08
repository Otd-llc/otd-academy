"use server";

// Admin student-management actions. Every action is `requireAdmin`-gated (the
// authoritative write boundary; the /admin/* middleware view-gate is the match).
// These let an operator manage a learner account end to end: edit the profile,
// grant/revoke access (entitlements), reset a board's progress (an enrollment),
// and delete the account.
//
// NOT editable here: `role`. It is derived from the ALLOWED_EMAILS roster on
// every token refresh (the auth `jwt` callback recomputes it and overwrites the
// DB mirror), so a toggle here would silently revert. The detail page shows it
// read-only with that note.
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { getStripe } from "@/lib/stripe";

const ALL_ACCESS_KEY = "all-access";

function revalidateStudent(userId: string): void {
  revalidatePath(`/admin/students/${userId}`);
  revalidatePath("/admin/students");
}

// ─── updateStudentProfile ───────────────────────────────
// Edit the support-relevant profile fields. Name empties to null. Setting
// emailConsent stamps emailConsentUpdatedAt so the audit trail stays truthful
// (and the once-only lifecycle prompt logic keeps working).
const updateSchema = z
  .object({
    userId: z.cuid(),
    name: z.string().trim().max(200).nullable(),
    emailConsent: z.boolean(),
    onboardingGoal: z.string().trim().max(64).nullable(),
  })
  .strict();

export async function updateStudentProfile(
  input: unknown,
): Promise<{ ok: true }> {
  const data = updateSchema.parse(input);
  await requireAdmin();

  await db.user.update({
    where: { id: data.userId },
    data: {
      name: data.name && data.name.length > 0 ? data.name : null,
      emailConsent: data.emailConsent,
      emailConsentUpdatedAt: new Date(),
      onboardingGoal:
        data.onboardingGoal && data.onboardingGoal.length > 0
          ? data.onboardingGoal
          : null,
    },
  });

  revalidateStudent(data.userId);
  return { ok: true };
}

// ─── grantProjectEntitlement ────────────────────────────
// Comp a learner into a single board. Idempotent on the @@unique(userId,
// projectId): re-granting an existing one is a no-op that just re-stamps source.
const grantProjectSchema = z
  .object({ userId: z.cuid(), projectId: z.cuid() })
  .strict();

export async function grantProjectEntitlement(
  input: unknown,
): Promise<{ ok: true }> {
  const { userId, projectId } = grantProjectSchema.parse(input);
  await requireAdmin();

  await db.entitlement.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: { source: "GRANT" },
    create: { userId, projectId, source: "GRANT" },
  });

  revalidateStudent(userId);
  return { ok: true };
}

// ─── grantPassEntitlement ───────────────────────────────
// Comp a learner the All-Access Pass (a bundle entitlement → access to every
// board). Skips if they already hold any bundle entitlement.
const grantPassSchema = z.object({ userId: z.cuid() }).strict();

export async function grantPassEntitlement(
  input: unknown,
): Promise<{ ok: true }> {
  const { userId } = grantPassSchema.parse(input);
  await requireAdmin();

  const bundle = await db.bundle.findFirst({
    where: { key: ALL_ACCESS_KEY },
    select: { id: true },
  });
  if (!bundle) {
    throw new Error("No All-Access bundle is configured to grant.");
  }

  const existing = await db.entitlement.findFirst({
    where: { userId, bundleId: { not: null } },
    select: { id: true },
  });
  if (!existing) {
    await db.entitlement.create({
      data: { userId, bundleId: bundle.id, source: "GRANT" },
    });
  }

  revalidateStudent(userId);
  return { ok: true };
}

// ─── revokeEntitlement ──────────────────────────────────
// Remove a single entitlement (project grant or the pass). deleteMany scoped to
// the user so a bad id can't touch someone else's row.
const revokeSchema = z
  .object({ userId: z.cuid(), entitlementId: z.cuid() })
  .strict();

export async function revokeEntitlement(
  input: unknown,
): Promise<{ ok: true }> {
  const { userId, entitlementId } = revokeSchema.parse(input);
  await requireAdmin();

  await db.entitlement.deleteMany({ where: { id: entitlementId, userId } });

  revalidateStudent(userId);
  return { ok: true };
}

// ─── resetEnrollment ────────────────────────────────────
// Delete a learner's enrollment in a board, wiping their progress there (the
// enrollment's artifacts / quiz passes / exam attempts cascade). Scoped to the
// user so a bad id can't touch another learner's enrollment.
const resetSchema = z
  .object({ userId: z.cuid(), enrollmentId: z.cuid() })
  .strict();

export async function resetEnrollment(input: unknown): Promise<{ ok: true }> {
  const { userId, enrollmentId } = resetSchema.parse(input);
  await requireAdmin();

  await db.enrollment.deleteMany({ where: { id: enrollmentId, userId } });

  revalidateStudent(userId);
  return { ok: true };
}

// ─── deleteStudent ──────────────────────────────────────
// Permanently delete a learner account. The User delete cascades accounts,
// sessions, enrollments (+ their artifacts / attempts), and lifecycle sends; tips,
// certificates, and PURCHASES SetNull (kept, de-linked). GUARDS: an admin cannot
// delete their OWN account (footgun), and a delete that hits a Restrict FK (the
// account authored curriculum content) is surfaced as a clean error instead of a
// raw Prisma throw.
//
// GDPR / retention (deliberate): Purchase rows are financial records and SURVIVE a
// hard delete with userId → NULL — retaining payment-linked identifiers past a
// deletion request is lawful as a financial-record legal obligation, so "permanently
// delete" is not literal for the money trail. The retained Purchase.metadata snapshot
// holds only our own ids (userId/projectId/kind), never customer PII. Active Stripe
// SUBSCRIPTIONS are cancelled first (below), or an orphaned subscription would keep
// charging a vanished account (billing-audit design, finding 22).
const deleteSchema = z.object({ userId: z.cuid() }).strict();

export async function deleteStudent(input: unknown): Promise<{ ok: true }> {
  const { userId } = deleteSchema.parse(input);
  const admin = await requireAdmin();

  if (userId === admin.id) {
    throw new Error("You cannot delete your own account here.");
  }

  // Cancel any live Stripe subscriptions BEFORE the row delete. If a cancel fails we
  // THROW (rather than delete anyway), so a still-charging subscription can never be
  // orphaned by a vanished account — the admin resolves it in Stripe and retries.
  // getStripe() is only reached when there IS a live sub, keeping keyless envs safe.
  const activeSubs = await db.subscription.findMany({
    where: { userId, status: { notIn: ["canceled", "incomplete_expired"] } },
    select: { stripeSubscriptionId: true },
  });
  if (activeSubs.length > 0) {
    const stripe = getStripe();
    for (const s of activeSubs) {
      try {
        await stripe.subscriptions.cancel(s.stripeSubscriptionId);
      } catch (e) {
        throw new Error(
          `Couldn't cancel this learner's Stripe subscription (${s.stripeSubscriptionId}). Resolve it in Stripe, then retry the delete. (${
            e instanceof Error ? e.message : String(e)
          })`,
        );
      }
    }
  }

  try {
    await db.user.delete({ where: { id: userId } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2003" || e.code === "P2014")
    ) {
      throw new Error(
        "This account authored curriculum content, so it can't be deleted directly. Reassign or remove that content first.",
      );
    }
    throw e;
  }

  revalidatePath("/admin/students");
  return { ok: true };
}
