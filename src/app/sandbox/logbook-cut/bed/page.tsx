// SANDBOX - the kit choice, made against the picture instead of in the dark.
// DEV ONLY.
//
// The five beds render to C:/zzz/_hex-promo/kits/logbook-bed-*.wav. To audition
// them here, copy them into the gitignored capture directory - they are 960 KB
// each and this repo is public:
//
//   New-Item -ItemType Directory -Force public\_capture\logbook-beds
//   foreach ($k in "relay","forge","machine","quiet","plate") {
//     Copy-Item "C:\zzz\_hex-promo\kits\logbook-bed-$k.wav" "public\_capture\logbook-beds\$k.wav"
//   }
//
// ASCII only.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { FilmLesson, FilmQuestion } from "../LogbookLive";
import { BedRig, type BedKit } from "./BedRig";

/** The five, with the claim each one makes. Copied from the KITS table in
 *  tools/logbook-bed.py, which is where they are defined. */
const KITS: BedKit[] = [
  {
    id: "relay",
    title: "Relay",
    note: "Electrical. Relays and clank, an arc into every landing - the kit that speaks the quiz's own language, where an answer is a circuit closing.",
  },
  {
    id: "forge",
    title: "Forge",
    note: "Struck and warm. Taiko and impact carry it, a rim for the answer, the wheel ticked out on a rim as well so bar four stays dry.",
  },
  {
    id: "machine",
    title: "Machine",
    note: "Servos and shakers. The wheel is the loudest idea in the kit, which suits a film whose third beat is a mechanism and risks making the dip the thing you remember.",
  },
  {
    id: "quiet",
    title: "Quiet",
    note: "Sparse. Nothing between the landings, so the four events and the two between them are the whole arrangement.",
  },
  {
    id: "plate",
    title: "Plate",
    note: "PICKED (owner, 2026-08-12), for its pacing. Built around the LAST event rather than the biggest one: the 8.0 drop is pulled back and the 8.5 plating gets a real swell, so the film resolves on the badge becoming yours instead of on it arriving.",
  },
  {
    id: "plate-master",
    title: "Plate / master",
    // THE POINT OF AUDITIONING THE MASTER HERE. The finishing chain is where an
    // arrangement gets quietly levelled - convolution, glue compression and a
    // limiter all trade dynamics for loudness, and loudnorm's `linear=true` is a
    // request rather than a guarantee. Measured, this one held: the six peaks
    // moved by at most 0.009 relative to PATCH and crest fell 0.56 dB. Left on
    // the page anyway, because the next kit or the next chain change is exactly
    // when that stops being true, and the A/B is one click.
    note: "The same kit through tools/hex-master.py: church-IR convolution, gentle glue, true-peak limit, -14.25 LUFS (linear, capped 0.25 dB short of -14 rather than falling back to dynamic). A/B it against the raw plate above.",
  },
  {
    id: "plate-soft",
    title: "Plate / soft",
    note: "Plate with the soft-clip drive at 0.6 instead of 1.1. Same arrangement, same samples - this is the curve the arrangement WROTE, rather than a compressed version of it: rms error against 0.55/0.78/0.70/1.00 falls 0.073 to 0.030, crest rises 13.7 to 15.8 dB.",
  },
  {
    id: "plate-soft-master",
    title: "Plate / soft, master",
    // THE DECISION THIS PAGE NOW EXISTS TO SETTLE. Two mastered candidates that
    // differ by one number in the generator, and the trade is not free: the
    // honest curve is 1.9 dB quieter in a feed, and platforms only ever turn
    // material DOWN, so nothing gives that back. Numbers cannot answer it -
    // 2 dB of level against 2 dB of crest is a listening call.
    note: "The honest curve, mastered: -16.16 LUFS (linear, 2.16 dB short of -14) against plate's -14.25. THE TRADE: the authored weight curve and 2 dB more crest, for 1.9 dB less loudness in the feed. Nothing turns that back up. A/B against plate / master.",
  },
];

export default function BedCutPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; bed against picture
      </p>
      <h1 className="title-section mt-3">Which kit, and does it hit</h1>

      <p className="mt-4 max-w-3xl font-serif text-base text-text">
        The cut is locked and the bed is not. Five kits, one picture, one clock:
        the film&rsquo;s scene time is read off the audio, so what you are
        watching is not a preview running alongside a track, it is the track
        driving the frame. Swap kits while it runs and the picture does not
        restart &mdash; the same moment, two beds, one after the other.
      </p>

      <section className="mt-5 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; how to judge a miss
        </p>
        <ul className="mt-2 max-w-3xl space-y-1 font-serif text-sm text-muted">
          <li>
            <b className="text-title">The word is meant to be early.</b> Three
            frames, 0.1s, whole-cut. A word landing exactly on the downbeat is
            measurably correct and reads late. The waveform marks both: gold
            where the bed hits, dashed blue where the word should settle.
          </li>
          <li>
            <b className="text-title">Null your own latency first.</b> What you
            hear left the audio graph tens of milliseconds ago; what you see is
            on screen now. The nudge starts at minus the measured output latency
            &mdash; if the grid clicks feel late against the bed, that is the
            control to move, not the cut.
          </li>
          <li>
            <b className="text-title">Grid clicks are the ear&rsquo;s marker
            lines.</b> A blip on each of the six events, sample-accurate. A bed
            that sounds early against them is early.
          </li>
          <li>
            <b className="text-title">The curve is checked, not eyeballed.</b>{" "}
            0.55 / 0.78 / <b>0.70</b> / 1.00 &mdash; the dip at the third is
            deliberate. Every kit&rsquo;s six peaks are re-measured in the
            browser from the decoded buffer, the same 0.25s window{" "}
            <code className="font-mono text-[13px] text-gold-light">
              landing_peaks()
            </code>{" "}
            uses, and stated as pass/fail.
          </li>
        </ul>
      </section>

      <Suspense
        fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}
      >
        <Body />
      </Suspense>
    </main>
  );
}

/** The same question the assembly page films, found the same way: the shortest
 *  real quiz question in a published Fundamentals mini-lesson. Kept local
 *  rather than shared, because this route is deleted with the rest of the
 *  sandbox and nothing outside it should grow a dependency on the query. */
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

async function Body() {
  // The sibling assembly page gets away without this because it awaits
  // `searchParams` first, which is Request data. This one reads no params and
  // no session, so nothing else establishes that it runs at request time - and
  // under cacheComponents the Prisma client's internal clock read then trips
  // the "current time before any Request data" prerender error. Same fix the
  // curriculum page carries, same reason.
  await connection();
  const found = await findQuestion();
  if (!found) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a parseable
        quiz block. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }
  return (
    <div className="mt-8">
      <BedRig kits={KITS} lesson={found.lesson} question={found.question} />
    </div>
  );
}
