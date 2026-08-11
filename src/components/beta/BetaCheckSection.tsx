// One real check from the L1.01 guide, rendered with the REAL quiz component.
//
// Two decisions worth stating, because both were available to get wrong:
//
// 1. THE QUESTION IS READ FROM THE DATABASE, not copied into this file. The
//    section's whole claim is "this is a real question from the course, not a
//    sample written for the landing page". A hardcoded copy makes that claim
//    true on the day it ships and false the first time someone edits the card.
//    Reading the published card makes it structurally true. If the block ever
//    goes missing the section renders nothing rather than a stale copy.
//
// 2. IT USES QuizBlock, not a lookalike. The same claim applies to the
//    presentation: a hand-rolled approximation would drift from the real
//    console UI and quietly become a lie about what the course feels like.
//    QuizBlock with NO `context` and NO `logbook` is its documented pure
//    self-check mode: no XP, no attempt record, no gate write, no auth. That is
//    exactly right for a visitor who has not earned anything.
//
// The one thing that DOES fire is `formative_check_engaged` from inside
// QuizBlock. That is wanted: how many landing-page visitors actually try the
// check is a real signal, and posthog-js attaches $current_url, so it is
// distinguishable from the same event fired inside a guide card.

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { ONE_HOUR, TAG_PROJECTS, guideContentTag } from "@/lib/cache-profile";
import { QuizBlock, type QuizQuestion } from "@/components/guide/QuizBlock";

const PROJECT_SLUG = "l1-01-wroom-breakout";
/** The sourcing card's MPN question: a genuine beginner aha that needs no prior
 *  context, which is rare among the eight and is why it is named here. */
const STAGE = "BOM_SOURCING";
const QUESTION_ID = "mpn-not-value";

type RawQuestion = {
  id?: string;
  q?: string;
  options?: unknown;
  answer?: unknown;
  explain?: string;
};

/**
 * The published card's quiz question, or null if anything about it moved.
 *
 * CACHED, and that is not an optimisation. `/beta` prerenders as a static shell
 * under Cache Components, and an uncached read here fails the BUILD: Prisma
 * reaches for `randomBytes`, and a Server Component may not touch a random
 * value during prerender before reading uncached or Request data. The choice is
 * cache it or make the whole landing page dynamic, and a campaign's front door
 * should be a static shell.
 *
 * No arguments, so the repo's cache-key bounding law has nothing to bound: the
 * slug and stage are constants, and one route cannot mint one entry per garbage
 * URL. Tagged so an edit to the sourcing card busts it through the same
 * `invalidateGuideContent` path the guide pages already use, which is what
 * keeps "this is a real question from the course" true rather than stale.
 */
async function loadCheck(): Promise<{ prompt: string; question: QuizQuestion } | null> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS, guideContentTag(PROJECT_SLUG));

  const project = await db.project.findFirst({
    where: { slug: PROJECT_SLUG },
    select: { publishedRevisionId: true },
  });
  if (!project?.publishedRevisionId) return null;

  const card = await db.guideCard.findFirst({
    where: { stage: STAGE, guide: { revisionId: project.publishedRevisionId } },
    select: { contentBlocks: true },
  });
  const blocks = Array.isArray(card?.contentBlocks) ? card.contentBlocks : [];

  for (const raw of blocks as Record<string, unknown>[]) {
    if (String(raw.type ?? raw.kind) !== "quiz") continue;
    const questions = Array.isArray(raw.questions) ? (raw.questions as RawQuestion[]) : [];
    const hit = questions.find((q) => q.id === QUESTION_ID) ?? questions[0];
    if (!hit?.q || !Array.isArray(hit.options) || typeof hit.answer !== "number") continue;
    return {
      prompt: typeof raw.prompt === "string" ? raw.prompt : "Quick check",
      question: {
        q: hit.q,
        options: hit.options.map(String),
        answer: hit.answer,
        explain: hit.explain,
      },
    };
  }
  return null;
}

export async function BetaCheckSection({ guideHref }: { guideHref: string }) {
  const check = await loadCheck();
  if (!check) return null;

  return (
    <section className="mt-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Try one of the checks
      </p>
      <p className="mt-3 max-w-2xl font-serif text-base text-text">
        This is a real question from the sourcing card, pulled from the course
        itself rather than written for this page. Eight of these gate your way
        through, and a wrong pick rules that option out so you try again.
      </p>

      <div className="mt-8 max-w-2xl">
        {/* No context, no logbook: pure self-check. Nothing is recorded. */}
        <QuizBlock prompt={check.prompt} questions={[check.question]} />
      </div>

      <p className="mt-8 max-w-2xl text-sm text-muted">
        Nothing there was recorded, and no account was involved. Every card is
        public too:{" "}
        <a href={guideHref} className="text-command-gold hover:text-gold-light">
          open the schematic card
        </a>{" "}
        and read it before you sign up for anything.
      </p>
    </section>
  );
}
