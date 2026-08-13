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

export const PIECES = {
  intro: { name: "Intro / artifact", seconds: 3.5, variants: INTRO },
  section: { name: "Section / comb", seconds: 1.8, variants: SECTION },
  lower: { name: "Lower third", seconds: 4, variants: LOWER },
  outro: { name: "Outro / ladder", seconds: 8, variants: OUTRO },
} as const;

export type PieceKey = keyof typeof PIECES;
export const PIECE_KEYS = Object.keys(PIECES) as PieceKey[];
