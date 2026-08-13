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

/** INTRO / ARTIFACT - ten ways to put the real stage artifact against a title.
 *  The artifact tiles are renders of the actual thing each stage produces, so
 *  the question every variant answers differently is: how much of the frame does
 *  the evidence get, and where does the reading eye start? */
export const INTRO: Variant[] = [
  { id: "right", name: "Right half", claim: "Art owns the right, copy the left, a scrim guaranteeing the column. The safe one - it survives any tile silhouette." },
  { id: "left", name: "Left half", claim: "Mirrored. Evidence first, then the words. Reads as a document opening on its figure." },
  { id: "bleed", name: "Bleed", claim: "Art oversized and running off the right edge, copy low-left. Most cinematic; the artifact stops being a thumbnail." },
  { id: "inset", name: "Inset frame", claim: "Art in a hairline-framed panel beside the copy. The document-index treatment, closest to the guide pages themselves." },
  { id: "hex", name: "Hex mask", claim: "Art masked into the brand hex. Strongest identity, at the cost of cropping the artifact." },
  { id: "strip", name: "Strip", claim: "A narrow full-height band of art on the right third. Quietest; leaves the most room for a long title." },
  { id: "ghost", name: "Ghost", claim: "The stage's GHOST map, huge and faint behind centred copy. The artifact as watermark rather than subject." },
  { id: "corner", name: "Corner", claim: "Small art top-right, big title bottom-left. Maximum type size - the one to pick if titles are the point." },
  { id: "stack", name: "Stack", claim: "Art above, rule, title below, centred. The only variant that works unchanged in a square or vertical crop." },
  { id: "datum", name: "Datum", claim: "A single gold rule crosses the frame and the art sits on it like a part on a bench. Most instrument-like." },
];

/** SECTION - the REAL honeycombs, not a redrawing.
 *  Two combs exist in the product: the build-guide hub (`.gh-*`, big info hexes
 *  with a Saira number, title, lead and status chip) and the /courses path comb
 *  (`.phex-*`, eyebrow + title + chip). A section card's job is to say where in
 *  the build you are, and the comb already says that better than a label. */
export const SECTION: Variant[] = [
  { id: "guide-real", name: "Guide comb, verbatim", claim: "The actual GuideHoneycomb component, rendered into the frame. Whatever it looks like on the hub is what the video shows." },
  { id: "guide-row", name: "Guide comb, one row", claim: "Three guide hexes: done, current, next. The comb cropped to the part that is about to matter." },
  { id: "guide-solo", name: "Guide hex, solo", claim: "One full guide hex, big. Saira number, title, lead, status chip - the whole stage button as the card." },
  { id: "path-strip", name: "Path comb strip", claim: "The /courses `.phex` treatment across the top. Where you are in the COURSE rather than the build." },
  { id: "comb-8", name: "Full comb, eight", claim: "All eight stages tessellated, current lit. The whole map, once, so a viewer can place the video." },
  { id: "comb-corner", name: "Comb, corner", claim: "The eight-hex comb small in the upper right, out of the work. Can fire mid-demonstration." },
  { id: "comb-walk", name: "Comb walk", claim: "The comb with the lit cell advancing from the previous stage to this one. Motion carries the meaning." },
  { id: "band-comb", name: "Band plus hex", claim: "A lower band with one hex on its left. Band legibility, comb identity." },
  { id: "num", name: "Numeral", claim: "Saira stage number at hero scale with the label under it. No comb at all - the fastest read of the ten." },
  { id: "rule-comb", name: "Rule and comb", claim: "A gold rule across the frame with the comb sitting on it, stage name below. The masthead treatment." },
];

/** LOWER THIRD - ten, written against the design law rather than around it.
 *  The bans that shape this set: no filled boxes (hairlines on the field), no
 *  pill radius, square badges, values in Saira with tabular-nums, mono labels,
 *  `.` never an em-dash, and the coral channel for a destructive warning while
 *  alert-red stays for a genuine failure. */
export const LOWER: Variant[] = [
  { id: "hairline", name: "Hairline", claim: "A gold rule with a mono label above and a Saira value below. The document-index row, as furniture." },
  { id: "accent", name: "Accent bar", claim: "A gold left-accent bar, no box. The sanctioned not-a-box framing, so it stays legible over a busy canvas." },
  { id: "bracket", name: "Brackets", claim: "Top and bottom bracket rules only. Frames without enclosing; the lightest thing that still groups." },
  { id: "masthead", name: "Masthead", claim: "A gold top-rule with the label riding it. Reads as a document header rather than a caption." },
  { id: "readout", name: "Readout", claim: "The instrument treatment: Saira value at scale, mono unit and label beneath. For a measurement, not a name." },
  { id: "badge", name: "Badge and line", claim: "A square mono badge plus a value on a rule. Square is the registration-tag corner language, never a pill." },
  { id: "tag", name: "Ref tag", claim: "Designator in a square tag, part and value on one mono line. Closest to how the BOM itself reads." },
  { id: "warn", name: "Warning", claim: "The coral destructive channel on a hairline. Deliberately unlike a label, because a warning that looks like a label is not read." },
  { id: "fail", name: "Gate fail", claim: "Alert-red, reserved for a genuine gate state: ERC, DRC, a failed continuity check. Never decorative." },
  { id: "pass", name: "Gate pass", claim: "Status-green on a hairline, the pass-side parallel. For the moment a check comes back clean." },
];

/** OUTRO / LADDER - ten ways to make the end screen curriculum.
 *  All of them keep YouTube's four element regions clear; they differ in what
 *  the viewer is told to do next, and how hard. */
export const OUTRO: Variant[] = [
  { id: "next", name: "Next lesson", claim: "Names the next lesson in words. The plainest version of the ladder." },
  { id: "rungs", name: "Rungs", claim: "The stage ladder drawn as rungs with the completed one struck gold. Progress made visible." },
  { id: "comb", name: "Comb ahead", claim: "The build comb with this stage done and the next lit. Uses the map the learner already knows." },
  { id: "count", name: "Count", claim: "A Saira `04 / 09` readout with the stage name. The instrument answer to where am I." },
  { id: "two-up", name: "Two up", claim: "This lesson and the next, side by side on a rule. Comparison rather than instruction." },
  { id: "path", name: "Path", claim: "The course path as a horizontal run of phex cells, current lit. Zoomed out one level from the build." },
  { id: "gate", name: "Gate", claim: "Frames the next step as the gate it actually is: what must be true before it opens." },
  { id: "url", name: "URL first", claim: "The payoff address is the hero and the ladder is the support. For videos that arrive from search." },
  { id: "quiet", name: "Quiet", claim: "One line, one rule, one address. Everything else is negative space for the four elements." },
  { id: "stack", name: "Stacked CTA", claim: "The gold action ladder: primary, secondary, quiet link. Never a blue action to differentiate." },
];


/** GHOST - ten. The stage's ghost map is a LUMINANCE-derived mask of the real
 *  artifact, painted in one colour, so it is the drawing itself rather than a
 *  silhouette. That is why it can carry a whole frame: it says what this stage
 *  produces without handing the artifact over, which is exactly the register an
 *  intro wants. Round 2 had one treatment of it; these are ten. */
export const GHOST: Variant[] = [
  { id: "centre", name: "Centre", claim: "Huge, centred, copy over it. Round 2's version, kept as the control." },
  { id: "offset", name: "Offset", claim: "Ghost pushed right, copy in a clean left column. The legible one - nothing sits over anything." },
  { id: "bleed", name: "Bleed", claim: "Oversized and cropped by the frame, so it reads as a detail of something bigger." },
  { id: "duo", name: "Duo", claim: "Ghost large behind, the real artifact small and solid in front. What it will be, over what it is now." },
  { id: "sweep", name: "Sweep", claim: "A gold sweep crosses the frame and the ghost exists only where it has passed. The drawing arrives by being surveyed." },
  { id: "outline", name: "Outline", claim: "Ghost at its faintest inside a hairline frame. The document-index register: evidence, filed." },
  { id: "fill", name: "Fill", claim: "The ghost plates with gold from the bottom as the piece runs. Borrows the film's plating language directly." },
  { id: "grid", name: "Grid", claim: "Ghost over an engineering-paper field. The most literal reading of the whole visual system." },
  { id: "hex", name: "Hex", claim: "Ghost masked into the brand hex at size. Strongest identity of the ten." },
  { id: "strata", name: "Strata", claim: "Sliced into horizontal bands that land in sequence, so the drawing assembles rather than appears." },
];


/** COMB WALK - ten, on the REAL comb.
 *  Round 2's comb was a hand-drawn polygon wearing the right colours, which is
 *  the thing the design law calls out by name: the honeycomb already exists as
 *  `.gh-node` / `.gh-hex` / `.comb-num` / `.gh-chip` in globals.css plus a
 *  `HexPrism` component, and reinventing it means the video drifts from the
 *  product the first time either changes. These use the real classes and the
 *  real prism, so the styling is whatever the hub's styling currently is.
 *  What varies is the WALK: how the lit cell gets from the last stage to this. */
export const COMBWALK: Variant[] = [
  { id: "step", name: "Step", claim: "The fill hands over from the previous cell to this one. The plainest walk, and the one that reads at any size." },
  { id: "sweep", name: "Sweep", claim: "A gold sweep crosses the whole comb and leaves the current cell lit behind it. One gesture rather than two events." },
  { id: "trail", name: "Trail", claim: "Every completed cell lights in sequence up to this one. Says how far you have come, not just where you are." },
  { id: "arrow", name: "Arrow", claim: "The seam arrow between the two cells fires, then the fill lands. Uses the comb's own path-direction language." },
  { id: "drop", name: "Drop", claim: "The current cell drops onto the comb from above and seats. The prism's 3D face makes the landing read." },
  { id: "pulse", name: "Pulse", claim: "The current cell pulses once at the beat instead of filling. The lightest touch of the ten." },
  { id: "focus", name: "Focus", claim: "The whole comb sits dim and the current cell resolves to full. Depth of field rather than fill." },
  { id: "zoom", name: "Zoom", claim: "The comb pushes in on the current cell as it lights, so the card ends on the one hex that matters." },
  { id: "count", name: "Count", claim: "The Saira watermark counts up to this stage's ordinal as the fill arrives. The numeral does the walking." },
  { id: "unmask", name: "Unmask", claim: "The current cell's artifact tile unmasks inside the hex. What this stage produces, revealed as you arrive at it." },
];


/** HAIRLINE - ten variations of the lower third that won round 2's set.
 *  The hairline IS the house treatment: a rule on the bare field, a mono label,
 *  a value. So these vary the RULE - how it arrives, what it does while the
 *  label is up, and how it takes the label away again. */
export const HAIRLINE: Variant[] = [
  { id: "grow", name: "Grow", claim: "The rule draws left to right, label above, value below. Round 2's version, as the control." },
  { id: "split", name: "Split", claim: "The rule opens from the centre outward. Symmetrical, and the label lands in the gap it makes." },
  { id: "under", name: "Underline", claim: "Label and value arrive first, the rule strikes underneath them last. The rule confirms rather than announces." },
  { id: "between", name: "Between", claim: "The rule sits between label and value and pushes them apart as it grows. The typography is spaced BY the rule." },
  { id: "tick", name: "Tick", claim: "A short tick at the left grows into the full rule. Reads as a measurement being taken." },
  { id: "double", name: "Double", claim: "Two rules, the second offset and dim. Depth without a box, which is the whole trick of this system." },
  { id: "bracket", name: "Bracket", claim: "The rule turns a corner and runs up the left. Frames two sides, encloses none." },
  { id: "scale", name: "Scale", claim: "The rule carries minor ticks like a ruler edge. The most instrument-like of the ten." },
  { id: "trace", name: "Trace", claim: "The rule is a PCB trace: it steps at 45 degrees partway. The one that could only belong to this company." },
  { id: "weight", name: "Weight", claim: "The rule arrives thin and thickens to full weight. Quietest arrival, strongest final state." },
];

export const PIECES = {
  intro: { name: "Intro / artifact", seconds: 3.5, variants: INTRO },
  ghost: { name: "Intro / ghost", seconds: 3.5, variants: GHOST },
  section: { name: "Section / comb", seconds: 1.8, variants: SECTION },
  combwalk: { name: "Section / comb walk", seconds: 2.2, variants: COMBWALK },
  lower: { name: "Lower third", seconds: 4, variants: LOWER },
  hairline: { name: "Lower / hairline", seconds: 4, variants: HAIRLINE },
  outro: { name: "Outro / ladder", seconds: 8, variants: OUTRO },
} as const;

export type PieceKey = keyof typeof PIECES;
export const PIECE_KEYS = Object.keys(PIECES) as PieceKey[];
