// Learner-guide backfill → materialize a Guide + GuideCard[] for each of the
// 22 `foundry-*` curriculum projects' v1 revision.
//
// One-off, idempotent backfill script. Writes via Prisma directly: the
// `materializeGuide` server action can't be scripted headlessly because
// `requireUser()` reads an Auth.js request-context session and the action calls
// `revalidatePath`, which throws outside a Next request (the documented
// `[[foundry-headless-scripting]]` constraint). This script replicates the
// action's WRITE shape exactly — `composeGuide(...)` → nested `Guide` +
// `GuideCard[]` create, same field mapping incl. `Prisma.JsonNull` for a null
// `completionRef`/`trackSnapshot`, and the audited `createdById`.
//
// Idempotent: a revision that already has a Guide is skipped (the
// `Guide.revisionId @unique` constraint makes the guide one-per-revision).
// Re-running is a no-op. Leaves every non-curriculum project untouched.
//
// Run: tsx scripts/materialize-curriculum-guides.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { Prisma } = await import("@prisma/client");
  const { db } = await import("@/lib/db");
  const { composeGuide } = await import("@/lib/guide-templates/compose");

  // ─── Resolve attributing User ───────────────────────────
  // Prefer the real app owner, then any non-seed user, then the seed user.
  // (Identical resolution to populate-curriculum-dag.ts.)
  const author =
    (await db.user.findUnique({ where: { email: "ravenduanesavage@gmail.com" } })) ??
    (await db.user.findFirst({
      where: { email: { not: "seed@example.com" } },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.user.findUniqueOrThrow({ where: { email: "seed@example.com" } }));
  console.log(`author: ${author.email} (${author.id})`);

  // ─── Load the 22 foundry-* v1 revisions ─────────────────
  const revisions = await db.revision.findMany({
    where: {
      project: { slug: { startsWith: "foundry-" } },
      label: { equals: "v1", mode: "insensitive" },
    },
    select: {
      id: true,
      project: {
        select: {
          slug: true,
          name: true,
          track: true,
          requiresStripboard: true,
          disciplineTaught: true,
        },
      },
    },
    orderBy: { project: { slug: "asc" } },
  });
  console.log(`foundry-* v1 revisions found: ${revisions.length}`);

  let created = 0;
  let skipped = 0;

  for (const rev of revisions) {
    const existing = await db.guide.findUnique({
      where: { revisionId: rev.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const composed = composeGuide({
      slug: rev.project.slug,
      name: rev.project.name,
      track: rev.project.track,
      requiresStripboard: rev.project.requiresStripboard,
      disciplineTaught: rev.project.disciplineTaught,
    });

    // Replicate the materializeGuide WRITE shape exactly (src/lib/actions/guides.ts).
    await db.guide.create({
      data: {
        revisionId: rev.id,
        title: composed.title,
        // trackSnapshot is a nullable CurriculumTrack enum column (not Json) —
        // a null track passes through as SQL NULL, mirroring the action.
        trackSnapshot: composed.trackSnapshot,
        createdById: author.id,
        cards: {
          create: composed.cards.map((c) => ({
            stage: c.stage as Prisma.GuideCardCreateManyGuideInput["stage"],
            ordinal: c.ordinal,
            eyebrow: c.eyebrow,
            title: c.title,
            lead: c.lead ?? null,
            contentBlocks: c.contentBlocks as Prisma.InputJsonValue,
            isGate: c.isGate,
            completionRef: (c.completionRef ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          })),
        },
      },
    });
    created++;
  }

  const total = await db.guide.count({
    where: { revision: { project: { slug: { startsWith: "foundry-" } } } },
  });
  console.log(
    `guides: ${total} present (${created} created, ${skipped} already existed)`,
  );

  await db.$disconnect();
  console.log("materialize-curriculum-guides: complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
