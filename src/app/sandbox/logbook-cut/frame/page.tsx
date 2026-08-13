// SANDBOX - the capture surface. One stage, full viewport, no chrome. DEV ONLY.
//
//   /sandbox/logbook-cut/frame?fmt=9x16
//
// Driven by tools/logbook-render.mjs through `window.__seek`. See FrameStage.
// ASCII only.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { FilmLesson, FilmQuestion } from "../LogbookLive";
import { FORMATS, type FormatId } from "../formats/formats";
import { FrameStage } from "./FrameStage";

export default function FramePage({
  searchParams,
}: {
  searchParams: Promise<{ fmt?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  // SUSPENSE, or Next warns that the whole route is blocked on uncached data -
  // and a renderer that logs console errors on every run is a renderer whose
  // log nobody reads when a real one shows up.
  return (
    <Suspense fallback={null}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({
  searchParams,
}: {
  searchParams: Promise<{ fmt?: string }>;
}) {
  await connection();
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

/** The same question every other route in this sandbox films, found the same way. */
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
