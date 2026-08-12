// SANDBOX - a Library cluster in ten seconds. DEV ONLY.
import { notFound } from "next/navigation";
import { ClusterStage } from "./ClusterStage";
import { CLUSTERS } from "./clusters";

export default function ClusterSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LIBRARY &middot; a cluster in ten seconds
      </p>
      <h1 className="title-section mt-3">Cluster explainer</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The same grid as the beta film: 120 BPM, five bars, ten seconds, one word
        on each downbeat. What is different is what it needed to exist. The film
        took three bespoke rigs before it had a single frame: a three.js gerber
        handoff, a signed-in exam capture, a certificate card. This took none.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Every plate is a diagram already exported, already committed and already
        listed in the image sitemap. The type is the shipped cue layer, not a
        lookalike. So a new cluster costs four basenames, four words and a payoff
        line, which is what <code>clusters.ts</code> is; the second sheet below
        exists only to show that the second one costs the same as the first.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
        The captions are not written here either. Every diagram carries an
        aria-label the exporter refuses to run without, so all 86 arrive with a
        reviewed sentence attached, ready for subtitles or a voice track.
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {CLUSTERS.map((c) => (
          <li key={c.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="title-card">{c.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                {c.beats.map((b) => b.word).join(" · ")}
              </span>
            </div>
            <div className="mt-3">
              <ClusterStage beats={c.beats} payoff={c.payoff} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
