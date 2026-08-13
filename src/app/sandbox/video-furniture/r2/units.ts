// The base unit, and why it is not the one we started with.
//
// EVERY TYPE SIZE MUST BE A SHARE OF THE FRAME'S SHORT EDGE.
//
// We sized in `cqw` - a share of container WIDTH. That is the long edge at 16:9
// and the short edge at 9:16, so one constant is not one size. BBC's subtitle
// guidance makes the point precisely: it specifies **6.667% of frame height for
// landscape** and **3.75% for 9:16**, which are not two opinions but the SAME
// PHYSICAL SIZE - both resolve to a 72 px em at 1080. Expressed against the
// short edge, both are 6.667%. Against width, they are 3.75% and 6.667%.
//
// So a single `cqw` number ships type **1.78x wrong** in one of the two
// deliveries. We were already paying for this without naming it: the Logbook
// film needed per-format type caps of 0.58 and 0.52, and 1/1.78 = 0.56. Those
// were not taste. They were hand-tuning around a unit bug.
//
// CSS already has the right unit: `cqmin` is min(container width, height), and
// our stages set `containerType: "size"`, so it resolves.
//
// WHY A HELPER RATHER THAN REWRITING THE NUMBERS. Every size in the sandbox was
// tuned by eye at 16:9 in the cqw scale. Multiplying 42 literals by 16/9 would
// change every authored number, make the diff unreadable, and guarantee at least
// one typo. Instead the authored numbers stay exactly as they were and the
// helper converts. The 16:9 render is therefore unchanged - which is a testable
// claim, not a hope, and `unit-check.mjs` tests it.
//
// WHAT THIS DOES NOT COVER. Horizontal positions and column widths stay in
// `cqw`, deliberately. A narrower frame SHOULD hold fewer characters per line,
// and safe areas are specified per side as a share of that side. Type has a
// physical size; layout is proportional to its axis. Those are different
// questions and conflating them is how the first version went wrong.
//
// ASCII only.

/** 16:9 - the aspect every size in this sandbox was authored against. */
const AUTHORED_ASPECT = 16 / 9;

/**
 * A type size, authored in the 16:9 `cqw` scale, emitted against the short edge.
 *
 * `ts(4)` means "the size 4cqw used to be at 16:9" and now ships that same
 * physical size at every aspect.
 */
export function ts(cqwAt16x9: number): string {
  return `${(cqwAt16x9 * AUTHORED_ASPECT).toFixed(4)}cqmin`;
}

/**
 * A stroke, rule or hairline weight. Same conversion, named separately because
 * it carries an extra constraint that has nothing to do with aspect:
 *
 * A thin high-contrast edge is close to worst-case content for a
 * block-transform codec - it is what produces ringing, and moving ringing is
 * mosquito noise. The floor below keeps a rule at 2 px at 1080 short-edge, which
 * is the reported minimum for surviving a platform re-encode cleanly.
 */
const HAIRLINE_FLOOR_CQMIN = 0.1852; // 2 px at a 1080 short edge

export function hw(cqwAt16x9: number): string {
  const v = cqwAt16x9 * AUTHORED_ASPECT;
  return `${Math.max(v, HAIRLINE_FLOOR_CQMIN).toFixed(4)}cqmin`;
}

/** The floor, exported so a check can assert against it rather than re-deriving. */
export const HAIRLINE_FLOOR = HAIRLINE_FLOOR_CQMIN;
