// The kinetic cue layer, PORTED from tools/hex-promo-cuts.mjs.
//
// Copied, not reinterpreted. The hex spec was judged in a preview and then
// rendered; reconstructing the rules from the same intent is how you ship
// something adjacent to what was signed off. Every value below is the hex one:
// the 5x5 grid with 7% side gutters, the corner cells, the per-cue animations,
// the 0.04em stroke, the 0.84 leading, the black bloom that lets type sit over
// picture without a scrim, and the hollow period whose stroke INVERTS against
// its word.
//
// WHAT CHANGED, and only this:
//   - the four words, DESIGN / BUILD / LEARN / EARN
//   - the URL, /beta instead of /hex
//   - the icon: hex's actuated download arrow is a hex-release thing. The
//     academy's equivalent mark is the certificate seal, so the last cue
//     carries the wordmark instead of a download glyph.
//
// TIMING IS THE HEX TIMING: 10 s, five bars at 120 BPM, cues on the downbeats
// at 2.0 / 4.0 / 6.0 / 8.0, each 1.9 s so it nearly fills its bar and clears
// before the next. SNAP's 0.3 s lead is kept on BUILD, because the two halves
// have to MEET on the beat rather than arrive after it.

export type Cue = {
  /** Bar downbeat, seconds. */
  t: number;
  /** How long it holds. 1.9 nearly fills a 2 s bar. */
  d: number;
  /** Start early so the motion LANDS on the beat instead of starting on it. */
  lead?: number;
  cell: "c-tl" | "c-tr" | "c-bl" | "c-br" | "c-band" | "c-ml" | "c-mr";
  anim: "p2" | "s1" | "an-mask" | "f1" | "mark";
  word?: string;
  html?: string;
  align?: "right" | "centre";
  big?: 1;
  /** GROW's sustained scale target. */
  hold?: number;
  /**
   * EARN-BEAT ONLY. Its three elements have to relate to the CERTIFICATE, and
   * the certificate moves with the aspect, so the five-cell grid cannot place
   * them: a cell is a fixed fraction of the frame and the card is not. These
   * three name a slot instead, and PLACEMENT below resolves it per format.
   *
   * The first three cues keep their cells. DESIGN, BUILD and LEARN sit over
   * spinning geometry that recentres itself for whatever aspect it is given, so
   * a grid corner is exactly right for them and nothing has to move.
   */
  slot?: Slot;
};

export type Slot = "word" | "ask" | "link";
export type Format = "wide" | "vertical" | "square" | "portrait" | "band";
/** left/top are percentages of WIDTH and HEIGHT of the frame. */
export type Place = { left: number; top: number; align?: "left" | "centre" | "right" };

/** The hollow period. Its stroke colour inverts against the word it closes. */
export const D = "<span class='tdot'>.</span>";

export const CUES: Cue[] = [
  // Bar 1 establishes with no type, exactly as the hex cut does: two seconds of
  // picture before the first word, so the scene reads before it is labelled.
  { t: 2.0, d: 1.9, cell: "c-tl", anim: "p2", word: "DESIGN" + D },
  { t: 4.0, d: 1.9, lead: 0.3, cell: "c-br", anim: "s1", word: "BUILD" + D, align: "right" },
  // d 1.5, not 1.9. LEARN sits in c-tr and EARN in c-tl, which SHARE the middle
  // column and the same row, so unlike the other pairs they cannot both be on
  // screen. At 1.9 they were: LEARN's 0.28 s fade-out ran to 8.18 while EARN's
  // 0.18 s fade-in began at 7.82, putting both words up for 0.36 s across 29% of
  // the width. 1.5 closes LEARN at 7.78, just clear of EARN's entry.
  //
  // The other overlaps are left alone deliberately. DESIGN and BUILD share the
  // screen for 0.66 s and LEARN and BUILD for 0.36, but those are opposite
  // corners: that reads as a handoff and is how the hex cut ships.
  // lead 0.5, which LEARN never had. `cMaskUp` runs 0.5 s, so with no lead the
  // word STARTS on the beat and finishes half a second after it -- while the
  // reversed crash placed by its end on 6.0 has already resolved. BUILD carries
  // a lead for exactly this reason and LEARN was the odd one out. 0.5 makes the
  // reveal COMPLETE on the beat instead of beginning there.
  { t: 6.0, d: 1.5, lead: 0.5, cell: "c-tr", anim: "an-mask", word: "LEARN" + D, align: "right", hold: 1.34 },
  { t: 8.0, d: 1.9, cell: "c-tl", slot: "word", anim: "f1", word: `<span class='accent'>EARN${D}</span>`, big: 1 },
  // LAYOUT 08, and the mark is GONE. Owner call, 2026-08-11: of the five sizes
  // tried above the word, none beat having nothing there.
  //
  // The link was on c-band, centred: bottom-aligned and full width. That put it
  // 25.5 points right of everything above it, the only centred element under a
  // flush-left stack. It is now the bottom member of the column, flush with the
  // rest.
  {
    t: 8.0,
    d: 1.9,
    cell: "c-band",
    slot: "link",
    anim: "mark",
    html: `<div class="mark"><div class="mark-url">academy.onethousanddrones.com/beta</div></div>`,
  },
  // THE ASK, half a beat behind the payoff.
  //
  // It went 9.0 -> 8.5 -> 8.25, and the cue time was only half the story: with
  // the .66s cRelease it inherited, the box was not fully present until 9.16
  // even when its cue said 8.5. The entrance is .34s now (see cCta), so at 8.25
  // it is settled by 8.59 -- more than half a second earlier than before, while
  // still arriving after EARN rather than with it.
  //
  // Any earlier and it collides with EARN's own entrance, which runs 8.0 to
  // 8.66: the two would animate together and the payoff would lose.
  //
  // d 1.4 so it holds to the end of the cut rather than clearing before it. The
  // URL does the same; the last thing on screen should be the address and the
  // ask, not the certificate on its own.
  //
  // The framed treatment reads as a button, and a button wants an IMPERATIVE.
  // "Your turn." works bare and reads oddly inside a box, which is a case of
  // the treatment choosing the wording rather than the other way round.
  {
    t: 8.25,
    d: 1.65,
    cell: "c-bl",
    slot: "ask",
    anim: "mark",
    html: `<span class="cta-box">Start the build</span>`,
  },
];

/** Type sizes as ratios of the SHORT AXIS. Never the width: scaling by width is
 *  right for portrait and square and wrong for 16:9 by 1.78x. */
// `big` is EARN's size and only EARN's. Layout G raised it by a fifth, because
// with the certificate no longer filling the frame the word has to hold the
// left on its own rather than float in it.
//
// The FURTHER 1.34 that layout 08 adds is NOT folded in here. It is a per-format
// multiplier in earn-place, because it only applies where the word has a narrow
// left column to hold: on the three aspects at or below square the word spans
// the whole width already, and at 1.34 there was nothing left for the card.
export const TEXT_SCALE = { word: 52 / 460, big: 79 / 460, url: 11 / 460 };

export function cueCss(
  size: { word: number; big: number; url: number },
  safe: number,
  /**
   * The EARN beat's three slots, resolved for this frame's aspect. Omit and
   * they fall back to their grid cells, which is what the sandboxes that only
   * ever render 16:9 want.
   */
  placed?: { word: Place; ask: Place; link: Place },
): string {
  // Absolute, so they leave the grid entirely. A grid cell is a fixed fraction
  // of the frame and the certificate is not, so on any aspect but the one it
  // was designed at, a cell and the card drift apart.
  const slots = placed
    ? `
#cuelayer .slot{position:absolute;align-self:auto}
#cuelayer .s-word{left:${placed.word.left}%;top:${placed.word.top}%}
#cuelayer .s-ask{left:${placed.ask.left}%;top:${placed.ask.top}%}
#cuelayer .s-link{left:${placed.link.left}%;top:${placed.link.top}%}
`
    : "";
  return (
    slots +
    `
/* line-height:normal IS LOAD BEARING, not tidiness. The capture page wraps the
   stage in a lineHeight:0 box to kill the inline-block descender gap, and that
   inherits all the way down. The ask is padding plus a line box, so at
   line-height 0 it rendered 51.6px tall where the sandbox it was judged in
   rendered 114.5px, and the link's box collapsed to zero height. The film and
   the round the owner picked from were not showing the same thing.

   Declaring it here rather than fixing the wrapper is deliberate: the cue layer
   is dropped into several hosts, and it should not inherit typography from any
   of them. .k-word overrides this with its own .84 and is unaffected. */
#cuelayer{position:absolute;inset:0;z-index:50;pointer-events:none;display:grid;
  line-height:normal;
  grid-template-columns:7% 1fr 1fr 1fr 7%;grid-template-rows:${safe}% 1fr 1fr 1fr ${safe}%;
  --command-gold:#c8963e;--gold-light:#e8b865;--title:#f1ece0;--muted:#aaa}
#cuelayer .cue{opacity:0;align-self:center;min-width:0}
#cuelayer .c-tl{grid-area:2/2/3/4} #cuelayer .c-tr{grid-area:2/3/3/5}
#cuelayer .c-bl{grid-area:4/2/5/4} #cuelayer .c-br{grid-area:4/3/5/5}
#cuelayer .c-band{grid-area:4/2/5/5;align-self:end}
/* ROW 3, the middle band. The grid had cells for the top and bottom rows only,
   so anything placed between the word and the ask had to borrow c-bl and
   collided with whatever was already there. */
#cuelayer .c-ml{grid-area:3/2/4/4} #cuelayer .c-mr{grid-area:3/3/4/5}
#cuelayer .right{text-align:right} #cuelayer .centre{text-align:center}
#cuelayer .k-grow{display:inline-block} #cuelayer .k-mask{display:block}
#cuelayer .an-mask .k-mask{overflow:hidden}
#cuelayer .k-word{font-family:'Bebas Neue',sans-serif;font-weight:400;line-height:.84;
  letter-spacing:-.01em;color:var(--title);-webkit-text-stroke:.04em currentColor;
  paint-order:stroke fill;text-shadow:0 2px 26px rgba(0,0,0,.8);font-size:${size.word}px}
#cuelayer .big .k-word{font-size:${size.big}px}
#cuelayer .k-word .accent{color:var(--command-gold)}
#cuelayer .tdot{-webkit-text-fill-color:transparent;-webkit-text-stroke-width:.05em;text-shadow:none}
#cuelayer .k-word .tdot{-webkit-text-stroke-color:var(--command-gold)}
#cuelayer .k-word .accent .tdot{-webkit-text-stroke-color:var(--title)}
#cuelayer .p2 .ch{opacity:0;display:inline-block}
#cuelayer .cue.held.p2 .ch{animation:cKeyStrike .13s cubic-bezier(.3,1.5,.5,1) both}
@keyframes cKeyStrike{from{opacity:0;transform:translateY(-28%) scaleY(1.25)}to{opacity:1;transform:none}}
#cuelayer .s1 .half{position:absolute;inset:0;display:block}
#cuelayer .s1 .half.l{clip-path:inset(0 50% 0 0)} #cuelayer .s1 .half.r{clip-path:inset(0 0 0 50%)}
#cuelayer .s1 .k-word{position:relative}
#cuelayer .cue.held.s1 .half.l{animation:cSnapL .42s cubic-bezier(.16,.9,.24,1) both}
#cuelayer .cue.held.s1 .half.r{animation:cSnapR .42s cubic-bezier(.16,.9,.24,1) both}
@keyframes cSnapL{from{transform:translateX(-42%);opacity:0}to{transform:none;opacity:1}}
@keyframes cSnapR{from{transform:translateX(42%);opacity:0}to{transform:none;opacity:1}}
#cuelayer .cue.held.an-mask .k-word{animation:cMaskUp .5s cubic-bezier(.16,.84,.28,1) both}
@keyframes cMaskUp{from{transform:translateY(105%)}to{transform:none}}
#cuelayer .cue.held[data-hold] .k-grow{animation:cGrow var(--hold) cubic-bezier(.22,.7,.3,1) both}
@keyframes cGrow{from{transform:scale(1)}to{transform:scale(var(--growTo))}}
#cuelayer .cue.held.f1 .k-word{animation:cRelease .66s cubic-bezier(.16,1.1,.3,1) both}
@keyframes cRelease{from{opacity:0;transform:translateY(14%) scale(.86)}to{opacity:1;transform:none}}
/* The framed CTA. Mono gold, larger and wider tracked than the URL: Bebas
   would compete with EARN directly above it, and the URL's muted mono is
   deliberately recessive, so this sits between the two. The frame is a gold
   hairline on nothing, never a fill. */
#cuelayer .cta-box{display:inline-block;border:1px solid var(--command-gold);
  border-radius:2px;padding:.62em 1.15em;font-family:'Space Mono',monospace;
  text-transform:uppercase;letter-spacing:.22em;color:var(--command-gold);
  font-size:${Math.round(size.url * 1.55)}px;text-shadow:0 2px 18px rgba(0,0,0,.9)}
/* .mark, not .cta: the class on the element comes from the cue's anim field,
   and this cue uses the mark animation. A selector naming a class nothing
   emits silently never fires, and the box would simply pop in.
   NOTE: no backticks anywhere in this string. It is a template literal, so a
   backtick in a CSS comment terminates it and the file stops parsing.

   ITS OWN, FASTER ENTRANCE. Borrowing cRelease at .66s meant the box began
   appearing on its cue and was not settled for two thirds of a second after
   it, so an ask placed one beat behind EARN actually READ as two and a bit.
   .34s and a shorter travel: it arrives rather than drifts in.

   THEN IT FLASHES, the way the hex download tray does. That one strikes
   command-gold to gold-light and squashes scaleY(.72) as the arrow lands, and
   repeats: a colour hit plus an impact, never a glow. Same idea on a border.

   ONE KEYFRAME SET, not an entrance plus a separate flash. Two animations both
   writing the transform property fight over it, and the later one wins even
   while the earlier is still filling, so the entrance would be overridden from
   frame zero. Folding both into one timeline also keeps it scrubbable, which
   two overlapping fills would not reliably be.

   THE FLASHES SIT ON BEATS. The cue starts at 8.25 and the box is settled by
   8.59, so the first beat available to hit is 9.0, then 9.5. Over a 1.75s
   timeline those are 42.9% and 71.4%. */
/* SWELL, picked 2026-08-11 out of eight. The first attempt copied the hex tray
   literally -- command-gold to gold-light, a squash, a faint wash -- and was
   rejected. Swell is the quietest of the eight: a scale pulse and NOTHING else,
   no colour change at all, which is the one that survives being seen twenty
   times in a feed.
   Colour is therefore absent from these keyframes on purpose. Reintroducing a
   border-color or background hit here is not a tweak, it is a different pick. */
@keyframes cCta{
  /* Per-keyframe easing. A single bouncy curve across the whole timeline would
     apply its overshoot to the pulses too, smearing a hit that should be
     instant. The bounce belongs to the entrance only. */
  0%{opacity:0;transform:translateY(8%) scale(.94);
     animation-timing-function:cubic-bezier(.18,1.05,.32,1)}
  19%{opacity:1;transform:none}
  40%{transform:none}
  45%{transform:scale(1.035)}
  54%{transform:none}
  69%{transform:none}
  74%{transform:scale(1.035)}
  83%{transform:none}
  100%{opacity:1;transform:none}}
#cuelayer .cue.held.mark .cta-box{animation:cCta 1.75s linear both}
#cuelayer .mark-url{font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted);text-shadow:0 2px 18px rgba(0,0,0,.9)}
#cuelayer .cue.held.mark .mark-url{animation:cRelease .66s cubic-bezier(.16,1.1,.3,1) both}
`
  );
}
