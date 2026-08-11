// SANDBOX - CTA flash styles, and the watermark. DEV ONLY.
import { notFound } from "next/navigation";
import { FlashFrame, type Wm } from "./FlashFrame";
import { FLASHES } from "./flashes";

const WATERMARKS: { label: string; note: string; wm: Wm }[] = [
  { label: "Small", note: "Roughly what it was, but clear of the box", wm: { size: 0.24, opacity: 0.13, cell: "c-ml" } },
  { label: "Medium", note: "Reads as a mark rather than an icon", wm: { size: 0.36, opacity: 0.11, cell: "c-ml" } },
  { label: "Large", note: "Fills the band. Still quiet enough to be second-watch", wm: { size: 0.5, opacity: 0.09, cell: "c-ml" } },
  { label: "Field", note: "Big and very faint, more texture than logo", wm: { size: 0.72, opacity: 0.07, cell: "c-ml", nudgeY: -6 } },
  { label: "None", note: "In case the space reads better empty", wm: null },
];

export default function FlashSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE ASK &middot; eight ways to hit it
      </p>
      <h1 className="title-section mt-3">Flash</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The first attempt copied the hex tray literally: command-gold to
        gold-light, a squash, a faint wash. Rather than guess again, here is the
        range, from a hairline that barely lifts to the box inverting solid.
        These run live rather than scrubbed, because a flash is a few frames long
        and cannot be judged from a still. Both hits land on beats, at 9.0 and
        9.5, which are the first two available after the box settles.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The icon is in as a watermark, filling the empty row between the word and
        the ask. It is the brand mark used as a MASK over a gold token rather
        than dropped in as an image: the asset carries a hardcoded slate fill, so
        placing it directly would put an off-palette colour on the frame and it
        would not follow a theme. Sitting at 13 percent it should be the thing
        you notice on the second watch, which is what a watermark is for.
      </p>

      <ul className="mt-8 border-t border-panel-border/60">
        {FLASHES.map((f, i) => (
          <li key={f.id} className="border-b border-panel-border/60 py-6">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-numeral text-base tabular-nums text-command-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="title-card">{f.label}</span>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{f.note}</p>
            <div className="mt-3">
              <FlashFrame flash={f} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-14 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          THE WATERMARK &middot; size and placement
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          It was sharing a grid cell with the ask, so it landed on the box&rsquo;s
          top-left corner instead of the space above it. The grid only had cells
          for the top and bottom rows; there is a middle one now, which is the
          band that was actually empty. Flash held at Swell throughout so only
          the mark changes.
        </p>
        <ul className="mt-5 border-t border-panel-border/60">
          {WATERMARKS.map((w) => (
            <li key={w.label} className="border-b border-panel-border/60 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="title-card">{w.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
                  {w.wm ? `${Math.round(w.wm.size * 100)}% of short axis, ${w.wm.opacity} opacity` : "none"}
                </span>
                <span className="font-serif text-sm text-muted">{w.note}</span>
              </div>
              <div className="mt-3">
                <FlashFrame flash={FLASHES[6]} watermark={w.wm} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
