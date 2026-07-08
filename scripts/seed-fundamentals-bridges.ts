// Seeds §7 cross-link bridges: ProjectMiniLesson SUPPORTING rows linking the
// Fundamentals lessons that back the L1.01 build to that course, so the guide
// page's "concepts behind this build" reading list renders them as crawlable
// /library links (L1.01 is PUBLIC + published → the list is indexed).
//
// Idempotent: upsert on the (projectId, miniLessonId, role) unique key.
//
// Run:
//   npx tsx scripts/seed-fundamentals-bridges.ts --dry   (look up + print, NO write)
//   npx tsx scripts/seed-fundamentals-bridges.ts         (write PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Fundamentals lessons that support the L1.01 build (content-phase plan §1a/§4).
const BRIDGE_SLUGS = [
  "capacitors",
  "diodes-and-leds",
  "grounds-and-power-rails",
  "reading-a-schematic",
  "reading-a-datasheet",
];

async function main() {
  const dry = process.argv.includes("--dry");
  const { db } = await import("@/lib/db");

  // L1.01 course: slug begins "l1-01" (curriculum dropped the foundry- prefix).
  const projects = await db.project.findMany({
    where: { slug: { startsWith: "l1-01" } },
    select: { id: true, slug: true },
  });
  if (projects.length !== 1) {
    console.error(`Expected exactly one l1-01 project, found ${projects.length}:`, projects);
    process.exit(1);
  }
  const project = projects[0];
  console.log(`L1.01 project: ${project.slug} id=${project.id}`);

  const lessons = await db.miniLesson.findMany({
    where: { slug: { in: BRIDGE_SLUGS } },
    select: { id: true, slug: true, published: true, accessTier: true },
  });
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));
  const missing = BRIDGE_SLUGS.filter((s) => !bySlug.has(s));
  if (missing.length) {
    console.error("Missing lessons:", missing);
    process.exit(1);
  }
  for (const l of lessons) {
    if (!l.published || l.accessTier !== "PUBLIC")
      console.warn(`  WARN ${l.slug}: published=${l.published} tier=${l.accessTier} (reading list only shows published PUBLIC)`);
  }

  for (let i = 0; i < BRIDGE_SLUGS.length; i++) {
    const slug = BRIDGE_SLUGS[i];
    const ml = bySlug.get(slug)!;
    if (dry) {
      console.log(`  would link  ${project.slug} -> ${slug}  (SUPPORTING, ordinal ${i})`);
      continue;
    }
    await db.projectMiniLesson.upsert({
      where: { projectId_miniLessonId_role: { projectId: project.id, miniLessonId: ml.id, role: "SUPPORTING" } },
      update: { ordinal: i },
      create: { projectId: project.id, miniLessonId: ml.id, role: "SUPPORTING", ordinal: i },
    });
    console.log(`  linked  ${project.slug} -> ${slug}  (SUPPORTING, ordinal ${i})`);
  }
  console.log(dry ? "dry run complete (no writes)" : `linked ${BRIDGE_SLUGS.length} bridges.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
