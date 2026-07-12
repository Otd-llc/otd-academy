// The funnel + milestone side effects of an XP award (design §10b/§11), shared by
// every award path (library actions, course actions, and the stage/exam/cert hooks
// in enrollment/exam/certificate). Server PostHog events, then the once-only,
// consent-gated milestone email. Both are defensive no-ops when unconfigured / no
// consent; neither throws into the award path. Plain module (not "use server") so
// it can be imported anywhere server-side.
import { capture } from "@/lib/analytics";
import { notifyLogbookMilestone } from "@/lib/logbook/notify";

export async function afterAward(
  userId: string,
  o: {
    source: string;
    xp: number;
    levelUp: { level: number; title: string } | null;
    newBadges?: string[];
  },
): Promise<void> {
  if (o.xp > 0) capture("xp_earned", { source: o.source, amount: o.xp }, userId);
  if (o.levelUp) {
    capture("level_up", { level: o.levelUp.level, title: o.levelUp.title }, userId);
  }
  for (const badgeKey of o.newBadges ?? []) {
    capture("patch_earned", { badgeKey }, userId);
  }
  await notifyLogbookMilestone(userId, {
    levelUp: o.levelUp,
    newBadges: o.newBadges ?? [],
  });
}
