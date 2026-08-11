// SANDBOX — 10 options per dimension, beat-driven. DEV ONLY.
import { notFound } from "next/navigation";
import { BedAudition, type Kit } from "../bed/BedAudition";

type Dim = { id: string; title: string; lead: string; kits: Kit[] };

const DIMS: Dim[] = [
  {
    id: "drums",
    title: "Drums",
    lead: "The groove and the kit. Bass and drop are held at saw-stab and anvil so the only thing changing is the pattern.",
    kits: [
      { id: "drums-four-floor", title: "Four on the floor", note: "Clap on 2 and 4, hats on the eighths" },
      { id: "drums-boom-bap", title: "Boom bap", note: "Kick on 1 and the and-of-3, snare answering on 2 and 4" },
      { id: "drums-trap", title: "Trap", note: "Snare on 3 only, hats in sixteenths with a roll into the bar" },
      { id: "drums-break", title: "Breakbeat", note: "Syncopated kick, ghosted snare, driving eighths" },
      { id: "drums-half-time", title: "Half time", note: "Snare on 3 alone, wide open, lets the bass carry" },
      { id: "drums-tom-drive", title: "Tom drive", note: "Eighth-note toms under a plain backbeat" },
      { id: "drums-industrial", title: "Industrial", note: "Four on the floor with dropped metal on the offbeats" },
      { id: "drums-march", title: "March", note: "Snare sixteenths and a hard two-step kick" },
      { id: "drums-disco", title: "Disco", note: "Open hat on every offbeat" },
      { id: "drums-rolling", title: "Rolling", note: "Two-step kick, sixteenth hats, shaker" },
    ],
  },
  {
    id: "bass",
    title: "Bass",
    lead: "Synthesised, so character is a parameter rather than a sample hunt. A natural minor, one root per bar, A A F G A, resolving on the last so the loop has somewhere to come back from.",
    kits: [
      { id: "bass-sub-hold", title: "Sub hold", note: "A sine holding the root. Felt, not heard" },
      { id: "bass-octave-pulse", title: "Octave pulse", note: "Sine eighths alternating root and octave" },
      { id: "bass-saw-stab", title: "Saw stab", note: "Filtered saw stabs on the eighths. The most jingle" },
      { id: "bass-glide", title: "Glide", note: "808-style, gliding between notes instead of stepping" },
      { id: "bass-reese", title: "Reese", note: "Two detuned saws beating against each other" },
      { id: "bass-square-riff", title: "Square riff", note: "A square sixteenth riff. Busy and bright" },
      { id: "bass-offbeat", title: "Offbeat", note: "Stabs on the offbeat, leaving the downbeat to the kick" },
      { id: "bass-walk", title: "Walk", note: "A walking line through the scale, one note per beat" },
      { id: "bass-acid", title: "Acid", note: "Resonant filter sweeping across the bar. 303 territory" },
      { id: "bass-pluck", title: "Pluck", note: "Short triangle plucks arpeggiating the chord" },
    ],
  },
  {
    id: "drop",
    title: "Drop",
    lead: "What happens at EARN, and how bar 4 approaches it. This is where the workshop material earns its place: one struck anvil does more than a kit built out of them.",
    kits: [
      { id: "drop-anvil", title: "Anvil", note: "A 125 kg anvil struck on 6 mm steel" },
      { id: "drop-layered", title: "Layered", note: "Body, skin, top and something felt, all at once" },
      { id: "drop-crash", title: "Crash", note: "Plain and effective. A crash over the downbeat" },
      { id: "drop-subdrop", title: "Sub drop", note: "Felt more than heard, dropping under the hit" },
      { id: "drop-hush", title: "Hush", note: "A beat of silence before the hit. The gap does the work" },
      { id: "drop-reverse-cym", title: "Reverse cymbal", note: "The classic swell into the bar" },
      { id: "drop-spark-riser", title: "Spark riser", note: "A reversed electrical arc rising into the hit" },
      { id: "drop-noise-sweep", title: "Noise sweep", note: "A filtered white-noise riser. No sample, all envelope" },
      { id: "drop-tape-stop", title: "Tape stop", note: "The bar before pitches and slows to a halt" },
      { id: "drop-stutter", title: "Stutter", note: "The last beat gates into sixteenths, then releases" },
    ],
  },
];

export default function JingleSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ THE JINGLE · ten per dimension
      </p>
      <h1 className="title-section mt-3">Drums, bass, drop</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        You were right and the reason was structural. The library had kick,
        taiko, tom, impact and sub: everything needed to LAND a hit and nothing
        needed to HOLD a groove. There was no snare, no hi-hat and no clap, so
        sparse was the only thing the material could express and rearranging it
        was never going to help. Those are fetched now, 909 snare included, and
        the arrangement is a sixteenth-grid groove that runs the whole ten
        seconds with the four words landing on top of it.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The workshop foley is demoted rather than deleted. As a whole kit it made
        foley, not music. As a drop or the riser into one, struck steel is
        genuinely good and it keeps the cut tied to its subject, so it lives in
        the third dimension and nowhere else.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Each sweep holds the other two fixed. Comparing ten things that differ in
        three ways at once tells you nothing.
      </p>

      {DIMS.map((d) => (
        <section key={d.id} className="mt-16">
          <div className="border-t border-signal-blue/30 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
              {d.title.toUpperCase()} · 10
            </p>
            <p className="mt-2 max-w-3xl font-serif text-base text-text">{d.lead}</p>
          </div>
          <div className="mt-6">
            <BedAudition kits={d.kits} dir="jingles" />
          </div>
        </section>
      ))}

      <section className="mt-20 border-t border-panel-border/60 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          MEASURED, NOT ASSERTED
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          &ldquo;Beat-driven&rdquo; is a claim about numbers, so all thirty are
          checked for it: 20 to 34 onsets in EVERY bar (the old bed had four in
          ten seconds), and energy concentrated 1.7x to 3.3x more on the
          sixteenth grid than between it. Two real faults fell out of that.
          Trimming leading silence off every sample moved grid concentration
          from 47% to where it is now, because an upload padded with 30 ms of
          quiet plays 30 ms late and a kit padded unevenly drags unevenly. And
          the long tom smeared its groove to 1.14x, which is a wash rather than
          a beat, so tom-drive got a shorter tom.
        </p>
      </section>
    </main>
  );
}
