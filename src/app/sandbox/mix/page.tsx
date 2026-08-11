// SANDBOX — half-time + rev-long locked, drops toggleable. DEV ONLY.
import { notFound } from "next/navigation";
import { ScoreStage, type Group } from "../score/ScoreStage";

const GROUPS: Group[] = [
  {
    id: "drops",
    label: "DROP · everything else held",
    tracks: [
      { id: "mix-anvil", title: "Anvil", note: "A 125 kg anvil struck on 6 mm steel" },
      { id: "mix-layered", title: "Layered", note: "Body, skin, top and something felt, all arriving together" },
      { id: "mix-crash", title: "Crash", note: "Plain and effective. A crash cymbal over the downbeat" },
      { id: "mix-subdrop", title: "Sub drop", note: "Felt more than heard, dropping under the hit" },
      { id: "mix-hush", title: "Hush", note: "A beat of silence before the hit. The gap does the work" },
      { id: "mix-reverse-cym", title: "Rev cymbal", note: "A reversed cymbal swelling into the bar" },
      { id: "mix-spark-riser", title: "Spark", note: "A reversed electrical arc rising into the hit" },
      { id: "mix-noise-sweep", title: "Noise", note: "A filtered white-noise riser. No sample, all envelope" },
      { id: "mix-tape-stop", title: "Tape stop", note: "The bar before pitches and slows to a halt" },
      { id: "mix-stutter", title: "Stutter", note: "The last beat gates into sixteenths, then releases" },
    ],
  },
];

export default function MixSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ HALF TIME · REVERSE LONG · ten drops
      </p>
      <h1 className="title-section mt-3">Pick the drop</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Locked: the half-time groove, and the two-second reversed crash on LEARN
        where the swell IS the bar and the word is where it resolves. Bass is the
        filtered saw stab, unchanged, because you have not picked one yet and
        half-time leaves it the most room, so it is worth choosing on its own
        rather than underneath a drop comparison.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Only the drop changes. Switching keeps the bar you are on, so two can be
        compared at the same instant rather than from the top.
      </p>

      <div className="mt-8">
        <ScoreStage groups={GROUPS} />
      </div>

      <section className="mt-16 border-t border-status-green/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-status-green">
          THE PICTURE IS THE SANDBOXED HANDOFF NOW
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          The gerbers collapse onto the board&rsquo;s measured 1.51 mm, hold
          there for a beat, and cross-fade into the board with the turntable
          never breaking. That is the rig from /sandbox/edge rendered directly
          rather than a pair of clips cut together, which is what it used to be.
          Camera angles for that transition are at /sandbox/angles.
        </p>
      </section>
    </main>
  );
}
