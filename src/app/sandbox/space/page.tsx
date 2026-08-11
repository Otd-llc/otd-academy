// SANDBOX — profile 04, space reworked. DEV ONLY.
import { notFound } from "next/navigation";
import { SpaceStage } from "./SpaceStage";
import { LAYOUTS } from "./layouts";

export default function SpaceSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ PUSH IN · card left, link at the bottom
      </p>
      <h1 className="title-section mt-3">Using the frame</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Three things came out of that frame, and one of them was a bug rather
        than a taste call. <strong className="text-title">The card was
        clipped.</strong> Layout 08 put its right edge at 98% before anything
        moved; the push-in then grows it four and a half percent about its
        centre, and the six degree lean widens its axis-aligned box by roughly
        another three, so it ran off the edge. Every layout here leaves room for
        both, and the check measures the rendered bounds rather than trusting
        that arithmetic.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The link was not at the bottom either. It sat in grid row four,
        vertically centred, which lands it near 77% with a dead band underneath.
        It is bottom-aligned now. And with the word at 22% and the link at 77%,
        about a third of the frame was doing nothing, so these trade card size
        against word size to spend it.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Motion is fixed at the push-in. Only the layout changes
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {LAYOUTS.map((l) => (
          <li key={l.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-numeral text-base uppercase tabular-nums text-command-gold">
                {l.id}
              </span>
              <span className="title-card">{l.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                card {l.cert.w}% at x {l.cert.left}% · word {Math.round(l.wordScale * 100)}%
              </span>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{l.note}</p>
            <div className="mt-3">
              <SpaceStage id={l.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
