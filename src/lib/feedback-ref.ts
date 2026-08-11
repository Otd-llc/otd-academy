// What a feedback `pageRef` is allowed to be, and how to read one.
//
// The XP award for feedback dedupes per (userId, pageRef), so an unvalidated ref
// turns "once per page" into "once per arbitrary string" — a script could farm
// the daily cap with fabricated refs and fill the table with junk rows. Every
// ref therefore has to parse to a REAL surface, and the parse is here, pure, so
// it can be tested without a database.
//
// Two surfaces carry a feedback box:
//   library/<slug>           a Library mini-lesson
//   course/<slug>/<STAGE>    one stage card of a course guide
//
// Existence is checked by the caller (it needs the DB); this module only decides
// whether the shape is one we accept at all.

import { GUIDE_STAGES, type GuideStage } from "@/lib/guide-templates/stage-skeletons";

export type FeedbackRef =
  | { kind: "library"; slug: string }
  | { kind: "course"; slug: string; stage: GuideStage };

const SLUG = /^[a-z0-9-]{1,120}$/;

/**
 * Parse a `pageRef`, or null if it is not a shape we accept.
 *
 * Deliberately strict: an exact match on the whole string, a bounded slug
 * charset, and a stage that must be one of the eight guide stages. `REVISION`
 * is a real Stage but has no guide card, so it is not a valid feedback target —
 * validating against `GUIDE_STAGES` rather than the Prisma enum is what keeps
 * those two facts from drifting apart.
 */
export function parseFeedbackRef(pageRef: string): FeedbackRef | null {
  const parts = pageRef.split("/");

  if (parts.length === 2 && parts[0] === "library") {
    const slug = parts[1]!;
    return SLUG.test(slug) ? { kind: "library", slug } : null;
  }

  if (parts.length === 3 && parts[0] === "course") {
    const slug = parts[1]!;
    const stage = parts[2]!;
    if (!SLUG.test(slug)) return null;
    if (!(GUIDE_STAGES as readonly string[]).includes(stage)) return null;
    return { kind: "course", slug, stage: stage as GuideStage };
  }

  return null;
}

/** The `pageRef` for one stage card of a course guide. */
export function courseFeedbackRef(projectSlug: string, stage: GuideStage): string {
  return `course/${projectSlug}/${stage}`;
}
