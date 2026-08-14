// SANDBOX fixtures — the real go-further destinations.
//
// The comb at the foot of /courses shows every path EXCEPT the one being viewed, so
// which cells appear depends on the selection, and so does whether the flagship's ★
// treatment is on screen at all. Both cases are here because a round that only ever
// showed the default would never test the state that looks different.
//
// Counts are the real closures, read off the curriculum DAG on 2026-08-13:
// eeg 6 · swarm 4 · motion 4 · power 3 · bench 6.

export interface PathCell {
  key: string;
  /** the real label from lib/skill-paths.ts. */
  label: string;
  /** a three-letter code, for the variants that follow the lesson ribbon literally. */
  code: string;
  total: number;
  done: number;
  /** SENSE / ACT / POWER / COMMS, or null for the bench category. */
  track: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
  isPrimary: boolean;
  isBench: boolean;
}

/** Viewing the flagship: the other four paths, no ★ on screen. This is the default
 *  /courses view and therefore the common case. */
export const OTHERS_FROM_EEG: PathCell[] = [
  { key: "swarm", label: "Command the Swarm", code: "SWM", total: 4, done: 1, track: "COMMS", isPrimary: false, isBench: false },
  { key: "motion", label: "Motion & Actuation", code: "MOT", total: 4, done: 0, track: "ACT", isPrimary: false, isBench: false },
  { key: "power", label: "Power Systems", code: "PWR", total: 3, done: 0, track: "POWER", isPrimary: false, isBench: false },
  { key: "bench", label: "Bench Tools", code: "BEN", total: 6, done: 0, track: null, isPrimary: false, isBench: true },
];

/** Viewing a mastery path: the flagship comes back into the comb, carrying the ★. */
export const OTHERS_FROM_SWARM: PathCell[] = [
  { key: "eeg", label: "The 8-Channel EEG", code: "EEG", total: 6, done: 1, track: "SENSE", isPrimary: true, isBench: false },
  { key: "motion", label: "Motion & Actuation", code: "MOT", total: 4, done: 0, track: "ACT", isPrimary: false, isBench: false },
  { key: "power", label: "Power Systems", code: "PWR", total: 3, done: 0, track: "POWER", isPrimary: false, isBench: false },
  { key: "bench", label: "Bench Tools", code: "BEN", total: 6, done: 0, track: null, isPrimary: false, isBench: true },
];

/**
 * Track accent, as a TOKEN rather than a hex.
 *
 * The shipped `PathHoneycomb` carries a `TRACK_ACCENT` map of literal hex values
 * (`#66bb6a` and friends) and feeds them into `--accent`. Those are the palette's own
 * colours written out longhand, so they look harmless, and they are still a theming
 * bug: a literal hex cannot be re-pointed by the `[data-theme="light"]` token block,
 * so the accent is the only thing on the comb that will not flip. Every variant here
 * resolves through `var(--color-*)` instead, which is also what makes the light
 * toggle on this page mean anything.
 */
export const TRACK_ACCENT_VAR: Record<string, string> = {
  SENSE: "var(--color-status-green)",
  ACT: "var(--color-command-gold)",
  POWER: "var(--color-alert-red)",
  COMMS: "var(--color-signal-blue)",
};

export function accentFor(p: PathCell): string {
  if (p.isPrimary) return "var(--color-command-gold)";
  return (p.track ? TRACK_ACCENT_VAR[p.track] : undefined) ?? "var(--color-gold-dim)";
}

export function chipFor(p: PathCell, signedIn: boolean): string {
  if (signedIn && p.done > 0) return `${p.done}/${p.total} done`;
  return p.isBench ? `${p.total} tools` : `${p.total} courses`;
}

export function eyebrowFor(p: PathCell): string {
  if (p.isPrimary) return "★ Flagship";
  return p.track ?? (p.isBench ? "Bench" : "Path");
}
