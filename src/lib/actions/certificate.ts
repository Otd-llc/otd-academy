"use server";

// Mints a signed share token for the completion / certificate card. The client
// CertificateReveal can't sign (no AUTH_SECRET), so it calls this after a pass.
// Eligibility is enforced server-side: a "cert" token needs MASTERED (you passed
// the exam), a "done" token needs the board finished — so nobody can mint a
// certificate they didn't earn. The name on the card is the real signed-in user's.
//
// "use server" rule: this file exports ONLY async functions.
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { signCardToken } from "@/lib/certificate-token";
import { recordCertificate } from "@/lib/certificate-record";
import { recordCourseComplete } from "@/lib/logbook/guide-awards";
import { afterAward } from "@/lib/logbook/after-award";
import { capture } from "@/lib/analytics";

const schema = z.object({
  slug: z.string().trim().min(1).max(200),
  variant: z.enum(["cert", "done"]),
  score: z.number().int().nonnegative().optional(),
  total: z.number().int().positive().optional(),
});

export async function createCertificateShareToken(input: {
  slug: string;
  variant: "cert" | "done";
  score?: number;
  total?: number;
}): Promise<{ token: string }> {
  const { slug, variant, score, total } = schema.parse(input);
  const user = await requireUser();

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) throw new Error("Lesson not found.");

  const enrollment = await db.enrollment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: project.id } },
    select: { status: true, masteredAt: true },
  });
  if (!enrollment) throw new Error("You're not enrolled in this lesson.");
  if (variant === "cert" && enrollment.status !== "MASTERED") {
    throw new Error("Pass the final exam to earn the certificate first.");
  }
  if (variant === "done" && enrollment.status === "IN_PROGRESS") {
    throw new Error("Finish the board first.");
  }

  const name = user.name?.trim() || user.email?.split("@")[0] || "Builder";
  // Stable issue date so the token (and its share URL / cert ID) doesn't drift:
  // the pass date for a cert, else today.
  const date = (enrollment.masteredAt ?? new Date()).toISOString().slice(0, 10);
  const claims = { slug, name, variant, score, total, date } as const;
  const token = signCardToken(claims);
  await recordCertificate(token, claims, user.id); // make the printed code checkable

  // Funnel: the learner minted a shareable certificate/completion card — the
  // viral/advocacy signal. Best-effort (try/catch); no-op when unconfigured.
  try {
    capture("certificate_shared", { slug, variant }, user.id);
  } catch {
    // best-effort
  }

  // Course XP: COURSE_COMPLETE + the exam-backed course:<slug> RATING on the
  // achievement cert (variant "cert" ⇒ MASTERED, checked above). Best-effort;
  // idempotent on the dedupeKey + badge PK, so re-minting never double-pays.
  if (variant === "cert") {
    try {
      const c = await recordCourseComplete(user.id, slug, new Date());
      if (c.awarded || c.newBadges.length > 0) {
        await afterAward(user.id, {
          source: "COURSE_COMPLETE",
          xp: c.xp,
          levelUp: c.levelUp,
          newBadges: c.newBadges,
        });
      }
    } catch {
      // never block the certificate on XP
    }
  }

  return { token };
}
