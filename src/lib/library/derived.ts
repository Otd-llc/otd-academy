// The single source of truth for MiniLesson's DERIVED columns: three pure
// functions of contentBlocks, computed in one place so the write-path extension
// (src/lib/db.ts), the backfill (scripts/backfill-lesson-derived.ts), and the
// drift guardrail can never disagree.
//
// WHY these are stored columns and not derived at read time: /library renders
// every published lesson, so deriving them live meant SELECTing all 69 rows'
// contentBlocks (~611 kB on the wire, twice per render) to keep ~18 kB of
// scalars. See docs/plans/2026-07-15-library-derived-columns.md.
//
// All three underlying helpers are defensive over Prisma's `Json` (unknown at
// runtime) and degrade rather than throw, so this never breaks a write.
import { readingMinutes } from "@/lib/library/reading-time";
import { firstDiagramSrc } from "@/lib/library/hero-diagram";
import { quizQuestions } from "@/lib/logbook/lesson-content";

export type LessonDerived = {
  readingMinutes: number;
  questionCount: number;
  diagramSrc: string | null;
};

export function deriveLessonMeta(contentBlocks: unknown): LessonDerived {
  return {
    readingMinutes: readingMinutes(contentBlocks),
    questionCount: quizQuestions(contentBlocks).length,
    diagramSrc: firstDiagramSrc(contentBlocks),
  };
}
