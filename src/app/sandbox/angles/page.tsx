// SANDBOX — the gerber-to-board handoff at six camera angles. DEV ONLY.
import { notFound } from "next/navigation";
import { HandoffRig } from "../edge/HandoffRig";
import { ANGLES } from "../edge/spin";

const SHOTS = ["2.00s · exploded", "3.92s · matched thickness", "4.40s · the board"];

export default function AnglesSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ THE HANDOFF · six camera angles
      </p>
      <h1 className="title-section mt-3">Where to put the camera</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The transition itself is fixed: the sheets collapse onto the
        board&rsquo;s measured 1.51 mm, hold there for a beat, and cross-fade
        into the board with the turntable never breaking. What changes here is
        only where it is watched from, and that changes what the shot is ABOUT.
        Framing is solved per angle from the union of a whole turn, so nothing
        clips at any rotation and switching is instant.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The live rig is for judging the motion. The stills below it are for
        choosing the framing, and they are rendered offline rather than as six
        more canvases, because six WebGL contexts each baking an environment map
        is what starved an earlier comparison page to 19 frames per second.
      </p>

      <div className="mt-8">
        <HandoffRig w={960} h={540} />
      </div>

      <section className="mt-16">
        <div className="border-t border-signal-blue/30 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
            THE THREE INSTANTS THAT MATTER
          </p>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
            {SHOTS.map((s) => (
              <span key={s} className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                {s}
              </span>
            ))}
          </div>
        </div>

        <ul className="mt-6 border-t border-panel-border/60">
          {ANGLES.map((a) => (
            <li key={a.id} className="border-b border-panel-border/60 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="title-card">{a.label}</span>
                <span className="font-numeral text-base tabular-nums text-command-gold">
                  {(a.tilt * 180).toFixed(0)}°
                </span>
                {a.persp ? (
                  <span className="badge" data-tone="gold">
                    perspective
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{a.note}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
              <img src={`/_capture/angles/${a.id}.png`} alt="" className="mt-3 block w-full" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-alert-red/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-alert-red">
          TWO THINGS THE RENDERS SETTLED
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          I had the naming exactly backwards. The board lies in XY with its
          thickness on Z and the camera looks down -Z, so tilting the pivot
          swings the face AWAY from you: zero is face-on and ninety degrees is
          edge-on. The first table called &minus;85 degrees &ldquo;plan&rdquo;
          and &minus;9 degrees &ldquo;edge&rdquo;, which is the opposite of both.
          Rendering them showed it in one glance.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          And face-on has a real cost you can see in its middle frame: with the
          board flat to camera the collapsed stack is just the top sheet, so it
          reads as a blank cream plate and the whole point of the transition is
          hidden behind the layer nearest the lens. You said you liked face-on,
          so <strong className="text-title">Near face</strong> is the one worth
          looking at: it keeps almost all the artwork and admits just enough edge
          for the stack closing to be visible.
        </p>
      </section>
    </main>
  );
}
