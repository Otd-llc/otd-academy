// SANDBOX — subtle parallax on the tilted certificate. DEV ONLY.
import { notFound } from "next/navigation";
import { ParallaxStage } from "./ParallaxStage";
import { PROFILES } from "./profiles";

export default function ParallaxSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ LAYOUT 08 · subtle parallax
      </p>
      <h1 className="title-section mt-3">Barely moving</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The pirouette made the card the event. At this point in the cut the card
        IS the payoff and it carries the only call to action, so it wants to be
        read rather than watched. Everything here is small enough that the
        certificate is legible in every frame: a few degrees of yaw, a percent or
        two of scale, and the six degree lean held throughout.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        What makes it parallax rather than a wobble is that the card and the type
        sit at different depths and can move at different rates. Most of these
        drift only the card; <strong className="text-title">True parallax</strong>{" "}
        moves the type the other way, which is the literal version of the effect
        and the only one where the two planes visibly separate.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Two seconds. All but Float come to rest
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {PROFILES.map((p, i) => (
          <li key={p.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-numeral text-base tabular-nums text-command-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="title-card">{p.label}</span>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{p.note}</p>
            <div className="mt-3">
              {/* ID only: the profile carries a pose FUNCTION, which cannot be
                  serialised from a server component to a client one. */}
              <ParallaxStage id={p.id} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-12 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          NO MOTION BLUR HERE, DELIBERATELY
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          The board and the pirouette need a shutter because they sweep tens of
          degrees inside a single frame and would otherwise strobe. The fastest
          thing on this page moves about two tenths of a degree per frame, which
          is nowhere near that threshold, so accumulating sub-samples would cost
          eight renders a frame to produce a picture identical to one.
        </p>
      </section>
    </main>
  );
}
