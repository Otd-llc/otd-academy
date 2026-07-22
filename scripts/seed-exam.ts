// Generic per-course FINAL EXAM seeder (audit Phase 2 / Task 2.6) — the
// publishable bar requires an exam with >= 10 questions, and until now the only
// way to seed one was hand-cloning seed-l101-exam.ts. This takes any course:
//
//   npx tsx scripts/seed-exam.ts <project-slug> <bank.json> [--threshold 75]
//
// The bank file is a JSON array of questions (template:
// docs/boards/_exam-bank-template.json). Hard-fails on validation: >= 10
// questions, unique ids, >= 2 options each, correctIndex in range, section
// present. Prints an answer-key position histogram — the content rule is an
// even spread, since options render in stored order (no client shuffle).
//
// Idempotent: upserts on the unique projectId, so re-running updates the bank
// in place. Targets whatever DATABASE_URL resolves (.env.local = LOCAL since
// 2026-07-15); prod goes through `pnpm db:prod scripts/seed-exam.ts ...`.
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
loadEnv({ path: ".env.local" });

const MIN_QUESTIONS = 10; // keep in lockstep with lesson-readiness MIN_EXAM_QUESTIONS

type Q = {
  id: string;
  section: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function validateBank(raw: unknown): Q[] {
  if (!Array.isArray(raw)) fail("Bank file must be a JSON array of questions.");
  if (raw.length < MIN_QUESTIONS)
    fail(`Bank has ${raw.length} questions; the publishable bar needs >= ${MIN_QUESTIONS}.`);
  const ids = new Set<string>();
  const out: Q[] = [];
  raw.forEach((q, i) => {
    if (typeof q !== "object" || q === null) fail(`Question ${i} is not an object.`);
    const { id, section, prompt, options, correctIndex } = q as Record<string, unknown>;
    if (typeof id !== "string" || !id.trim()) fail(`Question ${i}: missing id.`);
    if (ids.has(id)) fail(`Duplicate question id "${id}".`);
    ids.add(id);
    if (typeof section !== "string" || !section.trim())
      fail(`Question ${id}: missing section (build-stage grouping label).`);
    if (typeof prompt !== "string" || !prompt.trim()) fail(`Question ${id}: missing prompt.`);
    if (!Array.isArray(options) || options.length < 2 || !options.every((o) => typeof o === "string" && o.trim()))
      fail(`Question ${id}: options must be >= 2 non-empty strings.`);
    if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length)
      fail(`Question ${id}: correctIndex ${String(correctIndex)} out of range 0..${options.length - 1}.`);
    out.push({ id, section, prompt, options, correctIndex });
  });
  return out;
}

async function main() {
  const [slug, bankPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const thresholdFlag = process.argv.indexOf("--threshold");
  const passThreshold = thresholdFlag > -1 ? Number(process.argv[thresholdFlag + 1]) : 75;
  if (!slug || !bankPath) fail("Usage: npx tsx scripts/seed-exam.ts <project-slug> <bank.json> [--threshold 75]");
  if (!Number.isFinite(passThreshold) || passThreshold <= 0 || passThreshold > 100)
    fail(`--threshold must be a percentage in (0, 100]; got ${String(passThreshold)}.`);

  const questions = validateBank(JSON.parse(readFileSync(bankPath, "utf8")));

  const { db } = await import("@/lib/db");
  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!project) fail(`Project "${slug}" not found.`);

  const exam = await db.exam.upsert({
    where: { projectId: project.id },
    update: { title: `${project.name}: Final Exam`, passThreshold, questions },
    create: {
      projectId: project.id,
      title: `${project.name}: Final Exam`,
      passThreshold,
      questions,
    },
    select: { id: true, title: true, passThreshold: true },
  });

  // Answer-key spread (content rule: even across positions — no shuffle).
  const spread = new Map<number, number>();
  for (const q of questions) spread.set(q.correctIndex, (spread.get(q.correctIndex) ?? 0) + 1);
  const spreadLine = [...spread.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, n]) => `pos ${idx}: ${n}`)
    .join(" · ");
  const sections = [...new Set(questions.map((q) => q.section))];

  console.log(`Seeded exam: ${exam.title}`);
  console.log(`  questions: ${questions.length} across ${sections.length} sections (${sections.join(", ")})`);
  console.log(`  pass threshold: ${exam.passThreshold}%`);
  console.log(`  answer-key spread: ${spreadLine}`);
  const max = Math.max(...spread.values());
  const min = Math.min(...spread.values());
  if (max - min > 2) {
    console.warn(`  ⚠ answer-key spread is uneven (max-min = ${max - min}); rebalance before shipping.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
