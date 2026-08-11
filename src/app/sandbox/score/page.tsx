// SANDBOX — the cut with every track option. DEV ONLY.
import { notFound } from "next/navigation";
import { ScoreStage, type Group } from "./ScoreStage";

const GROUPS: Group[] = [
  {
    id: "combos",
    label: "FULL COMBINATIONS · finished candidates",
    tracks: [
      { id: "four-floor_saw-stab_layered", title: "Punch", note: "Four on the floor, saw stabs, a layered drop. The safe one, and it works" },
      { id: "trap_glide_subdrop", title: "Modern", note: "Trap hats, gliding 808, sub drop. Closest to what a product teaser sounds like now" },
      { id: "boom-bap_walk_crash", title: "Organic", note: "Boom bap, a walking bass, a crash. Least synthetic, most human" },
      { id: "industrial_reese_anvil", title: "Forge", note: "Industrial groove, reese bass, the anvil. On-theme and heavy" },
      { id: "disco_octave-pulse_noise-sweep", title: "Bright", note: "Disco offbeat hats, octave bass, noise sweep. The most upbeat" },
      { id: "half-time_acid_hush", title: "Tense", note: "Half time, acid line, a beat of silence before the hit. The most cinematic" },
    ],
  },
  {
    id: "drums",
    label: "DRUMS · bass and drop held at saw-stab / anvil",
    tracks: [
      { id: "drums-four-floor", title: "Four floor", note: "Clap on 2 and 4, hats on the eighths" },
      { id: "drums-boom-bap", title: "Boom bap", note: "Kick on 1 and the and-of-3, snare on 2 and 4" },
      { id: "drums-trap", title: "Trap", note: "Snare on 3 only, sixteenth hats with a roll" },
      { id: "drums-break", title: "Break", note: "Syncopated kick, ghosted snare" },
      { id: "drums-half-time", title: "Half time", note: "Snare on 3 alone, wide open" },
      { id: "drums-tom-drive", title: "Tom drive", note: "Eighth-note toms under a plain backbeat" },
      { id: "drums-industrial", title: "Industrial", note: "Four on the floor with dropped metal offbeats" },
      { id: "drums-march", title: "March", note: "Snare sixteenths, hard two-step kick" },
      { id: "drums-disco", title: "Disco", note: "Open hat on every offbeat" },
      { id: "drums-rolling", title: "Rolling", note: "Two-step kick, sixteenth hats, shaker" },
    ],
  },
  {
    id: "bass",
    label: "BASS · drums and drop held at four-floor / anvil",
    tracks: [
      { id: "bass-sub-hold", title: "Sub hold", note: "A sine holding the root. Felt, not heard" },
      { id: "bass-octave-pulse", title: "Octave", note: "Sine eighths alternating root and octave" },
      { id: "bass-saw-stab", title: "Saw stab", note: "Filtered saw stabs on the eighths" },
      { id: "bass-glide", title: "Glide", note: "808-style, gliding between notes" },
      { id: "bass-reese", title: "Reese", note: "Two detuned saws beating against each other" },
      { id: "bass-square-riff", title: "Square", note: "A square sixteenth riff. Busy and bright" },
      { id: "bass-offbeat", title: "Offbeat", note: "Stabs on the offbeat only" },
      { id: "bass-walk", title: "Walk", note: "A walking line through the scale" },
      { id: "bass-acid", title: "Acid", note: "Resonant filter sweeping across the bar" },
      { id: "bass-pluck", title: "Pluck", note: "Short triangle plucks arpeggiating the chord" },
    ],
  },
  {
    id: "ht-rev",
    label: "HALF TIME + REVERSE · nine ways to swell into LEARN",
    tracks: [
      { id: "ht-reverse", title: "Reverse", note: "The 18-inch crash reversed over 1.2s. The one you asked for" },
      { id: "ht-rev-short", title: "Short", note: "A half-second run-up. Arrives without eating the bar before it" },
      { id: "ht-rev-long", title: "Long", note: "Two full seconds. The swell IS the bar; LEARN is where it resolves" },
      { id: "ht-rev-splash", title: "Splash", note: "The 6-inch splash reversed. Tighter and less hissy" },
      { id: "ht-rev-china", title: "China", note: "The trashy china reversed. Dirtier, more edge on arrival" },
      { id: "ht-rev-gong", title: "Gong", note: "Tonal rather than noisy, so it swells WITH the bass" },
      { id: "ht-rev-dark", title: "Dark", note: "Reversed and lowpassed. Swells without the hiss on top" },
      { id: "ht-rev-land", title: "Land", note: "The swell AND a choked hit, so it arrives rather than just stops" },
      { id: "ht-rev-noise", title: "Noise", note: "A synthesised swell. No cymbal, so nothing rings after the word" },
    ],
  },
  {
    id: "learn",
    label: "LEARN ACCENT · what lands on the word at 6.0s",
    tracks: [
      { id: "learn-splash", title: "Splash", note: "A 6-inch splash. Short and bright. What it has been so far, now on purpose" },
      { id: "learn-crash", title: "Crash", note: "An 18-inch medium thin crash. Grander, and it rings across the bar" },
      { id: "learn-choke", title: "Choke", note: "The crash, choked. All the attack, none of the ring. Decisive" },
      { id: "learn-reverse", title: "Reverse", note: "A cymbal reversed so it swells INTO the word rather than off it" },
      { id: "learn-openhat", title: "Open hat", note: "Keeps time rather than announcing. The most restrained" },
      { id: "learn-bell", title: "Bell", note: "Tonal rather than noisy, so it sits with the bass instead of over it" },
      { id: "learn-china", title: "China", note: "Trashy and ugly on purpose. Cuts through anything" },
      { id: "learn-click-stack", title: "Click stack", note: "A splash under a switch click, so the cursor's action is audible" },
      { id: "learn-spark", title: "Spark", note: "An electrical snap instead of a cymbal. Ties the accent to the subject" },
      { id: "learn-none", title: "None", note: "Nothing. The snare fill and the groove carry the word on their own" },
    ],
  },
  {
    id: "drop",
    label: "DROP · drums and bass held at four-floor / saw-stab",
    tracks: [
      { id: "drop-anvil", title: "Anvil", note: "A 125 kg anvil struck on 6 mm steel" },
      { id: "drop-layered", title: "Layered", note: "Body, skin, top and something felt, at once" },
      { id: "drop-crash", title: "Crash", note: "A crash cymbal over the downbeat" },
      { id: "drop-subdrop", title: "Sub drop", note: "Felt more than heard, dropping under the hit" },
      { id: "drop-hush", title: "Hush", note: "A beat of silence before the hit" },
      { id: "drop-reverse-cym", title: "Rev cymbal", note: "The classic swell into the bar" },
      { id: "drop-spark-riser", title: "Spark", note: "A reversed electrical arc rising into the hit" },
      { id: "drop-noise-sweep", title: "Noise", note: "A filtered white-noise riser, all envelope" },
      { id: "drop-tape-stop", title: "Tape stop", note: "The bar before slows to a halt" },
      { id: "drop-stutter", title: "Stutter", note: "The last beat gates into sixteenths" },
    ],
  },
];

export default function ScoreSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ PICTURE AND TRACK · 46 options, one render
      </p>
      <h1 className="title-section mt-3">Score the cut</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Every option here plays against the SAME picture. Muxing 46 videos would
        have been 46 copies of one 3 MB render, so the video loads once and the
        track is swapped underneath it, which also means the picture provably
        cannot differ between options. Switching keeps the bar you are on, so two
        tracks can be compared at the same moment instead of from the top.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The track is the clock, not the video. A video and an audio element
        played side by side drift, and on a beat-driven cut drift is precisely
        what ruins the judgement. The audio runs through Web Audio, whose clock
        is sample-accurate, and the picture is nudged back whenever it strays
        more than a frame and a half.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Start with the six combinations. The four sweeps below them change one
        dimension at a time.
      </p>

      <section className="mt-8 border-t border-panel-border/60 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          THE CYMBAL AT LEARN
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          You caught a real one. Something does land exactly on LEARN, and it was
          never chosen: a 6-inch splash sitting in the fill table as part of the
          drum pattern, which happens to fall on bar 4&rsquo;s downbeat. That
          makes it the loudest thing in the jingle after the drop, decided by
          nobody. It is its own dimension now, with ten options.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          It also costs more than it looked like it did. With the splash there,
          bar 5 measures 1.10x the loudest other bar; with most alternatives it
          measures 1.21x. The accent on LEARN was quietly inflating bar 4 and
          taking the payoff down with it.
        </p>
      </section>

      <div className="mt-8">
        <ScoreStage groups={GROUPS} />
      </div>

      <section className="mt-16 border-t border-status-green/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-status-green">
          FIXED · the handoff is now the one that was sandboxed
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          You were right, and it was worse than a tuning problem. The cut spliced
          TWO separately-rendered clips with a hard cut at 4.0 seconds: a gerber
          stack turning at one rate, then a board turning at another. Everything
          that was actually designed for that moment lived only in
          /sandbox/edge and had never been in the film at all. The sheets
          collapsing onto the board&rsquo;s measured 1.51 mm, the held beat at
          matched thickness, the cross-fade with the turntable never breaking:
          none of it was there.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          The picture now renders that rig directly, as one continuous six-second
          segment rather than two clips. Not a reimplementation for capture: the
          same component, scrubbed frame by frame, with the sample budget off
          because an offline render has no frame deadline to inherit. Its
          cross-fade already sat at 4.0, which is BUILD&rsquo;s downbeat, so
          nothing had to move.
        </p>
      </section>

      <section className="mt-12 border-t border-alert-red/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-alert-red">
          STILL WRONG
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          EARN collides with the certificate. The finish beats are stills rather
          than the fanfare&rsquo;s own motion. The certificate does not rotate.
          The certificate carries a test persona&rsquo;s name. And the spin is
          still the flat 30 degrees per second, which is the one worth doing
          next: there is a beat to place a whip against now.
        </p>
      </section>
    </main>
  );
}
