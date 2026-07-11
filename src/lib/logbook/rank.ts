// Rank wing system (LOCKED 2026-07-11). The 12 FL ranks split into three 4-level
// tiers; each tier has its own central device, and within a tier the rank device
// escalates by position (1-4). Pure data — drives RankWing.
export const CENTER_SET = ["roundel", "hexagon", "shield"] as const;
export type CenterDevice = (typeof CENTER_SET)[number];

/** The wing tier (1-3) for a level: FL1-4 → 1, FL5-8 → 2, FL9-12 → 3. */
export const wingTierOf = (level: number) => Math.min(3, Math.max(1, Math.ceil(level / 4)));

/** Position within the tier (1-4), which drives the escalating rank device. */
export const tierPos = (level: number) => ((level - 1) % 4) + 1;
