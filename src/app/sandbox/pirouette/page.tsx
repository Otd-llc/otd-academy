// SANDBOX — layout 08 with the certificate pirouetting. DEV ONLY.
import { notFound } from "next/navigation";
import { PirouetteStage, type Profile } from "./PirouetteStage";

const PROFILES: Profile[] = [
  {
    id: "one",
    label: "One turn",
    note: "A single revolution, quintic ease-out, face-on by 1.2s. The plainest reading",
    turn: 360,
    dur: 1.2,
  },
  {
    id: "one-half",
    label: "One and a half",
    note: "540 degrees, so it arrives from behind and swings through the blank back before resolving",
    turn: 540,
    dur: 1.35,
  },
  {
    id: "two",
    label: "Two turns",
    note: "720 in the same time. Fast enough that the blur carries most of it",
    turn: 720,
    dur: 1.3,
  },
  {
    id: "settle",
    label: "Overshoot and settle",
    note: "Turns past face-on and rocks back. The same damped spring the board's snap profiles use",
    turn: 400,
    dur: 1.6,
    overshoot: 0.42,
  },
  {
    id: "reverse",
    label: "Counter turn",
    note: "One revolution the other way. Worth seeing against the board, which turns clockwise",
    turn: -360,
    dur: 1.2,
  },
  {
    id: "flip",
    label: "Card flip",
    note: "About the horizontal axis instead. A card being turned over rather than a pirouette",
    turn: 360,
    dur: 1.2,
    flip: true,
  },
  {
    id: "slow",
    label: "Never resolves",
    note: "A constant slow turn that is still going when the clip ends. Reads as a loop rather than an ending",
    turn: 180,
    dur: 2,
    continuous: true,
  },
];

export default function PirouetteSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ LAYOUT 08 · the certificate turning
      </p>
      <h1 className="title-section mt-3">Pirouette</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The card keeps the six degree lean and turns about its own vertical axis,
        so the lean stays put and only the facing changes. Rotating the lean too
        would read as a tumble, and it would swing the card back into the type it
        was just moved away from.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        It has a back and an edge. A textured plane turning about Y vanishes for
        the frames it is edge-on and shows a mirrored certificate for the whole
        half-turn it faces away, which reads as a bug rather than a rotation.
        This is a thin box: the plate on the front, the card&rsquo;s own paper
        colour on the back and the edges, so it is an object rather than a decal.
        And it is shuttered, for the same reason the board is: a fast turn drawn
        as a series of perfectly sharp poses strobes.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Two seconds, the length EARN actually has. All but the last resolve
        face-on and hold
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {PROFILES.map((p, i) => (
          <li key={p.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-numeral text-base tabular-nums text-command-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="title-card">{p.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                {p.turn}° over {p.dur}s{p.overshoot ? " · damped" : ""}
                {p.continuous ? " · continuous" : ""}
              </span>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{p.note}</p>
            <div className="mt-3">
              <PirouetteStage profile={p} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-12 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          WHY THEY MOSTLY END FACING YOU
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          This is the payoff and the certificate carries the only call to action
          in the film, so it has to be readable when the clip stops. A card still
          turning at ten seconds reads as a loop rather than an ending, which is
          the same reason the board&rsquo;s hero profile locks. The last option
          is there so you can hear that argument and disagree with it.
        </p>
      </section>
    </main>
  );
}
