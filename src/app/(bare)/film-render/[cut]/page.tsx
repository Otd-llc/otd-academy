// The capture surface a render pipeline drives. NOT a sandbox round.
//
//   /film-render/logbook?fmt=9x16
//
// WHY IT LIVES HERE AND NOT IN /sandbox. Sandbox routes are audition surfaces:
// the owner looks, picks, and the route is DELETED before its PR. This one is
// not for looking at - it is the surface `Otd-llc/otd-promo` points a browser
// at to capture frames, and deleting it would delete the film's ability to be
// re-rendered at all. Same reason `(internal)/diagram-render/[key]` exists for
// the diagram exporter, and the same guard: 404 in production unless the
// exporter explicitly asks for it.
//
// WHY IT STAYS IN THE ACADEMY, when the motion engine did move out. The four
// scenes render the REAL product components - QuizBlock, StandingRail,
// RankWing, PatchBadge - and that is the whole argument of the film: it shows
// what a learner actually sees rather than a redrawing of it. Copying those
// into the promo repo would create forks, and the first time one drifted the
// promo would be advertising something that no longer exists. So the ENGINE is
// shared and the SCENES are not; otd-promo drives this page over HTTP, which is
// exactly what its own README means by "drives real browsers at real apps".
//
// `(bare)` because the film is the whole viewport: no header, no footer.
//
// ASCII only.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { FilmLesson, FilmQuestion } from "./LogbookLive";
import { FORMATS, type FormatId } from "./formats/formats";
import { FrameStage } from "./FrameStage";

/** The cuts this surface can render. One today; the list is the point. */
const CUTS = ["logbook"] as const;

export default function FilmRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ cut: string }>;
  searchParams: Promise<{ fmt?: string }>;
}) {
  // FILM_EXPORT rather than a bare dev check, so a production build can be
  // captured deliberately without the route being reachable by accident.
  if (process.env.NODE_ENV === "production" && !process.env.FILM_EXPORT) {
    notFound();
  }
  return (
    <Suspense fallback={null}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({
  params,
  searchParams,
}: {
  params: Promise<{ cut: string }>;
  searchParams: Promise<{ fmt?: string }>;
}) {
  // Nothing else here establishes request time, so the Prisma client's internal
  // clock read would trip the current-time prerender error without this.
  await connection();
  const { cut } = await params;
  if (!CUTS.includes(cut as (typeof CUTS)[number])) notFound();
  const sp = await searchParams;
  const fmt = (FORMATS.find((f) => f.id === sp.fmt)?.id ?? "16x9") as FormatId;

  const found = await findQuestion();
  if (!found) {
    return (
      <p className="p-4 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson with a parseable quiz block. Hydrate with
        pnpm db:pull-prod.
      </p>
    );
  }
  return <FrameStage fmt={fmt} lesson={found.lesson} question={found.question} />;
}

/** The shortest real quiz question in a published Fundamentals mini-lesson.
 *
 *  DELIBERATELY CONTENT, NEVER A LEARNER. This reads lesson prose and a quiz -
 *  things already public on the lesson page itself. The local database is a
 *  restore of production and carries real accounts, so nothing here touches a
 *  user table; and the promo repo's disclosure gate scans every captured frame
 *  regardless of what this comment promises, because a promise is not a gate. */
async function findQuestion() {
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC", cluster: "fundamentals" },
    orderBy: { clusterOrdinal: "asc" },
    select: { slug: true, title: true, contentBlocks: true },
    take: 12,
  });
  let lesson: FilmLesson | null = null;
  let question: FilmQuestion | null = null;
  for (const r of rows) {
    const qs = parseGuideBlocks(r.contentBlocks)
      .blocks.filter((b) => b.type === "quiz")
      .flatMap((b) => (b.type === "quiz" ? b.questions : []))
      .filter(
        (q): q is FilmQuestion =>
          Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number",
      );
    for (const q of qs) {
      const worse =
        question &&
        q.options.length * 100 + q.q.length >=
          question.options.length * 100 + question.q.length;
      if (worse) continue;
      question = q;
      lesson = { slug: r.slug, title: r.title, clusterLabel: "Fundamentals" };
    }
  }
  return lesson && question ? { lesson, question } : null;
}
