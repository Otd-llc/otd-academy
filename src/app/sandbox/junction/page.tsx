// SANDBOX — the two remaining junctions. DEV ONLY.
import { notFound } from "next/navigation";
import { JunctionStage } from "./JunctionStage";
import { JUNCTIONS } from "./transitions";

const WHY: Record<string, string> = {
  "build-learn":
    "The hardest of the two. It jumps from a turning three-dimensional object to a flat interface, and nothing about the two shots rhymes, so the transition has to carry the change of subject on its own. The shaped ones (wipe, push, iris) declare it; the whip hides it; a plain dissolve tends to read as a mistake because the images have nothing in common to dissolve THROUGH.",
  "learn-earn":
    "Easier, because both shots are pale documents sitting in roughly the same part of frame. That is a match, and a match wants a soft transition: a dissolve here reads as one document becoming another rather than as two clips being joined. The loud options are worth hearing against the drop, but this junction does not need rescuing the way the other does.",
};

export default function JunctionSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ THE TWO REMAINING JOINS
      </p>
      <h1 className="title-section mt-3">Transitions</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        DESIGN into BUILD is a real handoff now, rendered as one continuous shot.
        These two were never touched: the cut flips opacity between segment
        videos on the beat, so both are bare hard cuts with nothing between them.
        Ten options each, on the real footage, scrubbable a frame at a time.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        One thing had to be re-rendered before this was even possible. The
        handoff clip ended exactly at 6.0 seconds, so the outgoing side of
        BUILD had no footage to dissolve or wipe against, only its own frozen
        last frame. It now runs to 7.0 and carries a second of board past the
        junction.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        You were right that LEARN fires early, and it was every transition, not
        just that one. They were all CENTRED on the downbeat, so a 360
        millisecond wipe began 180 milliseconds before it and the picture had
        started changing by the time the drum landed. The default is now{" "}
        <strong className="text-title">ends on beat</strong>: the new shot
        ARRIVES on the downbeat rather than straddling it. Centred is still
        there, because it is the right answer for a long dissolve where the
        fifty-fifty point is what the eye reads as the join, and there is a nudge
        for dialling the rest.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Each window is 1.4 seconds either side of the downbeat. Hard cut is the
        baseline: it is what ships today
      </p>

      {JUNCTIONS.map((j) => (
        <section key={j.id} className="mt-14">
          <div className="border-t border-signal-blue/30 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
              {j.label} · {j.at.toFixed(1)}s
            </p>
            <p className="mt-2 max-w-3xl font-serif text-base text-text">{WHY[j.id]}</p>
          </div>
          <div className="mt-5">
            <JunctionStage junction={j} />
          </div>
        </section>
      ))}
    </main>
  );
}
