// SANDBOX — visuals locked, 10 reverses and 10 stutters. DEV ONLY.
import { notFound } from "next/navigation";
import { ScoreStage, type Group } from "../score/ScoreStage";

const GROUPS: Group[] = [
  {
    id: "reverse",
    label: "REVERSE AT LEARN · drop held at stutter",
    tracks: [
      { id: "r2-rev-short", title: "Short", note: "Half a second of run-up. Arrives without eating the bar before it" },
      { id: "r2-reverse", title: "Mid", note: "1.2 seconds. The middle setting" },
      { id: "r2-rev-long", title: "Long", note: "Two seconds. The swell IS the bar and LEARN is where it resolves" },
      { id: "r2-rev-gap", title: "Gap", note: "Stops an eighth EARLY. The word lands in the silence the swell left" },
      { id: "r2-rev-splash", title: "Splash", note: "The 6-inch splash reversed. Tighter, less hiss" },
      { id: "r2-rev-china", title: "China", note: "The trashy china reversed. Dirtier, more edge on arrival" },
      { id: "r2-rev-gong", title: "Gong", note: "Tonal rather than noisy, so it swells WITH the bass" },
      { id: "r2-rev-dark", title: "Dark", note: "Reversed and lowpassed. All swell, no hiss on top" },
      { id: "r2-rev-land", title: "Land", note: "The swell AND a choked hit, so it arrives rather than just stops" },
      { id: "r2-rev-noise", title: "Noise", note: "Synthesised. No cymbal, so nothing rings on after the word" },
    ],
  },
  {
    id: "stutter",
    label: "STUTTER AT EARN · reverse held at long",
    tracks: [
      { id: "s2-stutter", title: "Plain", note: "Four sixteenths on the snare, rising into the hit" },
      { id: "s2-stutter-32", title: "32nds", note: "Eight repeats. Twice the density, same beat of runway" },
      { id: "s2-stutter-accel", title: "Accelerate", note: "Repeats crowding toward the drop. Reads as being pulled in" },
      { id: "s2-stutter-decel", title: "Decelerate", note: "Repeats spreading out into it. Reads as bracing" },
      { id: "s2-stutter-pitch", title: "Pitch up", note: "Each repeat higher and shorter. The classic riser stutter" },
      { id: "s2-stutter-gate", title: "Gate", note: "Chops what is already playing. The groove itself stutters" },
      { id: "s2-stutter-repeat", title: "Beat repeat", note: "One sixteenth of the bar copied over the rest of it" },
      { id: "s2-stutter-kick", title: "Kick", note: "The kick repeats instead of the snare. Lower, heavier, less busy" },
      { id: "s2-stutter-hat", title: "Hats", note: "Twelve hat repeats. The lightest; it ticks rather than hammers" },
      { id: "s2-stutter-gap", title: "Gap", note: "Stutters, then stops dead for an eighth before the hit" },
    ],
  },
];

export default function RoundSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ VISUALS LOCKED · twenty tracks
      </p>
      <h1 className="title-section mt-3">Reverse and stutter</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The picture is now your three choices, rendered rather than previewed:
        the hero lens, the constant thirty degrees per second, and a full
        thousand millisecond cross-fade. That last one is a real change to how
        the handoff reads. At 160 ms the stack became the board almost as a cut;
        across a whole second you watch the gerber artwork and the finished board
        occupy the same space at the same time, which is the idea the shot is
        actually about.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Half-time groove and saw-stab bass throughout. Each group changes one
        thing; switching keeps the bar you are on.
      </p>

      <div className="mt-8">
        <ScoreStage groups={GROUPS} />
      </div>

      <section className="mt-16 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          WHAT ACTUALLY VARIES IN A STUTTER
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Re-triggering a snare in sixteenths is only the simplest one, and ten
          gain settings of it would not be ten options. What differs between
          these is how many repeats there are, whether the spacing accelerates
          into the drop or spreads out before it, which voice repeats, whether
          the pitch climbs as it goes, and whether it ADDS to the mix or chops
          what is already there. Gate and beat-repeat do the latter, so the
          groove itself stutters instead of a new sound being laid over it.
        </p>
      </section>

      <section className="mt-12 border-t border-alert-red/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-alert-red">
          STILL WRONG IN THE PICTURE
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Unchanged and not the track&rsquo;s fault: EARN collides with the
          certificate, the finish beats are stills rather than the
          fanfare&rsquo;s own motion, the certificate does not rotate, and it
          carries a test persona&rsquo;s name.
        </p>
      </section>
    </main>
  );
}
