// SANDBOX - the call to action under EARN. DEV ONLY.
import { notFound } from "next/navigation";
import { CtaFrame, type Variant } from "./CtaFrame";

const ASK = "Start the build";

const TREATMENTS: Variant[] = [
  { id: "t-bare", label: "Bare line", note: "Mono gold, nothing around it. The quietest, and the most like the rest of the system", treatment: "bare", words: ASK },
  { id: "t-rule", label: "Rule above", note: "A short gold hairline over it. The house's own way of opening a section", treatment: "rule", words: ASK },
  { id: "t-arrow", label: "Marker", note: "The triangle that leads every mono eyebrow on the site", treatment: "arrow", words: ASK },
  { id: "t-framed", label: "Framed", note: "Inside a gold hairline. Reads as a button, which is more direct and more advert", treatment: "framed", words: ASK },
  { id: "t-stacked", label: "Stacked", note: "Ask and URL together under the word, bottom band dropped. One place to look instead of two", treatment: "stacked", words: ASK, ownUrl: true },
  { id: "t-badge", label: "Badge", note: "OPEN BETA as a square tag ahead of the ask. States what this is before what to do", treatment: "badge", words: ASK },
];

const WORDS: Variant[] = [
  { id: "w-start", label: "Start the build", note: "Plain imperative. Says what happens next without promising anything", treatment: "rule", words: "Start the build" },
  { id: "w-yours", label: "Build yours", note: "Shortest, and it echoes BUILD from two beats earlier", treatment: "rule", words: "Build yours" },
  { id: "w-turn", label: "Your turn.", note: "Turns the four verbs into the invitation, and closes with the same hollow period they do", treatment: "rule", words: "Your turn", dot: true },
  { id: "w-beta", label: "Join the beta", note: "Names the actual state of the thing. Accurate today, and it expires when the beta does", treatment: "rule", words: "Join the beta" },
  { id: "w-l101", label: "Take L1.01", note: "Names the lesson. Concrete, and it means nothing to someone who has not seen the catalogue", treatment: "rule", words: "Take L1.01" },
  { id: "w-first", label: "Build your first board", note: "The longest. Says the benefit rather than the action, and only just fits the column", treatment: "rule", words: "Build your first board" },
];

export default function CtaSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; EARN &middot; the ask
      </p>
      <h1 className="title-section mt-3">A call to action</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The last beat lands the word, shows the certificate, and prints a URL
        along the bottom in muted mono. That URL is a MARK, not an ask: it says
        where this lives, not what to do. The hex cut ends the same way, which
        was right for a product you can look at and wrong for a course someone
        has to enrol in.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The type is mono gold, larger and wider tracked than the URL. Bebas would
        compete with EARN directly above it, and the muted mono of the URL is
        deliberately recessive; this sits between the two. In the film the ask
        would land at 9.0, the half beat of the final bar, so it arrives behind
        the payoff rather than with it: reward, then request.
      </p>

      <section className="mt-12 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          TREATMENT &middot; same words throughout
        </p>
        <ul className="mt-5 border-t border-panel-border/60">
          {TREATMENTS.map((v) => (
            <li key={v.id} className="border-b border-panel-border/60 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4">
                <span className="title-card">{v.label}</span>
                <span className="font-serif text-sm text-muted">{v.note}</span>
              </div>
              <div className="mt-3">
                <CtaFrame variant={v} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          WORDING &middot; same treatment throughout
        </p>
        <ul className="mt-5 border-t border-panel-border/60">
          {WORDS.map((v) => (
            <li key={v.id} className="border-b border-panel-border/60 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4">
                <span className="title-card">{v.label}</span>
                <span className="font-serif text-sm text-muted">{v.note}</span>
              </div>
              <div className="mt-3">
                <CtaFrame variant={v} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-alert-red/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-alert-red">
          WHY NONE OF THESE SAY FREE
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          &ldquo;Start free&rdquo; would be the strongest line available and it
          is not ours to use yet. L1.01 being the only free lesson is an owner
          decision that is still PENDING the production tier flip, so a promo
          promising it would be making a claim the site does not currently
          honour. &ldquo;Open beta&rdquo; is true today. The moment the flip
          ships, the pricing line becomes the best CTA here and is worth
          revisiting.
        </p>
      </section>
    </main>
  );
}
