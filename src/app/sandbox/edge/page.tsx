// SANDBOX — the DESIGN -> BUILD handoff, one canvas, scrubbable. DEV ONLY.
import { notFound } from "next/navigation";
import { HandoffRig } from "./HandoffRig";
import { RateGraph } from "./RateGraph";
import { HANDOFF, SECONDS } from "./timing";

const BEATS: [string, string, string][] = [
  ["0.5 – 1.5s", "EXPLODE", "the eight sheets fly apart"],
  ["1.5 – 2.9s", "DESIGN", "held open, turning"],
  ["2.9 – 3.85s", "COLLAPSE", "closes onto exactly the board's thickness"],
  ["3.85 – 4.0s", "MATCHED", "one slab, board-thick, held for a beat"],
  ["4.0 – 4.5s", "CROSSFADE", "stack to board, spin unbroken"],
  ["4.5 – 11.0s", "BUILD", "the board turns"],
  ["11.0 – 12.0s", "loop-back", "page only, not in the film"],
];

export default function EdgeSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ DESIGN → BUILD · collapse to thickness, then cross-fade
      </p>
      <h1 className="title-section mt-3">The handoff</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        You were right that it was breaking up, and the cause was worse than
        choppiness. The board comes out of the GLB Y-up, so its plane is XZ with
        the thickness on Y, while the gerber stack is built XY with the thickness
        on Z. Both then got the same tilt, which made them look related while
        they were in fact crossing at ninety degrees. At the cross-fade the frame
        held a giant X. It was never doing the handoff.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The other half was real starvation. The old page ran nine WebGL contexts
        on one scroll, and the board alone measured 2 frames per second against
        the stack&rsquo;s 60. Not heavy geometry: 86,000 triangles is nothing. It
        is 5,987 separate meshes over 26 materials, because KiCad exports every
        pad and via as its own node. Merged by material that is 26 draw calls,
        and the board now runs at 60 like everything else.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The sequence is the one you described. The sheets collapse until the
        stack is exactly the board&rsquo;s thickness, it holds there for a beat,
        and only then does it trade places with the board. The thickness is
        measured off the model rather than guessed and both numbers print under
        the frame in blue, so you can watch them meet.{" "}
        <em>Thickness ghost</em> draws the target the stack is closing into.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Drag the bar to scrub. The clock and the bar drive the SAME function, so
        the frame you scrub to is the frame that plays.{" "}
        <em>Jump to handoff</em> parks on {HANDOFF.toFixed(1)}s and the frame
        buttons step a thirtieth of a second at a time, which is the only honest
        way to check a cut this short.
      </p>

      <div className="mt-8">
        <HandoffRig w={960} h={540} />
      </div>

      <section className="mt-16 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">THE BEATS</p>
        <ul className="mt-3 max-w-3xl border-t border-panel-border/60">
          {BEATS.map(([t, name, note]) => (
            <li key={t} className="flex flex-wrap gap-x-6 gap-y-1 border-b border-panel-border/60 py-3">
              <span className="w-32 font-numeral text-base tabular-nums text-command-gold">{t}</span>
              <span className="w-28 font-mono text-[10px] uppercase tracking-[0.2em] text-title">{name}</span>
              <span className="font-serif text-sm text-muted">{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl font-serif text-base text-text">
          The loop is {SECONDS} seconds and the turntable closes exactly one
          revolution inside it, so the wrap is continuous. The old 8 second loop
          covered 240 degrees and jumped 120 every time round, which was the rest
          of the choppiness.
        </p>
      </section>

      <section className="mt-16 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          WHY THE LAST FOUR WERE INERT
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          I shaped those with monotone cubic interpolation and a limiter whose
          entire job is to guarantee the rotation never reverses. That rules out
          both of the things dynamic rotation is actually made of. Motion design
          gets its snap from ANTICIPATION, moving a little the wrong way before
          committing, and from OVERSHOOT AND SETTLE, passing the target then
          relaxing back in decaying oscillations. I had banned both by
          construction, then wondered why nothing felt alive.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          So the angle is no longer a curve to be drawn. It is a damped spring
          chasing a target, which is also the literal owl: the head does not
          follow a path, it chases where the bird wants to look. Give the target
          a small negative step and then a large positive one and the flinch, the
          whip, the overshoot and the settle all fall out of the physics.
          Damping ratio is the one knob that decides how far it bounces past.
          Solved in closed form per segment, so scrubbing to an instant gives
          exactly what playback gives.
        </p>

        <div className="mt-6">
          <RateGraph />
        </div>

        <ul className="mt-6 max-w-3xl border-t border-panel-border/60">
          {[
            ["Constant", "30°/s", "0%", "the old behaviour, for comparison"],
            ["Snap", "−22 → 338°/s", "8.4%", "track, flinch, snap, settle"],
            ["Crack", "−64 → 422°/s", "16.3%", "violent. the bounce is the point"],
            ["Double-take", "−18 → 250°/s", "9.5%", "two snaps and a correction"],
            ["Hero lock", "−22 → 332°/s", "3.8%", "locked through DESIGN, one turn, locks again"],
          ].map(([name, range, over, note]) => (
            <li key={name} className="flex flex-wrap gap-x-6 gap-y-1 border-b border-panel-border/60 py-3">
              <span className="w-28 font-mono text-[10px] uppercase tracking-[0.2em] text-title">{name}</span>
              <span className="w-32 font-numeral text-base tabular-nums text-command-gold">{range}</span>
              <span className="w-16 font-numeral text-base tabular-nums text-muted">{over}</span>
              <span className="font-serif text-sm text-muted">{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl font-serif text-base text-text">
          <strong className="text-title">Hero lock</strong> is worth a look even
          though it is the odd one out. Product films resolve on a held hero
          rather than a spin that never stops, and this one is stationary through
          the whole explode and handoff, so every bit of motion in DESIGN belongs
          to the sheets. It still loops seamlessly, because it is locked at the
          same angle at both ends.
        </p>
      </section>

      <section className="mt-16 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          THE BLUR IS NOT A GARNISH
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          A whip peaks near 420 degrees per second. At 30 frames a second that is
          14 degrees of rotation inside one frame, and every frame so far has
          been drawn as a single perfectly sharp pose. The board teleports and
          the eye reads a strobe, not a move. This is very likely a good part of
          why the fast profiles felt wrong rather than fast.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Since the clock is ours, the honest fix is a real shutter: render
          several sub-samples spread across each frame&rsquo;s exposure and
          average them. No velocity buffers, no reprojection artefacts round the
          silhouette, and the sheets and the crossfade blur correctly too because
          it is simply the scene at several instants. The exposure is half a
          frame, the film-standard 180 degree shutter. Sample count is adaptive:
          the gold readout under the frame shows how far the board sweeps during
          the exposure and how many sub-samples that bought. Tracking costs one.
          The whip costs about a dozen, for the handful of frames it lasts.
          Toggle it off and watch the same whip strobe.
        </p>
      </section>
    </main>
  );
}
