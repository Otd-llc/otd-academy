// SANDBOX — audition the promo bed. DEV ONLY.
import { notFound } from "next/navigation";
import { BedAudition, type Kit } from "./BedAudition";

const KITS: Kit[] = [
  { id: "forge", title: "Forge", note: "Taiko carries it. Four struck landings, dry click on LEARN" },
  { id: "forge-hush", title: "Forge / hush", note: "A beat of silence before EARN. The gap is the trick" },
  { id: "forge-roll", title: "Forge / roll", note: "An accelerating fill so LEARN runs into EARN" },
  { id: "forge-swell", title: "Forge / swell", note: "A reverse swell into every landing, so each word is approached" },
  { id: "machine", title: "Machine", note: "Harder, mechanical. Rim work between landings, tighter room" },
  { id: "sparse", title: "Sparse", note: "Minimal. Almost no kit between landings, the type carries it" },
];

export default function BedSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ THE BED · four landings, one per word
      </p>
      <h1 className="title-section mt-3">Score the cut</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The Hex bed has one dramatic event and its whole arrangement serves that
        drop. This cut has four, one per word, on consecutive bar downbeats, so
        pointing the Hex arc at it would put all the weight on BUILD and leave
        the payoff limp. Different composition, same machinery: same 120 BPM
        grid, same CC0 samples, same finishing chain.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        LEARN is deliberately NOT the loudest of the middle two. The picture
        there is a cursor clicking one answer, not an impact, so it escalates by
        changing colour instead of volume: a dry mechanical click against three
        struck hits. The dip is the shape, not a mistake to tune out.
      </p>

      <div className="mt-8">
        <BedAudition kits={KITS} />
      </div>

      <section className="mt-16 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          THE MASTER NEARLY ATE THE ARRANGEMENT
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Worth knowing, because it was invisible until it was measured.{" "}
          <code className="font-mono text-[13px] text-gold-light">loudnorm</code>&rsquo;s{" "}
          <code className="font-mono text-[13px] text-gold-light">linear=true</code> is a request,
          not a guarantee. The bed measured &minus;22.9 LUFS at &minus;7.4 dBTP, so
          reaching the &minus;14 LUFS platform target needs +8.9 dB but only +6.4
          fits under the &minus;1 dBTP ceiling. It quietly fell back to dynamic
          normalisation and took the last 2.5 dB out of the dynamics.
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          The result passed every casual check and was ruined: all four landings
          pinned flat at the limiter ceiling, EARN over LEARN collapsed from
          1.49x to 1.01x, crest from 16.3 to 13.2 dB. A four-landing arc levelled
          into one loud bar. The mastering script now computes what linear gain
          can actually buy and takes that, so these sit around &minus;16.5 LUFS
          instead of &minus;14. Platforms only turn DOWN material that is louder
          than target, so the shortfall costs very little and the squash cost the
          whole idea.
        </p>
        <ul className="mt-5 max-w-3xl border-t border-panel-border/60">
          {[
            ["Slammed to −14", "1.01x", "13.2 dB", "every landing at the ceiling"],
            ["Linear-capped", "1.69x", "15.9 dB", "the arc intact"],
          ].map(([name, ratio, crest, note]) => (
            <li key={name} className="flex flex-wrap gap-x-6 gap-y-1 border-b border-panel-border/60 py-3">
              <span className="w-36 font-mono text-[10px] uppercase tracking-[0.2em] text-title">{name}</span>
              <span className="w-20 font-numeral text-base tabular-nums text-command-gold">{ratio}</span>
              <span className="w-20 font-numeral text-base tabular-nums text-muted">{crest}</span>
              <span className="font-serif text-sm text-muted">{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          EARN over LEARN · crest factor · both measured on the mastered file
        </p>
      </section>
    </main>
  );
}
