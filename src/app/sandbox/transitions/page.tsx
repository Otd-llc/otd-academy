// SANDBOX — DESIGN -> BUILD transitions, plus the corrected plates. DEV ONLY.
import { notFound } from "next/navigation";
import { HandoffStage, type Mode } from "./HandoffStage";

const MODES: { mode: Mode; title: string; note: string }[] = [
  {
    mode: "collapse",
    title: "1 · COLLAPSE",
    note: "The sheets close, then the board takes over in one frame. Physically motivated: the collapsed stack IS the board",
  },
  {
    mode: "edge",
    title: "2 · EDGE-ON SWAP",
    note: "Swaps at the instant the stack is edge-on, where a flat thing is nearly invisible. Costs nothing, reads as sleight of hand",
  },
  {
    mode: "dissolve",
    title: "3 · DISSOLVE",
    note: "Cross-fade on the beat. Simplest, and the least interesting",
  },
  {
    mode: "push",
    title: "4 · PUSH-THROUGH",
    note: "The board arrives from behind along the spin axis as the stack recedes",
  },
];

export default function TransitionsSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ DESIGN → BUILD · one turntable, four handoffs
      </p>
      <h1 className="title-section mt-3">Pick the transition</h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Both objects now ride ONE turntable at ONE rate, 30 degrees per second,
        so the handoff is continuous by construction rather than matched by eye.
        Before this the stack turned at 51 deg/sec and the board at 30, which is
        why they could never meet. The four options differ only in what happens
        to the object at the join, which is the part actually worth choosing.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        The explode also runs out AND back before the handoff, so the stack is
        closed at the moment it becomes the board. Handing off mid-explode would
        mean the board inheriting a shape the sheets never resolved.
      </p>

      {MODES.map((m) => (
        <section key={m.mode} data-opt={m.title} className="mt-14">
          <div className="border-t border-signal-blue/30 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
              {m.title}
            </p>
            <p className="mt-1 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {m.note}
            </p>
          </div>
          <div className="mt-5">
            <HandoffStage mode={m.mode} w={900} h={506} />
          </div>
        </section>
      ))}

      <section className="mt-20">
        <div className="border-t border-signal-blue/30 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
            THE CORRECTED PLATES
          </p>
          <p className="mt-1 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            First-timer state, no browser chrome, and the exam now speaks the
            academy&rsquo;s honeycomb
          </p>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <figure className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
            <img src="/_capture/tight/exam-picked.png" alt="" className="block w-full" />
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
              LEARN · honeycomb options, zero prior attempts, chrome hidden
            </figcaption>
          </figure>
          <figure className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- local plate */}
            <img src="/_capture/cine/cert-card.png" alt="" className="block w-full" />
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
              EARN · the real certificate card, cropped to its own bounds
            </figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}
