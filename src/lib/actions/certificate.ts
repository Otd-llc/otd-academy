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
  const token = signCardToken({ slug, name, variant, score, total, date });
  return { token };
}
