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
/** LOWER THIRD - SIX JOBS.
 *
 *  Every one is TERM-SHAPED rather than a sentence, and that is a research
 *  constraint rather than a house style: a lower third that transcribes
 *  narration buys nothing (redundancy, d = 0.10), while short, reworded or
 *  technical text is fine and probably good. `TQFP-48` while the narration says
 *  "the quad flat pack" earns its place; a sentence does not.
 *
 *  `part` is the converted, data-driven set. The rest are first treatments. */
/** LOWER THIRD - three options per JOB.
 *
 *  The six types are settled; these are their rounds. Every option obeys the
 *  same law - hairlines on the bare field, no filled cards, mono labels, Saira
 *  only where a number is the hero, `\u00b7` never an em-dash - so what varies
 *  is structure rather than styling.
 *
 *  Each type's third option is deliberately the one that argues with the other
 *  two, because a round of three near-identical treatments is not a choice. */
/** LOWER THIRD - three options per job, plus SIX NEW FORMS.
 *
 *  The six jobs are settled and their per-job options stand. What is added here
 *  is a set of FORMS - shapes the whole family could take - auditioned on `part`
 *  because it is the canonical one: whatever form wins can carry every job.
 *
 *  Two of them are the label round's winners applied down here, which is a
 *  consistency argument worth testing rather than assuming: if a tab is right
 *  for naming a thing on the board, it may be right for naming a thing at the
 *  frame edge, and one vocabulary is better than two. */
export const LOWER: Variant[] = [
  { id: "part-rule", name: "Part / rule", claim: "Mono label, gold rule, designator in Saira beneath. The document-index row as furniture." },
  { id: "part-tag", name: "Part / ref tag", claim: "Designator in a square tag, part number on a mono line beside it. Closest to how the BOM itself reads." },
  { id: "part-lead", name: "Part / value first", claim: "The part number at size with the designator demoted to a caption. Argues the viewer is looking up a part, not a reference." },

  { id: "form-tab", name: "Form / tab", claim: "The callout's winning tab, at the frame edge: knocked out of a solid gold bar. Brings its own ground, so it survives any footage - and it makes the lower third and the callout one vocabulary." },
  { id: "form-display", name: "Form / display", claim: "The callout's other winner: Bebas at size, no frame, a halo doing the work. The loudest thing the set can do at the bottom of a frame." },
  { id: "form-ticker", name: "Form / ticker", claim: "One horizontal run, everything inline, a third of the height. For a video that needs a lower third up often rather than rarely." },
  { id: "form-column", name: "Form / column", claim: "Rotated to the left EDGE, reading bottom-to-top. Costs no horizontal space at all, which is the one thing 9:16 has none of." },
  { id: "form-bracket", name: "Form / bracketed", claim: "Held between two rules, nothing at the sides. Frames without boxing, and stays legible over a busy canvas." },
  { id: "form-plate", name: "Form / plate", claim: "A deep-space plate with a gold top-rule - the masthead treatment at full width. The most readable over anything, and the most furniture." },

  { id: "measure-hero", name: "Measure / hero", claim: "The signature readout: Saira at scale, unit beside it, mono label above." },
  { id: "measure-line", name: "Measure / on a line", claim: "Label, rule, value on one horizontal run. A third of the height." },
  { id: "measure-delta", name: "Measure / against", claim: "The value with what it was, struck through. A measurement in a repair video is usually a comparison." },

  { id: "term-stack", name: "Term / stacked", claim: "Bebas term, Lora definition beneath. The reading voice, in the one place a sentence is legal." },
  { id: "term-inline", name: "Term / inline", claim: "Term and definition on one line, the term in gold." },
  { id: "term-eyebrow", name: "Term / defined", claim: "The term as the eyebrow and the definition as the statement." },

  { id: "source-rule", name: "Source / rule", claim: "A quiet hairline and a mono citation." },
  { id: "source-tag", name: "Source / standard", claim: "The standard in a square tag, the section beside it." },
  { id: "source-corner", name: "Source / corner", claim: "Small, in the corner, out of the lower third entirely." },

  { id: "gate-rule", name: "Gate / rule", claim: "A tone-coloured rule, mono state, result beside it." },
  { id: "gate-badge", name: "Gate / badge", claim: "A square badge in the status channel with the count beside it." },
  { id: "gate-count", name: "Gate / count", claim: "The error count as the hero in Saira. A failing gate is a number before it is a word." },

  { id: "warn-bar", name: "Warn / accent bar", claim: "The coral left-accent bar." },
  { id: "warn-stencil", name: "Warn / stencil", claim: "Knocked out of solid coral. Unmissable, which a warning should be." },
  { id: "warn-brackets", name: "Warn / brackets", claim: "Coral rules above and below, nothing at the sides." },
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
/** INTRO / SHORT - wash is the direction, and the grid is the interesting half.
 *
 *  THE LIFECYCLE, which is the point: for most of its life this IS the plain
 *  wash - a solid mark, faint, owning the field. Only at the end does it
 *  abstract, resolving into a hex lattice whose cells then discharge away down
 *  the grid and vanish. The transition is the mark taking itself apart.
 *
 *  ON THE VOCABULARY. "animated lattice" is on the forbidden list, and this is
 *  one - flagged rather than quietly built past. The ban targets the ambient
 *  pulsing node-graphic that runs under an entire AI-tech video as decoration;
 *  this fires ONCE, as an exit, and is over. That is a judgement about intent
 *  rather than a loophole, and it should be overturned if it reads as the
 *  cliche the ban exists to prevent. */
/** INTRO / SHORT - the wash, and how much it is allowed to move.
 *
 *  The hex lattice was scrapped on encode cost: a moving high-frequency lattice
 *  is close to worst-case content for a block-transform codec, the same argument
 *  that killed the animated comb. So every option here is chosen against that
 *  rule - a block codec is cheap when large areas are STATIC or move as ONE
 *  coherent boundary, and expensive when many small details move independently.
 *
 *  Which means the cost is measurable rather than arguable, and it was measured:
 *  same treatment, same encode, CRF 20, 105 frames at 1920x1080. */
/** INTRO / SHORT. Static wash leads, so these are the ones that question the
 *  premise rather than decorate it.
 *
 *  What is settled: the subject is the QUESTION, the nouns do the pre-training,
 *  no comb, and it must read MUTED because YouTube's own feed autoplays it
 *  silent with captions over the top. What is not settled is whether the mark
 *  should be a backdrop at all - three of these say no. */
/** INTRO / SHORT - two taken. THE BOARD and STATIC WASH.
 *
 *  They disagree about what the field is for, which is why both survived: the
 *  wash makes the field the BRAND, the board makes it the EVIDENCE. These are
 *  variations within each, not a re-run of the question. */
export const INTRO_SHORT: Variant[] = [
  { id: "subject", name: "Board", claim: "The artifact this stage produces, ghosted across the field, with the lockup top-left. Evidence rather than branding." },
  { id: "subject-bleed", name: "Board, bled", claim: "The same board oversized and cropped by the frame, so it reads as a DETAIL of something bigger rather than a picture of a thing." },
  { id: "subject-half", name: "Board, half", claim: "The board held to the right half at full strength instead of ghosted across the whole frame. Sharper evidence, less field to write on." },
  { id: "wash", name: "Static wash", claim: "The mark enormous and faint, nothing moving. The cheapest frame in the set and the bar the others have to beat." },
  { id: "wash-corner", name: "Wash, cornered", claim: "The same wash pushed into one corner so the reading column is clean field. Identity present, nothing behind the words." },
  { id: "wash-board", name: "Wash and board", claim: "Both: the mark as the wash, the artifact as a solid inset. Argues they were never mutually exclusive - one is the field, the other is the subject." },
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

/** THE MID-VIDEO SET, and it is THREE devices rather than one.
 *
 *  They were built as a single `annotate` piece because they share a
 *  constraint - each fires over LIVE WORK rather than a bare field, where the
 *  background is someone else's contrast and changes every frame. But a shared
 *  constraint is not a shared job: pointing at a thing, halting the viewer, and
 *  showing a repair are three devices, and two of them had exactly one
 *  treatment, which is not an audition.
 *
 *  So each gets its own round. The constraint stays in all three: every
 *  treatment carries its own ground, and none may assume the field is dark. */

/** CALLOUT - signalling, which is d = 0.70 and the one principle that says
 *  motion is POSITIVE rather than a cost. Everything else in the set spends
 *  motion on transitions; this is the only piece that spends it on POINTING. */
/** CALLOUT - SEVEN JOBS, not seven styles.
 *
 *  The form follows the job, and the jobs are genuinely different: a hex ring
 *  around a single pad would cover the pad, and brackets around a pour would
 *  imply a rectangle where there is a shape. Signalling is d = 0.70 and is the
 *  one principle saying motion is POSITIVE - but only motion that POINTS, which
 *  means pointing correctly is the whole job.
 *
 *  `region` is settled: the trace-and-vise hex, ported from the carousel that
 *  actually renders it. The rest are first treatments awaiting their own round. */
export const CALLOUT: Variant[] = [
  { id: "region", name: "Region", claim: "TAKEN. The trace-and-vise hex closes on an area - a pour, a keep-out, a zone. Same gesture the intro and outro use, so a viewer has already been taught it." },
  { id: "point", name: "Point", claim: "A pad, a via, a single pin. The mark must NOT cover the thing, which rules out anything that encloses it - so a leader arrives from outside and stops short." },
  { id: "element", name: "Element", claim: "A menu item, a dialog, a field. Rectangular, because a hex around a button implies a circle where there is a rectangle." },
  { id: "group", name: "Group", claim: "\"These three caps.\" One label serving several marks - a ring per item reads as three unrelated callouts rather than one set." },
  { id: "offscreen", name: "Off-screen", claim: "The target is not in frame: an edge indicator pointing at where it would be. The only callout whose subject cannot be seen." },
  { id: "measure", name: "Measurement", claim: "A value anchored to a place - `2.42 A` at this node. Carries a number, so it is a readout with a position rather than a mark with a label." },
  { id: "warn", name: "Warning", claim: "\"Do not probe here.\" The coral destructive channel, deliberately unlike a label, because a warning that looks like a label is not read." },
];


/** PAUSE - the one device that is an INSTRUCTION TO THE TRANSPORT rather than
 *  information. Stop, do the thing, come back. A build-along without it is a
 *  video you cannot follow at the bench. What varies is how hard it stops you. */
export const PAUSE: Variant[] = [
  { id: "card", name: "Full stop", claim: "A centred card on its own ground, work dimmed behind it. Unmissable, and the only one that reads as a genuine halt rather than a suggestion." },
  { id: "band", name: "Band", claim: "A band across the lower third. Stops short of covering the work, so a viewer who ignores it loses nothing - which is either the virtue or the flaw." },
  { id: "corner", name: "Badge", claim: "A small square tag in the corner. The work stays entirely visible; this is a reminder rather than an instruction." },
  { id: "dim", name: "Dim and hold", claim: "The whole frame drops to half and one line appears. Nothing is covered - the work is still readable underneath - but it is unmistakably paused." },
];

/** BEFORE AND AFTER - a wipe along an axis is already permitted vocabulary, so
 *  this costs nothing to add and is the natural shape for a repair. What varies
 *  is whether the viewer sees the CHANGE or is shown two states. */
/** BEFORE AND AFTER - THREE FAMILIES, and the distinction is factual rather
 *  than stylistic.
 *
 *  What the two states MEAN decides whether a given motion is honest. A wipe
 *  implies one thing BECAME the other; a split implies they coexist; a dissolve
 *  implies nothing changed but the view. Using a wipe for a comparison is an
 *  error about the content, not a preference about the transition - which is
 *  why these are separate types rather than variants of one. */
export const BEFORE_AFTER: Variant[] = [
  { id: "chrono", name: "Chronological", claim: "Broken becomes fixed. A wipe is right here BECAUSE it implies time passing - the state on the left genuinely turned into the state on the right." },
  { id: "compare", name: "Comparative", claim: "Option A against option B, neither of them \"before\". A static split, because a wipe would falsely claim one became the other." },
  { id: "reveal", name: "Revelatory", claim: "Hidden becomes shown - a layer, a 3D view, silkscreen off. A dissolve or a mask, because NOTHING changed except what you are being shown." },
];


/** LABEL - how a callout NAMES the thing it is pointing at.
 *
 *  Cross-cutting, so it gets its own round rather than being decided inside one
 *  callout type: whatever wins applies to all seven.
 *
 *  THE BOX WAS THE PROBLEM. The design law is explicit that content groups with
 *  hairlines on the bare field and never in a filled card, and it names the
 *  not-a-box framings outright: a gold top-rule masthead, a left-accent bar, or
 *  top-and-bottom bracket rules. A bordered tag is a box, and making it a nicer
 *  bordered box does not stop it being one.
 *
 *  The constraint that makes this hard is the one this whole set keeps
 *  re-teaching: a label over live work cannot borrow contrast from a background
 *  it does not control, so "no box" cannot mean "no ground". Each option below
 *  solves that differently, and one of them refuses to. */
/** LABEL - two directions taken, so these are variations OF them.
 *
 *  TAB attaches the label to the mark: it shares the hex's edge, so the pointer
 *  and the name are one object. DISPLAY refuses a frame entirely and sets the
 *  name as a title, which is a different claim about what a callout is.
 *
 *  Both carry the constraint the whole set keeps re-teaching - a label over live
 *  work cannot borrow contrast from a background it does not control - and they
 *  solve it differently: the tab brings its own ground, the display carries a
 *  halo. Which of those survives copper is the thing to watch. */
export const LABEL: Variant[] = [
  { id: "tab", name: "Tab, solid", claim: "Gold bar hanging off the hex, dark text knocked out of it. Brings its own ground, so it cannot be lost whatever is underneath." },
  { id: "tab-outline", name: "Tab, outline", claim: "The same tab as a hairline frame on deep-space rather than a gold fill - quieter, and it keeps the gold for the mark instead of spending it on the caption." },
  { id: "tab-under", name: "Tab, under", claim: "Hangs beneath the hex instead of beside it. Frees the horizontal, which matters at 9:16 where there is none to spare." },
  { id: "display", name: "Display", claim: "Bebas at size, no frame, a dark halo doing the work. Reads as a title rather than a tag." },
  { id: "display-rule", name: "Display on a rule", claim: "The same title with a gold rule beneath it, running back toward the mark. The rule connects the name to the thing without enclosing either." },
  { id: "display-eyebrow", name: "Display, led", claim: "A mono eyebrow above the title - the house two-line lockup, so a callout reads like every other piece of OTD furniture rather than like a caption." },
];



export const PIECES = {
  // 2.0s = ONE BAR at 120 BPM. Owner's call 2026-08-19: go with the measured
  // convention rather than the audio-logo convention.
  //
  // Measured across 89 videos / 18 technical channels, the median time to the
  // first narrated word in this genre is 0.48s and 87% are under 4s -- Phil's
  // Lab speaks at 0.24s, Bald Engineer's KiCad series at 0.08s. 4.0s was a good
  // AUDIO LOGO (Netflix ~3s, HBO ~5s) and a bad technical-YouTube intro; those
  // are different reference classes and the research answered them separately.
  //
  // One bar is the floor that keeps a grid: the landing sits at beat 3 (t=1.5s)
  // and the last 500ms are the near-silence narration needs to start clean --
  // forward masking decays over ~100-200ms, so 500 is comfortably clear.
  intro: { name: "Intro / LESSON", seconds: 2, variants: INTRO },
  lower: { name: "Lower third", seconds: 4, variants: LOWER },
  outro: { name: "Outro / LESSON", seconds: 8, variants: OUTRO },
  // THE GENERIC PAIR. No comb - a short is not a stage of a build, so the map
  // means nothing - but stylised hex ELEMENTS are fair game as framing.
  // These ship 9:16 as well, and the vertical is a SEPARATE composition rather
  // than a reflow.
  "intro-short": { name: "Intro / SHORT", seconds: 3.5, variants: INTRO_SHORT },
  "outro-short": { name: "Outro / SHORT", seconds: 4, variants: OUTRO_SHORT },
  // Three devices, three rounds. They share a constraint, not a job.
  callout: { name: "Callout / points at it", seconds: 4, variants: CALLOUT },
  label: { name: "Label / names it", seconds: 4, variants: LABEL },
  pause: { name: "Pause / halts you", seconds: 4, variants: PAUSE },
  beforeafter: { name: "Before + after", seconds: 4, variants: BEFORE_AFTER },
  // Seconds are the AUDITION length, not a duration - this piece is persistent.
  // The cut at t=2.0 is there so the round shows the one thing it does: change.
  chapter: { name: "Chapter indicator", seconds: 4, variants: CHAPTER },
} as const;

export type PieceKey = keyof typeof PIECES;
export const PIECE_KEYS = Object.keys(PIECES) as PieceKey[];
