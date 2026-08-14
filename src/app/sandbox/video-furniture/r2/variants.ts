// Round 2. Ten treatments per piece, on the branches round 1 chose.
//
// WHAT ROUND 1 GOT WRONG, per the otd-frontend-design skill, and what this
// round fixes everywhere:
//   - `#fff` / `--color-white` for type. Banned: a literal colour cannot flip
//     under `[data-theme="light"]`. Everything here is `--color-title` /
//     `--color-text` / `--color-muted`.
//   - No Saira anywhere. The numeral face is the signature readout and a stage
//     number is exactly that; round 1 set numbers in mono.
//   - A hand-rolled clip-path hex. The honeycomb is the brand signature and it
//     already exists as `.gh-*` / `.phex-*` plus real components; reinventing it
//     is explicitly called out as a don't.
//   - No theme toggle. Every sandbox carries one, because a variant that sings
//     on deep-space can die on ivory.
//   - Option ids belonged ABOVE each frame, not in a caption under it.
//
// ASCII only.

export type Variant = { id: string; name: string; claim: string };

/** INTRO / NAME THE PARTS - taken. The comb arrives on the current stage and
 *  three nouns name what it teaches.
 *
 *  Pre-training is the largest opening effect available (median d = 0.75,
 *  against signalling 0.70 and segmenting 0.67) and the only one that is
 *  specifically an opening device. So the direction is settled; what these
 *  audition is HOW the names are presented, which is where the second finding
 *  bites: a list of names is verbal-propositional in the purest form, and
 *  fast-cut grammar raises visual memory while LOWERING verbal memory. Every
 *  option below has to answer for the motion it spends on the naming block. */
export const INTRO: Variant[] = [
  { id: "parts-numbered", name: "Manifest, held", claim: "Taken. The comb arrives on this stage in the left third; the mark and a numbered list of what the stage teaches sit on the second third. All three names land together on one dissolve and then hold - a list of names is verbal-propositional in the purest form, and motion on it costs verbal memory. The stepped and titled siblings live in the commits." },
];







/** LOWER THIRD - ten, written against the design law rather than around it.
 *  The bans that shape this set: no filled boxes (hairlines on the field), no
 *  pill radius, square badges, values in Saira with tabular-nums, mono labels,
 *  `.` never an em-dash, and the coral channel for a destructive warning while
 *  alert-red stays for a genuine failure. */
/** LOWER THIRD - ONE round, consolidated. `lower` and `hairline` were two sets
 *  auditioning the same piece: twenty treatments, and the second was ten
 *  variations of the first's winner. That is a round that was never closed.
 *
 *  So this is the merged set, cut to the treatments that differ STRUCTURALLY,
 *  and everything here inherits what the intro and outro settled: type sized
 *  against the frame, the caption band cleared, designators in Saira, and
 *  timing as data rather than hand-tuned windows. */
export const LOWER: Variant[] = [
  { id: "hairline", name: "Hairline", claim: "A gold rule with a mono label above and a Saira value below. The house treatment, and the control." },
  { id: "under", name: "Underline", claim: "Type first, rule last - it confirms rather than announces. The ordering is an offset in the entry stack now, not two hardcoded windows." },
  { id: "between", name: "Between", claim: "The rule sits between label and value and spaces them apart. The typography is set BY the gesture." },
  { id: "accent", name: "Accent bar", claim: "A gold left-accent bar, no box. The sanctioned not-a-box framing, so it stays legible over a busy canvas." },
  { id: "bracket", name: "Brackets", claim: "Top and bottom bracket rules only. Frames without enclosing; the lightest thing that still groups." },
  { id: "tag", name: "Ref tag", claim: "Designator in a square tag, part and value on one mono line. Closest to how the BOM itself reads." },
  { id: "readout", name: "Readout", claim: "The instrument treatment: Saira value at scale, mono unit and label beneath. For a measurement, not a name." },
  { id: "scale", name: "Scale", claim: "The rule carries minor ticks like a ruler edge. The most instrument-like, and the one that could only belong to this company." },
  { id: "warn", name: "Warning", claim: "The coral destructive channel on a hairline. Deliberately unlike a label, because a warning that looks like one is not read." },
  { id: "pass", name: "Gate pass", claim: "Status-green on a hairline for a check coming back clean, with alert-red as its failing twin. Never decorative." },
];


/** OUTRO / LADDER - ten ways to make the end screen curriculum.
 *  All of them keep YouTube's four element regions clear; they differ in what
 *  the viewer is told to do next, and how hard. */
/** OUTRO / LADDER - the direction is taken, so these are variants OF it.
 *  The previous ten auditioned what an outro should BE; that question is
 *  answered - the comb is the ladder, the mark holds the reclaimed upper-left,
 *  the wells stay empty. They live in the commits, not here.
 *
 *  What varies now is the MARK, because it is the one element with no product
 *  precedent in this composition: the comb is the shipped comb and the address
 *  is a mono eyebrow, but a brandmark at this size on a bare field is new. */
/** OUTRO / LADDER - the composition is settled; what varies is HOW IT LANDS.
 *  The brief was "like a click and target lock", so every option here is a
 *  mechanism rather than a flourish, and none of them springs or overshoots -
 *  both are on the forbidden list, and a detent is a step function anyway,
 *  which is what makes it read as mechanical rather than as easing. */
/** OUTRO / LADDER - the composition is settled; what varies is HOW IT ACQUIRES.
 *  Six DIFFERENT mechanisms, not one dressed six ways. Every one is cut from the
 *  comb's own six corners rather than a shape of its own - square brackets on a
 *  hexagonal comb read as a crop marquee from some other application - and none
 *  springs or overshoots, both being on the forbidden list. */
/** OUTRO / LADDER - two acquisitions left, both built on the same sequence.
 *  The outline finds the hex, then something takes hold of it. What differs is
 *  the grip: six corner brackets, or two half-hex jaws closing from the sides.
 *  Everything else is gone - `smooth`, `detent`, `reticle`, `vise` and `trace`
 *  alone, and `crosshair` - because the sequence beat all of them and a round
 *  that keeps its losers stops being a choice. */
/** OUTRO / LADDER - taken. One entry, because the direction is decided and a
 *  round that keeps its losers has stopped being a choice. The corner-bracket
 *  sibling lives in the commits. */
export const OUTRO: Variant[] = [
  { id: "ladder-trace-vise", name: "Trace and vise", claim: "The outline draws itself around the hex, then two half-hex jaws travel in from left and right and close on it, resting just proud of the line. Find, then seat." },
];











/** CHAPTER - the persistent indicator, and the only piece that never leaves.
 *  Six treatments spanning two open questions: WHERE it sits (research says top
 *  right; Google's own template masks both top corners and leaves the centre),
 *  and WHETHER a chapter position needs a NUMBER at all. */
export const CHAPTER: Variant[] = [
  { id: "corner", name: "Corner", claim: "Top right, mono, `03 / 08`, nothing else. The research's literal recommendation, and the control." },
  { id: "notch", name: "Notch-safe", claim: "Top CENTRE, inside the band Google's own template leaves usable. Picking it means the measured notch outranks the recommendation's wording." },
  { id: "labelled", name: "Labelled", claim: "`STAGE 03 / 08 . LAYOUT` on one line, in the app's own stage order, with the label reserved at its widest so the line cannot shift." },
  { id: "rule", name: "On a rule", claim: "The count under a short gold rule. The masthead treatment shrunk to chrome." },
  { id: "segments", name: "Segments", claim: "Eight ticks, the current one taller and gold, NO numerals. Signalling with nothing to read and nothing to reflow." },
  { id: "badge", name: "Badge", claim: "The count inside a square registration tag. Squarest, and the most ink on screen at all times." },
];

/** INTRO / SHORT - the generic opener. THE SUBJECT IS THE QUESTION.
 *
 *  A lesson intro's subject is the comb: where you are in a build. A short has
 *  no position in a sequence, so the comb would be a map of somewhere the video
 *  is not. What a short DOES have is a question - and for the troubleshooting
 *  type the symptom IS the hook, which is the one place where the honest
 *  opening and the effective one are the same sentence.
 *
 *  The naming block carries over unchanged, because pre-training is not a
 *  course device: three nouns before the process is the largest opening effect
 *  available (d = 0.75) for any instructional video. "In this stage" becomes
 *  "in this video" and nothing else changes. */
/** INTRO / SHORT - wash is the direction. The mark owns the field without ever
 *  competing to be read. These vary where it sits, how much of it is in frame,
 *  and - the half worth a round - what it is made OF. */
export const INTRO_SHORT: Variant[] = [
  { id: "wash", name: "Wash", claim: "The control: enormous, faint, bled off the top and left. The field stops being empty and nothing competes with the question." },
  { id: "wash-right", name: "Mirrored", claim: "Flipped to the right so the copy owns the left and the reading eye starts on words rather than on a wing." },
  { id: "wash-crop", name: "Detail", claim: "Cropped so hard that only the abdomen bands are in frame. Stops reading as a bee and starts reading as texture - identity by pattern rather than by logo." },
  { id: "wash-negative", name: "Negative", claim: "The mark CUT OUT of a gold field rather than drawn on a dark one. A hole in the light: the opposite gesture, and the most confident thing here." },
  { id: "wash-grid", name: "Grid inside", claim: "Engineering paper visible ONLY inside the mark's silhouette. Two house signatures made into one object rather than layered - the field is the brand and the brand is the field." },
  { id: "wash-bands", name: "Bands", claim: "Only the abdomen stripes, huge, spanning the frame as horizontal rules. The mark reduced to the hairline language everything else is built from - a logo you cannot quite see but can definitely recognise." },
];



/** OUTRO / SHORT - and its job is not to end.
 *
 *  Shorts count every REPLAY as a view and Instagram counts replays inside
 *  watch time, so a vertical short that loops cleanly is watched more than one
 *  that stops. There is also nothing to hand over to: end screens do not render
 *  on mobile web at all, and Shorts, Reels and TikTok have no end-screen
 *  equivalent whatsoever - so the CTA has to be in pixels we control.
 *
 *  Which makes the brief precise rather than vague: the LAST FRAME HAS TO CUT
 *  BACK TO THE FIRST INVISIBLY. That is a measurable property, not a feeling,
 *  and `furniture:check` measures it. */
export const OUTRO_SHORT: Variant[] = [
  { id: "loop", name: "Loop", claim: "Resolves to the same field the intro opens on, so the cut back to frame 0 is invisible. Address and follow prompt in pixels, because no end-screen element exists on any vertical surface." },
  { id: "loop-mark", name: "Loop on the mark", claim: "The same, landing on the brandmark alone - so the seam is the mark, and a viewer who loops twice sees it twice rather than seeing a join." },
];

/** ANNOTATE - the mid-video set, and the first furniture that fires OVER LIVE
 *  WORK rather than over a bare field.
 *
 *  That is the constraint the openers never had. A lower third sits on
 *  deep-space; a callout sits on a screencast of KiCad, where the background is
 *  someone else's contrast and changes every frame. So every treatment here
 *  carries its own ground - a hairline, a scrim, a bracket - and none of them
 *  relies on the field being dark.
 *
 *  WHY THESE FOUR. Signalling is d = 0.70, second only to coherence, and it is
 *  the one principle that says motion is POSITIVE rather than a cost: motion
 *  that POINTS helps. Everything built so far spends motion on transitions and
 *  none of it on directing attention, which is the gap. And 61% of interaction
 *  peaks accompany a visual transition, so a mid-video mark is also a scrub
 *  target - it should land on a boundary that means something. */
export const ANNOTATE: Variant[] = [
  { id: "callout-ring", name: "Callout, ring", claim: "A hex ring closes on the thing and holds, with a mono label on a leader. The trace-and-vise gesture at annotation scale, so a viewer who has seen the intro already knows what it means." },
  { id: "callout-bracket", name: "Callout, brackets", claim: "Two corner brackets grip the region instead of ringing it - better on a rectangular thing like a footprint or a dialog, and it never implies a circle where there is a pad." },
  { id: "callout-lead", name: "Callout, leader", claim: "A hairline runs in from the edge of frame and stops on the point, label at its root. Nothing overlaps the work at all, which is the only option that guarantees it." },
  { id: "pause", name: "Pause here", claim: "The one piece that is an instruction to the transport rather than information: stop, do the thing, come back. A build-along without it is a video you cannot follow at the bench." },
  { id: "wipe-before-after", name: "Before and after", claim: "A hard edge travels across and the fix is on the other side of it. A wipe along an axis is permitted vocabulary, so this costs nothing to add and is the natural shape for a repair." },
];

export const PIECES = {
  intro: { name: "Intro / LESSON", seconds: 3.5, variants: INTRO },
  lower: { name: "Lower third", seconds: 4, variants: LOWER },
  outro: { name: "Outro / LESSON", seconds: 8, variants: OUTRO },
  // THE GENERIC PAIR. No comb - a short is not a stage of a build, so the map
  // means nothing - but stylised hex ELEMENTS are fair game as framing.
  // These ship 9:16 as well, and the vertical is a SEPARATE composition rather
  // than a reflow.
  "intro-short": { name: "Intro / SHORT", seconds: 3.5, variants: INTRO_SHORT },
  "outro-short": { name: "Outro / SHORT", seconds: 4, variants: OUTRO_SHORT },
  annotate: { name: "Annotate / mid-video", seconds: 4, variants: ANNOTATE },
  // Seconds are the AUDITION length, not a duration - this piece is persistent.
  // The cut at t=2.0 is there so the round shows the one thing it does: change.
  chapter: { name: "Chapter indicator", seconds: 4, variants: CHAPTER },
} as const;

export type PieceKey = keyof typeof PIECES;
export const PIECE_KEYS = Object.keys(PIECES) as PieceKey[];
