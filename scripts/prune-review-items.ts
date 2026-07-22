// Prune orphaned review items (step 4 housekeeping). A QuizItem is orphaned when its
// reviewItemId no longer matches any LIVE question key — which happens when a
// question's text was edited (its hash-based questionKey changed) or a question was
// removed. The deck still RENDERS orphans from their snapshot, so this is cleanup,
// not correctness; run it periodically (cron) to stop stale/duplicate items
// accumulating. Deleting a QuizItem cascades its ReviewSchedule rows.
//
// LOCAL by default. Prod: `pnpm db:prod scripts/prune-review-items.ts`.
// Usage: pnpm exec tsx scripts/prune-review-items.ts [--dry-run]
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { db } = await import("@/lib/db");
  const { quizQuestions } = await import("@/lib/logbook/lesson-content");
  const { questionKey, guideKey } = await import("@/lib/logbook/question-key");
  const { reviewItemId, libraryReviewItemId } = await import(
    "@/lib/logbook/review-schedule"
  );

  // Every review key a live question could legitimately produce: its questionKey
  // (the untagged wrong-answer path) AND its reviewId key (the tagged path). All
  // cards/lessons, published or not, so a temporary unpublish never prunes real data.
  const live = new Set<string>();

  const cards = await db.guideCard.findMany({
    select: {
      stage: true,
      contentBlocks: true,
      guide: {
        select: {
          revision: {
            select: { label: true, project: { select: { slug: true } } },
          },
        },
      },
    },
  });
  for (const c of cards) {
    const slug = c.guide.revision.project.slug;
    const gk = guideKey(slug, c.guide.revision.label, c.stage);
    for (const q of quizQuestions(c.contentBlocks)) {
      live.add(questionKey(gk, q));
      if (q.reviewId) live.add(reviewItemId(slug, c.stage, q.reviewId));
    }
  }

  const lessons = await db.miniLesson.findMany({
    select: { slug: true, contentBlocks: true },
  });
  for (const l of lessons) {
    for (const q of quizQuestions(l.contentBlocks)) {
      live.add(questionKey(l.slug, q));
      if (q.reviewId) live.add(libraryReviewItemId(l.slug, q.reviewId));
    }
  }

  const items = await db.quizItem.findMany({ select: { reviewItemId: true } });
  const orphans = items
    .map((i) => i.reviewItemId)
    .filter((id) => !live.has(id));

  console.log(
    `live keys: ${live.size} · quiz items: ${items.length} · orphans: ${orphans.length}`,
  );
  if (orphans.length === 0) {
    console.log("nothing to prune.");
    return;
  }
  if (dryRun) {
    console.log(
      `[dry-run] would prune ${orphans.length}: ${orphans.slice(0, 10).join(", ")}${orphans.length > 10 ? " ..." : ""}`,
    );
    return;
  }
  const { count } = await db.quizItem.deleteMany({
    where: { reviewItemId: { in: orphans } },
  });
  console.log(`pruned ${count} orphaned review items (schedules cascaded).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
