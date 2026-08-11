// SANDBOX - the EARN beat, rearranged. DEV ONLY.
import { notFound } from "next/navigation";
import { ArrangeFrame } from "./ArrangeFrame";
import { ARRANGEMENTS, EIGHT_MARKS } from "./layouts";

export default function ArrangeSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE PAYOFF &middot; eight ways to fill the frame
      </p>
      <h1 className="title-section mt-3">Arrangement</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Swell is locked in, so the ask pulses identically in every frame below and
        the only variable is where things sit. Four things read wrong in the
        current composition, and they are measurements rather than opinions.
      </p>
      <ul className="mt-4 max-w-3xl space-y-2 border-t border-panel-border/60 pt-4 font-serif text-sm text-muted">
        <li>
          <span className="text-text">The left column is three floating items.</span> The
          gaps between word, mark and ask run roughly 50, 95 and 45 pixels.
          Nothing groups, so the eye reads three separate events instead of one
          block.
        </li>
        <li>
          <span className="text-text">The URL is the only centred element.</span> Everything
          above it is flush left. A centred line under a left-aligned stack reads
          as a mistake rather than a choice.
        </li>
        <li>
          <span className="text-text">The mark shares an edge with nothing.</span> It has air
          on all four sides and no alignment to the word above or the box below,
          so it looks parked rather than placed.
        </li>
        <li>
          <span className="text-text">The bottom right is empty.</span> The card stops around
          79 percent of the height and nothing uses the corner underneath it.
        </li>
      </ul>

      <p className="mt-4 max-w-3xl font-serif text-base text-text">
        Everything after the first frame moves the URL flush left, because that
        one is not really a choice. The rest vary a single idea each: tighten the
        column, anchor it low, move the mark behind the card, let the mark bleed,
        crop the card off the right edge, share a baseline, or drop the mark
        entirely.
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {ARRANGEMENTS.map((a, i) => (
          <li key={a.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-numeral text-base tabular-nums text-command-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="title-card">{a.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                {a.wm ? `mark ${a.wm.size}% at ${a.wm.opacity}` : "no mark"} &middot; card{" "}
                {a.cert.w}% &middot; url {a.url.align}
              </span>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{a.note}</p>
            <div className="mt-3">
              <ArrangeFrame a={a} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          08 &middot; with the mark above the word
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          The column is 08 untouched, bottom anchored at a constant 10 gap: word
          ink 42.5 to 58.4, ask 68.3 to 78.9, link ink 88.9 to 91.0. So the mark
          has a fixed floor at 42.5 and a ceiling at the top safe line, and
          size is the only free variable. That makes size and gap the same
          decision, which is why these are ordered by it: 17.5, 11.5, 7.5, 3.5.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Opacity comes down as the mark grows, following the curve the flash
          round already set. A bigger mark puts more ink on the frame at the same
          alpha, so holding alpha flat would make the large ones shout.
        </p>
        <ul className="mt-5 border-t border-panel-border/60">
          {EIGHT_MARKS.map((a, i) => (
            <li key={a.id} className="border-b border-panel-border/60 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-numeral text-base tabular-nums text-command-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="title-card">{a.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                  {a.wm ? `${a.wm.size} at ${a.wm.opacity} · gap ${(42.5 - (a.wm.top + a.wm.size)).toFixed(1)}` : "no mark"}
                </span>
              </div>
              <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{a.note}</p>
              <div className="mt-3">
                <ArrangeFrame a={a} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
