// SANDBOX - a Library cluster in ten seconds, diagrams live. DEV ONLY.
import { notFound } from "next/navigation";
import { ClusterLive } from "./ClusterLive";
import { CLUSTERS, type TextStyle } from "./clusters";

const STYLES: { id: TextStyle; label: string; note: string }[] = [
  {
    id: "word",
    label: "A · the film's word",
    note: "The cue layer as the beta film uses it, unchanged. One hard word per beat. It is the baseline, and the thing to notice is that a product launch's vocabulary lands oddly on a lesson: the word shouts and teaches nothing the diagram has not already said.",
  },
  {
    id: "term",
    label: "B · term and definition",
    note: "The diagram is a concept, so the type names it and says what it means. Bebas for the term in gold, Lora for the line, which is the pairing the lessons themselves use. This is the one that reads as teaching rather than advertising.",
  },
  {
    id: "caption",
    label: "C · the alt text as a caption track",
    note: "The word demoted to a corner tag and the diagram's OWN aria-label centred underneath. Nobody wrote those sentences for this: the exporter refuses to run without one, so 86 reviewed captions already exist. Works with the sound off, which is how a feed watches.",
  },
];

export default async function ClusterSandbox({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  // ?t=4.6 freezes every stage on one beat, for inspecting a single frame.
  const raw = (await searchParams).t;
  const fixedT = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : undefined;

  const fundamentals = CLUSTERS[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LIBRARY &middot; a cluster in ten seconds
      </p>
      <h1 className="title-section mt-3">Cluster explainer, live</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The diagrams are the real components now, not stills. The first pass
        composited exported <code>.webp</code> plates and faked motion with a slow
        scale, which threw away the best thing they have: several are Tier B in the
        animation standard, where the motion IS the lesson. A gold pulse travels the
        power path, bars fill and stop short, rows stack in order. A still of a flow
        diagram is a picture of a flow diagram.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The reveal is replayed on every beat and every lap. <code>useScrollReveal</code>{" "}
        arms once and disconnects, which is right for a page and useless for a loop,
        so the <code>.dgfrm.armed.in</code> classes are driven by hand. Reduced motion
        still wins: the hook refuses to arm under it and the diagrams simply sit
        finished.
      </p>

      <h2 className="title-section mt-10">Three ways the type could work</h2>
      <p className="mt-2 max-w-3xl font-serif text-base text-text">
        Same cluster, same beats, same diagrams. Only the words change.
      </p>

      <ul className="mt-6 border-t border-panel-border/60">
        {STYLES.map((s) => (
          <li key={s.id} className="border-b border-panel-border/60 py-6">
            <p className="title-card">{s.label}</p>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{s.note}</p>
            <div className="mt-3">
              <ClusterLive
                beats={fundamentals.beats}
                label={fundamentals.label}
                payoff={fundamentals.payoff}
                style={s.id}
                fixedT={fixedT}
              />
            </div>
          </li>
        ))}
      </ul>

      <h2 className="title-section mt-12">A second cluster, to show what one costs</h2>
      <p className="mt-2 max-w-3xl font-serif text-base text-text">
        Four basenames, four terms, four lines. No rig, no capture, no new picture.
      </p>
      <div className="mt-4">
        <ClusterLive
          beats={CLUSTERS[1].beats}
          label={CLUSTERS[1].label}
          payoff={CLUSTERS[1].payoff}
          style="term"
          fixedT={fixedT}
        />
      </div>
    </main>
  );
}
