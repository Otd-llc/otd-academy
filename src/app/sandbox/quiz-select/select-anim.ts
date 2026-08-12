// SANDBOX - how a quiz answer LANDS. DEV ONLY (for now).
//
// THIS ONE IS NOT JUST FOR THE FILM. The pick is the most-repeated interaction
// in the Academy - 207 questions across 69 library lessons, plus every stage
// gate - and today it is a 0.3s scale pop with two 0.2s colour transitions
// underneath. That is why it reads as disjointed in the cut: nothing connects
// the pick to the verdict, so the fill, the label, the rule-outs and the
// "POWERED" line all just become true at once.
//
// SO EVERY CANDIDATE BELOW IS WRITTEN TO SHIP. Two constraints follow:
//
// 1. KEYFRAMES, NEVER TRANSITIONS. The film renders by seeking, and a CSS
//    transition has no seek - it lands wherever real time reached. The existing
//    rules transition `fill`, `stroke` and `color`, so each candidate turns
//    those off and drives the same properties from keyframes instead. That also
//    makes the product animation deterministic under test.
//
// 2. NOTHING NEW IN THE COMPONENT. Every rule here hangs off markup QuizBlock
//    already emits - `.qzh-opt[data-st]`, `.qzh-hex polygon`, `.qzh-hex b`, and
//    the option's own box for a pseudo-element. Nothing below needs a prop, a
//    ref or a state field, so shipping it is a globals.css change.
//
// TO SHIP ONE: drop the `[data-qsel="<id>"] ` prefix from its rules and paste
// into the QuizBlock section of globals.css, replacing the current qzh-pop /
// qzh-nudge block. The `@media (prefers-reduced-motion)` guard at the bottom of
// that section already covers everything here, because it kills `animation` on
// `.qzh-opt`, `.qzh-hex`, `.qzh-hex polygon` and `.qzh-hex b` by name.
//
// THE HOUSE METAPHOR IS A WIRED NET. `.qzh-opts::before` draws a 2px vertical
// bus down the left of the options and each hex is a node hanging off it. Half
// the candidates use that, because an answer landing is a node being energised
// and the wire is already drawn - it is the one piece of this design that is
// asking to be animated and never has been.
//
// ASCII only.

/**
 * THE TIMING LIVES IN THE PLAIN MODULE, not in the client one.
 *
 * These were exported from `SelectStage.tsx`, which carries "use client", and
 * read by the server page. Across that boundary a client module's exports are
 * CLIENT REFERENCES rather than values: `CLICK` arrived as a proxy and
 * `CLICK.toFixed is not a function` threw during hydration, which unmounted the
 * whole subtree - so the page server-rendered correctly, then emptied itself.
 * Same family as this repo's rule that a "use server" file may only export async
 * functions: what crosses a directive boundary is not what you wrote.
 */
/** The loop. Long enough to see the answer land and then read the row it left. */
export const CYCLE = 3.4;
/** When the pick happens, so a frozen frame can be described in seconds after it. */
export const CLICK = 0.7;

export type SelectAnim = {
  id: string;
  label: string;
  /** What it does, and what it costs. */
  note: string;
  /** Seconds, for the bench label and for the freeze slider's range. */
  dur: number;
  css: string;
};

/** Shared by every candidate: the transitions the base sheet declares are
 *  turned off so the keyframes own the properties outright. Without this the
 *  transition and the animation fight and the seek is a lie. */
const NOTRANS = `
%S% .qzh-opt,
%S% .qzh-hex polygon,
%S% .qzh-hex b{transition:none}
`;

const wrap = (id: string, body: string) => (NOTRANS + body).replace(/%S%/g, `[data-qsel="${id}"]`);

export const SELECTS: SelectAnim[] = [
  {
    id: "current",
    label: "00 / what ships today",
    note:
      "The baseline, reproduced exactly: a 0.3s scale pop on the hex and 0.2s transitions on the fill, the stroke and the label colour. Nothing links the node to the wire it hangs on, and the verdict line simply exists on the next frame. On the page it passes; in a cut at 2x it is the disjointed moment.",
    dur: 0.3,
    css: wrap(
      "current",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex{animation:qs-pop .3s ease both}
@keyframes qs-pop{0%{transform:scale(1)}45%{transform:scale(1.07)}100%{transform:scale(1)}}
`,
    ),
  },
  {
    id: "energise",
    label: "01 / energise the wire",
    note:
      "A gold segment runs down the bus into the chosen node, and the hex only fills once it arrives. The option already has `position:relative` and the bus already sits at left 13px, so the segment is one pseudo-element on the option itself - no component change, and it lights exactly the row that was picked rather than the whole net. The strongest fit for the design language: the answer is a circuit closing.",
    dur: 0.62,
    css: wrap(
      "energise",
      `
%S% .qzh-opt[data-st="ok"]::after{content:"";position:absolute;left:13px;top:0;bottom:0;
  width:2px;background:var(--color-gold-light);transform-origin:top;
  box-shadow:0 0 8px var(--color-command-gold);
  animation:qs-wire .26s cubic-bezier(.4,0,.2,1) both}
@keyframes qs-wire{from{transform:scaleY(0);opacity:1}
  60%{transform:scaleY(1);opacity:1}to{transform:scaleY(1);opacity:0}}
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  animation:qs-fill .34s cubic-bezier(.2,.9,.3,1) both .24s}
@keyframes qs-fill{from{fill-opacity:0;stroke:var(--color-panel-border);transform:scale(.9)}
  to{fill-opacity:1;stroke:var(--color-command-gold);transform:scale(1)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex{transform-box:fill-box;transform-origin:center;
  animation:qs-node .3s cubic-bezier(.2,1.5,.4,1) both .24s}
@keyframes qs-node{0%{transform:scale(.86)}55%{transform:scale(1.1)}100%{transform:scale(1)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink .2s linear both .3s}
@keyframes qs-ink{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit .3s linear both .3s}
@keyframes qs-lit{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
`,
    ),
  },
  {
    id: "pour",
    label: "02 / pour the fill",
    note:
      "The honey does not appear, it rises inside the hexagon from the bottom, the way a cell fills. Done with a clip on the polygon rather than opacity, so the gold has a moving edge and the node reads as being charged rather than switched. Quietest of the set and the one that survives being seen two hundred times.",
    dur: 0.5,
    css: wrap(
      "pour",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  stroke:var(--color-command-gold);
  animation:qs-pour .42s cubic-bezier(.35,.85,.3,1) both}
@keyframes qs-pour{
  from{clip-path:inset(100% 0 0 0);stroke:var(--color-panel-border)}
  35%{stroke:var(--color-command-gold)}
  to{clip-path:inset(0 0 0 0);stroke:var(--color-command-gold)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink2 .18s linear both .26s}
@keyframes qs-ink2{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit2 .34s linear both .16s}
@keyframes qs-lit2{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
`,
    ),
  },
  {
    id: "sweep",
    label: "03 / sweep the row",
    note:
      "A gold wash crosses the whole option left to right - hex first, then the label brightening behind it. The one candidate that treats the row as a single object rather than a node with a caption, which is the thing that makes the label feel attached to the answer instead of merely near it.",
    dur: 0.55,
    css: wrap(
      "sweep",
      `
%S% .qzh-opt[data-st="ok"]{
  animation:qs-lit3 .46s cubic-bezier(.3,.85,.3,1) both}
@keyframes qs-lit3{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
%S% .qzh-opt[data-st="ok"]::after{content:"";position:absolute;inset:-2px -6px;
  pointer-events:none;
  background:linear-gradient(100deg,transparent 0%,
    color-mix(in srgb,var(--color-command-gold) 26%,transparent) 45%,transparent 70%);
  animation:qs-sweep .5s cubic-bezier(.4,0,.25,1) both}
@keyframes qs-sweep{from{transform:translateX(-58%);opacity:0}
  22%{opacity:1}80%{opacity:1}to{transform:translateX(58%);opacity:0}}
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  animation:qs-fill2 .3s ease-out both .06s}
@keyframes qs-fill2{from{fill-opacity:0;stroke:var(--color-panel-border)}
  to{fill-opacity:1;stroke:var(--color-command-gold)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink3 .18s linear both .16s}
@keyframes qs-ink3{from{color:var(--color-gold-dim)}to{color:#140d02}}
`,
    ),
  },
  {
    id: "latch",
    label: "04 / latch",
    note:
      "The hex tips a few degrees and snaps flat as it fills, like a switch throwing. Mechanical rather than electrical, which suits an aviation ladder and fights the wired-net drawing it sits on - on the page to make that argument visible. The rotation is small on purpose: a hexagon rotating far enough to notice stops reading as a hexagon.",
    dur: 0.46,
    css: wrap(
      "latch",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex{
  animation:qs-latch .38s cubic-bezier(.3,1.3,.4,1) both}
@keyframes qs-latch{0%{transform:rotate(-9deg) scale(.92)}
  58%{transform:rotate(4deg) scale(1.06)}
  100%{transform:rotate(0) scale(1)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  animation:qs-fill3 .16s linear both .14s}
@keyframes qs-fill3{from{fill-opacity:0;stroke:var(--color-panel-border)}
  to{fill-opacity:1;stroke:var(--color-command-gold)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink4 .12s linear both .18s}
@keyframes qs-ink4{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit4 .3s linear both .12s}
@keyframes qs-lit4{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
`,
    ),
  },
  {
    id: "others",
    label: "05 / the others stand down  [PICKED]",
    note:
      "The picked node barely moves. What animates is everything ELSE - the remaining options fade back in sequence, top to bottom, like a rack powering down. Defines the answer by contrast rather than by emphasis, and it is the only candidate that does something about the two rows nobody chose. Needs the dim state, so it only reads once the question is solved.",
    dur: 0.66,
    css: wrap(
      "others",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  animation:qs-fill4 .2s ease-out both}
@keyframes qs-fill4{from{fill-opacity:0;stroke:var(--color-panel-border)}
  to{fill-opacity:1;stroke:var(--color-command-gold)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink5 .14s linear both .1s}
@keyframes qs-ink5{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit5 .26s linear both}
@keyframes qs-lit5{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
%S% .qzh-opt[data-st="dim"]{animation:qs-stand .34s ease-out both}
%S% .qzh-opt[data-st="dim"]:nth-of-type(2){animation-delay:.1s}
%S% .qzh-opt[data-st="dim"]:nth-of-type(3){animation-delay:.2s}
%S% .qzh-opt[data-st="dim"]:nth-of-type(4){animation-delay:.3s}
@keyframes qs-stand{from{opacity:1;transform:translateX(0)}
  to{opacity:.45;transform:translateX(-4px)}}
`,
    ),
  },
  {
    id: "charge",
    label: "06 / charge",
    note:
      "Two small pulses that do not land, then a third that does, with the fill arriving on the hit. Anticipation is the only thing in this set that makes the answer feel EARNED rather than merely registered - and the cost is the longest window of the seven, which on a page where someone is answering three questions in a row may be three quarters of a second too many.",
    dur: 0.8,
    css: wrap(
      "charge",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex{animation:qs-charge .7s linear both}
@keyframes qs-charge{0%{transform:scale(1)}
  10%{transform:scale(1.05)}18%{transform:scale(1)}
  30%{transform:scale(1.08)}40%{transform:scale(.98)}
  55%{transform:scale(1.2)}72%{transform:scale(.98)}
  86%{transform:scale(1.03)}100%{transform:scale(1)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  animation:qs-fill5 .14s linear both .38s}
@keyframes qs-fill5{from{fill-opacity:0;stroke:var(--color-panel-border)}
  to{fill-opacity:1;stroke:var(--color-command-gold)}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink6 .12s linear both .4s}
@keyframes qs-ink6{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit6 .24s linear both .4s}
@keyframes qs-lit6{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
`,
    ),
  },
  {
    id: "bloom",
    label: "07 / bloom",
    note:
      "The node fills instantly and a hex-shaped ring expands out of it and dissipates - the ripple a real switch makes. Reads loudest of the seven at the smallest size, which is the argument for it in a feed and against it in a lesson where three of these fire in a row.",
    dur: 0.6,
    css: wrap(
      "bloom",
      `
%S% .qzh-opt[data-st="ok"] .qzh-hex::after{content:"";position:absolute;inset:0;
  border:2px solid var(--color-gold-light);
  clip-path:polygon(50% 3%,96% 25%,96% 75%,50% 97%,4% 75%,4% 25%);
  animation:qs-bloom .52s cubic-bezier(.2,.7,.3,1) both}
@keyframes qs-bloom{from{transform:scale(1);opacity:.9}
  to{transform:scale(2.4);opacity:0}}
%S% .qzh-opt[data-st="ok"] .qzh-hex polygon{fill:url(#quiz-honey);
  stroke:var(--color-command-gold);
  animation:qs-fill6 .12s linear both}
@keyframes qs-fill6{from{fill-opacity:0}to{fill-opacity:1}}
%S% .qzh-opt[data-st="ok"] .qzh-hex b{animation:qs-ink7 .1s linear both}
@keyframes qs-ink7{from{color:var(--color-gold-dim)}to{color:#140d02}}
%S% .qzh-opt[data-st="ok"]{animation:qs-lit7 .28s linear both}
@keyframes qs-lit7{from{color:var(--color-muted)}to{color:var(--color-gold-light)}}
`,
    ),
  },
];

export const selectById = (id?: string) => SELECTS.find((s) => s.id === id) ?? SELECTS[0];

// ---------------------------------------------------------------------------
// HOW THE VERDICT ARRIVES
//
// Picked, 2026-08-12: the SELECTION is `others` - the chosen node barely moves
// and what animates is the two rows nobody picked, standing down in sequence.
// That leaves the second half of the moment open, and it is the half that was
// never animated at all: "POWERED - LOCKED IN." plus the explanation simply
// exist on the next frame.
//
// It matters more than it looks. The explanation is the TEACHING - it is the
// only place in the interaction where the learner is told why they were right -
// and today it arrives with no more ceremony than a layout shift. It also
// arrives at the exact moment three other things are happening, which is why
// the whole beat reads as mush.
//
// THE MARKUP IS ALREADY THERE and needs nothing new: QuizBlock renders
//   <div role="status"><div class="mt-3 space-y-1"><p>powered</p><p>why</p></div></div>
// inside the fieldset, and it mounts on the solve. Every rule below hangs off
// that, so shipping one is the same globals.css paste as the selection.
//
// ONE TRAP, PAID FOR: the block MOUNTS when the question is solved, so a
// height animation moves the "1 / 1 correct" footer under it. Anything that
// animates height has to be judged for that, not just for how it reads - which
// is why `unfold` is on the page rather than assumed to be fine.

export type VerdictAnim = SelectAnim;

const wrapV = (id: string, body: string) =>
  body.replace(/%S%/g, `[data-qver="${id}"]`);

/** The two lines, addressed without touching the component. */
const LINE = `%S% [role="status"] > div > p:first-child`;
const WHY = `%S% [role="status"] > div > p:last-child`;

export const VERDICTS: VerdictAnim[] = [
  {
    id: "none",
    label: "00 / what ships today",
    note:
      "It is simply there on the next frame, at the same instant as the fill, the label and the rule-outs. Four things becoming true at once is the definition of the mush this round exists to fix.",
    dur: 0,
    css: wrapV("none", ``),
  },
  {
    id: "quiet",
    label: "01 / quiet",
    note:
      "A 0.3s fade on the whole block, starting a beat after the pick so it is second rather than simultaneous. The control: if nothing below beats a plain fade that merely waits its turn, the answer was ordering all along, not animation.",
    dur: 0.5,
    css: wrapV(
      "quiet",
      `
%S% [role="status"] > div{animation:qv-fade .3s ease-out both .2s}
@keyframes qv-fade{from{opacity:0}to{opacity:1}}
`,
    ),
  },
  {
    id: "stagger",
    label: "02 / verdict, then reason",
    note:
      "The two lines are two different things - a state and a lesson - so they arrive as two events, the mono verdict first and the explanation a beat behind it. The one that most respects that the second line is the teaching.",
    dur: 0.72,
    css: wrapV(
      "stagger",
      `
${LINE}{animation:qv-rise .26s cubic-bezier(.2,.9,.3,1) both .16s}
${WHY}{animation:qv-rise .32s cubic-bezier(.2,.9,.3,1) both .38s}
@keyframes qv-rise{from{opacity:0;transform:translateY(6px)}
  to{opacity:1;transform:none}}
`,
    ),
  },
  {
    id: "typeon",
    label: "03 / type it on  [PICKED]",
    note:
      "The mono line wipes on left to right under a hard-edged mask, the way a readout prints, and the explanation fades under it. Mono type is the one face in this system that can be revealed a character at a time without looking like a gimmick, because it is already monospaced.",
    dur: 0.78,
    css: wrapV(
      "typeon",
      `
/* CLIP-PATH, NOT A MASK GRADIENT. The first version animated the stops of a
   linear-gradient mask and rendered nothing for the whole run: two gradients
   are not reliably interpolated stop-for-stop, so it held the from-value and
   then snapped. clip-path inset() is a length and interpolates properly - and
   it is what gives the reveal a hard edge, which is the point of a readout
   printing rather than fading. */
${LINE}{animation:qv-type .42s steps(22,end) both .14s}
@keyframes qv-type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
${WHY}{animation:qv-fade2 .3s ease-out both .5s}
@keyframes qv-fade2{from{opacity:0}to{opacity:1}}
`,
    ),
  },
  {
    id: "glyph",
    label: "04 / the glyph leads",
    note:
      "The hex glyph that opens the line is the same shape as the node that just filled, so it lands first and at scale, and the words track out from behind it. The only candidate that ties the verdict to the thing it is a verdict ON.",
    dur: 0.8,
    css: wrapV(
      "glyph",
      `
${LINE}{position:relative;animation:qv-track .38s cubic-bezier(.2,.9,.3,1) both .26s}
@keyframes qv-track{from{opacity:0;letter-spacing:.5em}
  to{opacity:1;letter-spacing:.18em}}
${LINE}::before{content:"";position:absolute;left:-2px;top:50%;width:11px;height:12px;
  margin-top:-6px;background:var(--color-command-gold);
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);
  animation:qv-glyph .3s cubic-bezier(.2,1.5,.4,1) both}
@keyframes qv-glyph{from{opacity:0;transform:scale(.3)}
  60%{opacity:1;transform:scale(1.25)}to{opacity:1;transform:scale(1)}}
${WHY}{animation:qv-fade3 .3s ease-out both .46s}
@keyframes qv-fade3{from{opacity:0}to{opacity:1}}
`,
    ),
  },
  {
    id: "unfold",
    label: "05 / unfold",
    note:
      "The block grows from zero height, so the row physically opens to make room for it. The most satisfying of the six and the only one that MOVES THE PAGE - the correct counter below shifts down as it opens, which on a three-question card happens three times. On the page to be judged for that, not just for how it reads.",
    dur: 0.66,
    css: wrapV(
      "unfold",
      `
%S% [role="status"] > div{overflow:hidden;
  animation:qv-unfold .4s cubic-bezier(.25,.9,.3,1) both .12s}
@keyframes qv-unfold{from{opacity:0;max-height:0;transform:translateY(-4px)}
  to{opacity:1;max-height:9rem;transform:none}}
`,
    ),
  },
  {
    id: "wire",
    label: "06 / down the wire",
    note:
      "A gold rule draws left to right under the option row and the verdict rises behind it, so the line reads as the bus carrying the result on rather than as text appearing. Matches the wired-net drawing the options already sit on, which is the argument for it over the plain fade.",
    dur: 0.74,
    css: wrapV(
      "wire",
      `
%S% [role="status"] > div{position:relative;
  animation:qv-rise2 .3s cubic-bezier(.2,.9,.3,1) both .22s}
@keyframes qv-rise2{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
%S% [role="status"] > div::before{content:"";position:absolute;left:0;right:0;top:-6px;
  height:1px;background:linear-gradient(90deg,var(--color-command-gold),
    color-mix(in srgb,var(--color-command-gold) 0%,transparent));
  transform-origin:left;
  animation:qv-rule .34s cubic-bezier(.4,0,.2,1) both}
@keyframes qv-rule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
`,
    ),
  },
];

export const verdictById = (id?: string) => VERDICTS.find((v) => v.id === id) ?? VERDICTS[0];

/**
 * SETTLED, 2026-08-12, and this is what ships.
 *
 *   selection  `others`  - the chosen node barely moves; what animates is the
 *                          two rows nobody picked, standing down in sequence.
 *                          The answer is defined by contrast rather than by
 *                          emphasis, and it is the only candidate that does
 *                          anything about the rows nobody chose.
 *   verdict    `typeon`  - the mono line prints on left to right behind a hard
 *                          clip edge, the way a readout does, and the
 *                          explanation fades in under it once it has finished.
 *                          Mono is the one face in this system that can be
 *                          revealed a character at a time without reading as a
 *                          gimmick, because it is already monospaced.
 *
 * TO SHIP: concatenate `PICKED_CSS`, strip the `[data-qsel="others"] ` and
 * `[data-qver="typeon"] ` prefixes, and paste into the QuizBlock section of
 * globals.css in place of the current qzh-pop / qzh-nudge block. The
 * reduced-motion guard already at the end of that section covers all of it, and
 * nothing in the component changes.
 */
export const PICKED_SELECT = "others";
export const PICKED_VERDICT = "typeon";
export const PICKED_CSS = () =>
  `${selectById(PICKED_SELECT).css}\n${verdictById(PICKED_VERDICT).css}`;
