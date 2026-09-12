// Guards that hold the AUTHORED lesson content to rules code can check.
//
// Lesson prose lives in the production database, not git, so these scan the
// deterministic export in the sibling content archive (see scripts/export-content.ts)
// rather than any file in this repo.
//
// The archive is a separate PRIVATE repo and is absent in THIS repo's CI, which
// leaves this suite unable to run here. `test.runIf` skips rather than fails: a
// missing archive is not a content defect, and reddening CI over it would train
// everyone to ignore the check. Set CONTENT_ARCHIVE_DIR to point it elsewhere.
//
// WHERE THESE ACTUALLY GATE SOMETHING. Skipping is green, and green here means
// nothing was checked -- measured with CONTENT_ARCHIVE_DIR pointed at a path that
// does not exist: `success: true, numPassedTests: 0, numPendingTests: 3`. Three
// L1.01 gate quizzes were passable with one letter until 2026-08-20 while this
// file sat green, so treat a green run in THIS repo as no evidence at all.
//
// The run that counts is the daily `export` workflow in the PRIVATE
// Otd-llc/otd-content-archive. It exports production, commits the mirror, then
// runs this exact file against it with CONTENT_ARCHIVE_DIR set, and a following
// step fails the job if any test SKIPPED. That workflow checks this repo out at
// the `content-export-v1` tag, so **editing this file changes nothing until that
// tag moves** -- and nothing warns you. Same for @/lib/gate-quiz and
// @/lib/quiz-spread below, whose behaviour these assertions are made of.
//
// Not moved into this repo's CI on purpose: this repo is PUBLIC, and pointing it
// at the archive would put every exam answer key one workflow edit from
// exfiltration while still skipping on fork PRs, which get no secrets.
//
// Two rules, both scanning the same tree in one walk:
//   1. A card with more than one quiz block MUST pin which one is the stage gate,
//      or the gate silently follows block order (gate-quiz.ts falls back to the
//      first quiz block).
//   2. No answer position may hold more than MAX_POSITION_SHARE of a lesson's
//      correct answers (quiz-spread.ts).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { allQuizQuestions, gateQuizQuestions } from "@/lib/gate-quiz";
import { constantGuessYield, keySpread, spreadIsBalanced } from "@/lib/quiz-spread";

const ROOT = resolve(
  process.env.CONTENT_ARCHIVE_DIR ?? resolve("..", "otd-content-archive", "content"),
  "guides",
);

const HAVE_ARCHIVE = existsSync(ROOT);

type Card = { lesson: string; file: string; contentBlocks: unknown };

/** Every guide card in the archive. `_guide.json` is metadata, not a card. */
function archiveCards(): Card[] {
  const out: Card[] = [];
  for (const slug of readdirSync(ROOT)) {
    for (const rev of readdirSync(join(ROOT, slug))) {
      const dir = join(ROOT, slug, rev);
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".json") || file.startsWith("_")) continue;
        const card = JSON.parse(readFileSync(join(dir, file), "utf8"));
        out.push({ lesson: `${slug}/${rev}`, file, contentBlocks: card.contentBlocks });
      }
    }
  }
  return out;
}

describe("authored content: the stage-gate quiz is pinned", () => {
  test.runIf(HAVE_ARCHIVE)(
    "every card with 2+ quiz blocks marks exactly one gate: true",
    () => {
      const offenders: string[] = [];
      for (const c of archiveCards()) {
        const raw = Array.isArray(c.contentBlocks) ? c.contentBlocks : [];
        const quizzes = raw.filter(
          (b): b is { gate?: boolean } =>
            typeof b === "object" && b !== null && (b as { type?: string }).type === "quiz",
        );
        // A single-quiz card is unambiguous — the fallback is correct there, and
        // demanding a flag on all ~180 cards would be noise, not safety.
        if (quizzes.length < 2) continue;
        const gates = quizzes.filter((q) => q.gate === true).length;
        if (gates !== 1) {
          offenders.push(`${c.lesson}/${c.file}: ${quizzes.length} quizzes, ${gates} pinned`);
        }
      }
      expect(offenders).toEqual([]);
    },
  );
});

describe("authored content: answer keys are not parked in one position", () => {
  test.runIf(HAVE_ARCHIVE)(
    "no lesson keys more than 45% of its answers to a single option slot",
    () => {
      // Aggregated PER LESSON, not per card: a card's bank is 5-9 questions, below
      // MIN_GUARDED_QUESTIONS, so a per-card check could never fire. The lesson is
      // also the unit a learner actually experiences.
      const byLesson = new Map<string, { answer: number; options: string[] }[]>();
      for (const c of archiveCards()) {
        const qs = allQuizQuestions(c.contentBlocks);
        if (qs.length === 0) continue;
        const acc = byLesson.get(c.lesson) ?? [];
        acc.push(...qs.map((q) => ({ answer: q.answer, options: q.options })));
        byLesson.set(c.lesson, acc);
      }

      const offenders: string[] = [];
      for (const [lesson, qs] of byLesson) {
        const spread = keySpread(qs);
        if (!spreadIsBalanced(spread, qs.length)) {
          const pct = spread.map((n) => `${Math.round((n / qs.length) * 100)}%`);
          offenders.push(`${lesson}: ${qs.length} questions, ${spread.join("/")} (${pct.join(" ")})`);
        }
      }
      expect(offenders).toEqual([]);
    },
  );
});

describe("authored content: no stage is passable by guessing one letter", () => {
  // The check that actually maps to the gate. A stage's quiz is what opens the
  // stage, and its bank is 4-9 questions — too small for the per-lesson share cap
  // (see MIN_GUARDED_QUESTIONS). What holds at any size is: the best constant guess
  // must fall short of the pass mark.
  //
  // Pinned at 0.8 to match the intended first-pick threshold. Today's gate needs
  // every answer correct, so this is stricter than shipped behaviour on purpose —
  // it stops content drifting into a state that would defeat the gate the moment
  // threshold scoring lands.
  const PASS_MARK = 0.8;

  test.runIf(HAVE_ARCHIVE)("every stage's own quiz bank resists a constant guess", () => {
    const offenders: string[] = [];
    for (const c of archiveCards()) {
      // The GATE block only: practice mini-quizzes don't open the stage.
      const qs = gateQuizQuestions(c.contentBlocks);
      if (qs.length === 0) continue;
      const spread = keySpread(qs.map((q) => ({ answer: q.answer, options: q.options })));
      const yield_ = constantGuessYield(spread, qs.length);
      if (yield_ >= PASS_MARK) {
        offenders.push(
          `${c.lesson}/${c.file}: ${qs.length} questions, keys ${qs
            .map((q) => q.answer)
            .join(",")} — one letter scores ${Math.round(yield_ * 100)}%`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });
});
