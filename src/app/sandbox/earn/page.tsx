// SANDBOX — EARN layout round. DEV ONLY.
import { notFound } from "next/navigation";
import { EarnLayouts, type Layout } from "./EarnLayouts";

// The type occupies the LEFT of the frame in most of these, so the card has to
// clear it. At the big size EARN's glyphs run from 7% to roughly 28% of the
// width, and the URL from 7% to roughly 39%, so a card starting left of about
// 44% will sit under the URL even when it looks clear of the word.
const LAYOUTS: Layout[] = [
  {
    id: "current",
    label: "As shipped",
    note: "What the cut does now, here for comparison. The card fills the frame and both EARN and the URL sit on cream. This is the one that does not work",
    cert: { w: 78, left: 11, top: 6 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "right-half",
    label: "Right half",
    note: "The card takes the right half, the type keeps the left. The simplest fix and probably the strongest",
    cert: { w: 49, left: 49, top: 14 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "right-small",
    label: "Right, smaller",
    note: "Same idea with more air. The card reads as an object in the frame rather than the frame itself",
    cert: { w: 42, left: 53, top: 22 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "lower-right",
    label: "Lower right",
    note: "Card dropped and pushed out. EARN gets the whole top-left quadrant to itself",
    // Pushed further right than it looks like it needs: dropping the card also
    // drops it INTO the URL's row, and at 46% its left edge measured 7% over
    // the link even though it cleared the word by a mile.
    cert: { w: 46, left: 52, top: 32 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "upper-right",
    label: "Upper right, type low",
    note: "Inverted: card up and right, both lines of type stacked along the bottom-left",
    cert: { w: 48, left: 49, top: 6 },
    earn: { cell: "c-bl" },
    url: { cell: "c-band" },
  },
  {
    id: "left-cert",
    label: "Mirrored",
    note: "Card on the left, type right-aligned on the right. Worth seeing because BUILD already lives on the right",
    cert: { w: 46, left: 4, top: 16 },
    earn: { cell: "c-tr", align: "right" },
    url: { cell: "c-br", align: "right" },
  },
  {
    id: "band",
    label: "Card up, band under",
    note: "Card centred and lifted, type in a band across the bottom on clean dark",
    cert: { w: 46, left: 27, top: 4 },
    earn: { cell: "c-bl" },
    url: { cell: "c-band" },
  },
  {
    id: "tilt",
    label: "Tilted",
    note: "Right-hand card with a six degree lean. Hints at the rotation the card still needs",
    // A rotated card needs MORE clearance than a square one: its axis-aligned
    // box grows with the lean, and at 47% that widened box measured 9% over the
    // link. Whatever rotation the card ends up with will cost margin like this.
    cert: { w: 44, left: 54, top: 20, rotate: -6 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "inset",
    label: "Small inset",
    note: "Card as a small artefact bottom-right, type dominant. The most confident reading",
    cert: { w: 34, left: 60, top: 44 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
  {
    id: "split",
    label: "Hard split",
    note: "Card flush to the right edge, type flush left. The most graphic, least filmic",
    cert: { w: 46, left: 52, top: 26 },
    earn: { cell: "c-tl" },
    url: { cell: "c-bl" },
  },
];

export default function EarnSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ EARN · where the card and the type go
      </p>
      <h1 className="title-section mt-3">Ten compositions</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        You are right that it does not work, and it is a composition problem
        rather than a type one. The cue layer is built for dark picture: gold
        accent, ivory title, and a black bloom instead of a scrim so the type
        sits ON the image. Every one of those is the wrong tool against a cream
        certificate, and the bloom especially turns to mud. Putting a scrim
        behind the words would fix the contrast and break the thing that makes
        the type look like ours.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        So the certificate stops filling the frame, exactly as you said it does
        not have to. Each of these gives the words their own dark field and lets
        the card have what is left. The type is the real cue stylesheet, not an
        approximation, so weight, stroke, leading and the hollow period are the
        shipped ones.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Watch the URL, not just the word. At this size it runs to about 39% of
        the width, so a card that clears EARN can still land on the link
      </p>

      <EarnLayouts layouts={LAYOUTS} />

      <section className="mt-12 border-t border-signal-blue/30 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">
          LOCKED FROM THIS ROUND
        </p>
        <p className="mt-3 max-w-3xl font-serif text-base text-text">
          Reverse at LEARN is <strong className="text-title">long</strong> and{" "}
          <strong className="text-title">gap</strong>, both kept: they are the
          same swell with and without an eighth of silence before the word, so
          they can stay a late decision rather than a blocking one. Picture is
          the hero lens, the constant rate, and the thousand millisecond
          cross-fade.
        </p>
      </section>
    </main>
  );
}
