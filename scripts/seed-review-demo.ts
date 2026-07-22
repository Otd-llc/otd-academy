// Seed a DUE review item for a user so /review shows something immediately, for
// local testing of the spaced-review deck (step 4). Idempotent: re-running just
// re-makes the demo item due again. LOCAL by default (.env.local DATABASE_URL is
// local `foundry_dev`). Does NOT touch real lesson content.
//
// Run: pnpm exec tsx scripts/seed-review-demo.ts <your-account-email>
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: pnpm exec tsx scripts/seed-review-demo.ts <email>");
    process.exit(1);
  }

  const { db } = await import("@/lib/db");

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.error(`No user with email ${email}. Sign in once first.`);
    process.exit(1);
  }

  const reviewItemId = "demo:SCHEMATIC:ohms-law";
  await db.quizItem.upsert({
    where: { reviewItemId },
    create: {
      reviewItemId,
      projectSlug: "demo",
      stage: "SCHEMATIC",
      q: "In Ohm's law V = I x R, if V doubles and R stays the same, what happens to the current I?",
      options: ["It doubles", "It halves", "It stays the same", "It quadruples"],
      answer: 0,
    },
    update: {},
  });

  // Due yesterday (academy date) so it shows up now.
  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  const dueOn = new Date(`${y.toISOString().slice(0, 10)}T00:00:00Z`);
  await db.reviewSchedule.upsert({
    where: { userId_reviewItemId: { userId: user.id, reviewItemId } },
    create: {
      userId: user.id,
      reviewItemId,
      dueOn,
      intervalDays: 3,
      lastSeenOn: dueOn,
    },
    // Re-due it (and un-suspend) so the demo is repeatable.
    update: { dueOn, suspended: false },
  });

  console.log(`Seeded a due review item for ${email}. Visit /review (and see the "N due" nudge on /logbook).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
