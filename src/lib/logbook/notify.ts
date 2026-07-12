// Milestone re-engagement email (design §11). One combined, warm touch when a
// reader crosses a rating or earns a patch, gated on emailConsent (motivational,
// not transactional). Fire-and-forget from the award actions; it must never throw
// into the caller. Each distinct milestone sends once via its sequence id, guarded
// by sendLifecycleEmail's (userId, sequence) unique index.
import { db } from "@/lib/db";
import { env } from "@/env";
import { siteUrl } from "@/lib/seo/jsonld";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { sendLifecycleEmail } from "@/lib/lifecycle-send";
import { logbookMilestoneEmail, type LifecycleContext } from "@/lib/lifecycle-emails";
import { patchLabel } from "@/lib/logbook/patches";

const FOUNDER_FIRST_NAME = "Josh";

export async function notifyLogbookMilestone(
  userId: string,
  m: { levelUp: { level: number; title: string } | null; newBadges: string[] },
): Promise<void> {
  try {
    if (!m.levelUp && m.newBadges.length === 0) return;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailConsent: true },
    });
    if (!user || user.emailConsent !== true) return;

    const baseUrl = siteUrl();
    const ctx: LifecycleContext = {
      firstName: (user.name ?? "").trim().split(/\s+/)[0] || "there",
      founderFirstName: FOUNDER_FIRST_NAME,
      unsubscribeUrl: `${baseUrl}/email/unsubscribe/${signUnsubscribeToken(userId)}`,
      host: baseUrl.replace(/^https?:\/\//, ""),
      postalAddress: env.LIFECYCLE_POSTAL_ADDRESS,
      l101Url: `${baseUrl}/projects/l1-01-wroom-breakout/v1/guide`,
    };
    // Level takes the sequence key when present (one email per level ever);
    // otherwise a patch-batch keys the send. The body names both.
    const sequence = m.levelUp
      ? `logbook:level:${m.levelUp.level}`
      : `logbook:patch:${m.newBadges[0]}`;
    const email = logbookMilestoneEmail(ctx, {
      title: m.levelUp?.title,
      patches: m.newBadges.map(patchLabel),
      logbookUrl: `${baseUrl}/logbook`,
    });
    await sendLifecycleEmail(db, {
      userId,
      to: user.email,
      sequence,
      email,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
  } catch {
    // A milestone email must never break the award that triggered it.
  }
}
