// Lesson readiness report — scores a project's guide against the L1.01 bar.
//   Run: pnpm exec tsx scripts/lesson-readiness.ts <slug>
// Read-only. Uses the latest revision's guide (the published one if present).

import { config } from "dotenv";
config({ path: ".env.local" });

import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";
import {
  assessLessonReadiness,
  parsedReadinessCards,
} from "@/lib/lesson-readiness";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: pnpm exec tsx scripts/lesson-readiness.ts <slug>");
    process.exit(1);
  }
  const { db } = await import("@/lib/db");
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      name: true,
      publishedRevisionId: true,
      exam: { select: { questions: true } },
      revisions: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          guide: { select: { cards: { select: { stage: true, contentBlocks: true } } } },
          builds: {
            select: {
              boards: { where: { status: "BROUGHT_UP" }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!project) {
    console.error(`No project with slug "${slug}".`);
    process.exit(1);
  }

  const rev = project.revisions.find((r) => r.guide) ?? project.revisions[0];
  const cards = parsedReadinessCards(
    (rev?.guide?.cards ?? []).map((c) => ({
      stage: c.stage as string,
      contentBlocks: c.contentBlocks,
    })),
  );
  const examQuestions =
    project.exam && Array.isArray(project.exam.questions)
      ? (project.exam.questions as unknown[]).length
      : 0;
  // Brought-up boards across all revisions/builds — the vetted (team-built) signal.
  const broughtUpBoards = project.revisions.reduce(
    (n, r) => n + r.builds.reduce((m, b) => m + b.boards.length, 0),
    0,
  );

  const report = assessLessonReadiness({
    stages: GUIDE_STAGES,
    cards,
    exam: project.exam ? { questions: examQuestions } : null,
    broughtUpBoards,
    published: project.publishedRevisionId != null,
  });

  console.log(`\nLesson readiness — ${project.name} (${slug})\n`);
  for (const c of report.checks) {
    const mark = c.tier === "info" ? "·" : c.ok ? "✓" : "✗";
    const tag = c.tier === "vetted" ? " [vetted]" : "";
    console.log(
      `  ${mark} ${c.label}${tag}${c.detail ? `  — ${c.detail}` : ""}`,
    );
  }
  const bar = report.vetted
    ? "✅ VETTED (premium-ready)"
    : report.publishable
      ? "🟡 PUBLISHABLE (free/SEO) — not yet vetted"
      : "⛔ NOT ready";
  console.log(`\n  ${bar}\n`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
