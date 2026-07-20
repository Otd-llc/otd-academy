import type { ContentBlock } from "@/lib/schemas/guide";

// The signpost vocabulary shared by the guide renderer, the PDF renderer and the
// island scan. Colours resolve through CSS custom properties, never literal hex,
// so every signpost flips under the `[data-theme="light"]` token override.
//
// The old inline MODE_STYLE map used literal hex (#4a8fff / #c8963e / #8fe3a0),
// which is why the pre-2026-07-20 mode band could not re-theme and the check band
// washed out on ivory. #8fe3a0 was not a palette value at all.

export const MODES = ["orient", "do", "check"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_VAR: Record<Mode, string> = {
  orient: "var(--color-signal-blue)",
  do: "var(--color-command-gold)",
  check: "var(--color-status-green)",
};

export const MODE_TEXT: Record<Mode, string> = {
  orient: "text-signal-blue",
  do: "text-command-gold",
  check: "text-status-green",
};

export interface ParsedModeLabel {
  mode: Mode;
  /** Where the learner's hands are ("in KiCad", "at the bench"). Null for read/verify bands. */
  venue: string | null;
  title: string;
}

function isMode(s: string): s is Mode {
  return (MODES as readonly string[]).includes(s);
}

/**
 * Parse `Mode · <mode> · [venue ·] <title>`.
 *
 * The venue is recognised by CONTENT, not position: a third segment counts as a
 * venue only when it opens with a preposition ("in …", "at …", "on …"), because
 * the authored corpus writes venues that way and titles never do. Positional
 * parsing is what shipped "in KiCad · Build it, island by island" into the Bebas
 * display title on every SCHEMATIC band.
 */
const VENUE_RE = /^(in|at|on|with)\s+\S/i;

export function parseModeLabel(label: string): ParsedModeLabel | null {
  const parts = label.split("·").map((s) => s.trim());
  if (parts.length < 3 || !/^mode$/i.test(parts[0])) return null;
  const word = parts[1].toLowerCase();
  const mode: Mode = isMode(word) ? word : "do";
  const hasVenue = parts.length >= 4 && VENUE_RE.test(parts[2]);
  return {
    mode,
    venue: hasVenue ? parts[2] : null,
    title: (hasVenue ? parts.slice(3) : parts.slice(2)).join(" · "),
  };
}

/**
 * Map of block index → this band's position among the card's mode bands.
 * The band renders `[ do 02 / 06 ]`, and "of" is per CARD (a stage), which is the
 * unit a learner experiences as "how much of this is left".
 */
export function scanModeBands(
  blocks: ContentBlock[],
): Map<number, { ord: number; of: number }> {
  const idx: number[] = [];
  blocks.forEach((b, i) => {
    if (b.type === "callout" && parseModeLabel(b.label)) idx.push(i);
  });
  const out = new Map<number, { ord: number; of: number }>();
  idx.forEach((blockIndex, n) => out.set(blockIndex, { ord: n + 1, of: idx.length }));
  return out;
}

// MIL-STD-38784 §4.8.10 runs a three-rung alert ladder (NOTE / CAUTION / WARNING),
// each rung visually distinct. Our `severity` field already carries three values
// and rendered one, which is why a bare "Gotcha" read as weightless: it was the
// middle rung with nothing above or below it.
export const RUNGS = ["note", "caution", "warning"] as const;
export type Rung = (typeof RUNGS)[number];

const RUNG_WORD: Record<Rung, string> = {
  note: "Note",
  caution: "Gotcha",
  warning: "Warning",
};

// All THREE rung words are accepted as the label prefix, not just "Gotcha".
// A `Gotcha`-only prefix cannot express the other two rungs, and it produces an
// author-hostile contradiction: ASSEMBLY's critical safety callout would have to be
// labelled "Gotcha · a soldering iron never looks hot" while RENDERING the word
// "Warning". The author writes the word they mean; `severity` still decides the
// rung, so the two can never disagree on colour and shape.
// A headline is REQUIRED for every word except the legacy bare "Gotcha".
//
// Why: `defaultBlock("callout")` (src/lib/guide-block-defaults.ts) emits
// `label: "Note"`. A pattern that claimed a bare rung word would turn EVERY newly
// inserted callout in the editor into a headline-less Note-rung alert the moment an
// author adds one. The bare-Gotcha allowance exists only because four of them are
// in the corpus right now; Task 11 removes them, after which the `?` can go.
//
// The separator is `·` ONLY, never `:`. Real labels are full of colons ("First
// power-on: a charger, not your laptop"), and `·` is the house separator, so
// restricting to it removes a whole class of false claim.
const ALERT_LABEL_RE = /^(?:(gotcha)|(?:(gotcha|warning|note|caution)\s*·\s*(.+)))$/i;

export function parseAlertLabel(
  label: string,
  severity: "critical" | "warn" | "info",
): { rung: Rung; word: string; headline: string | null } | null {
  const m = label.trim().match(ALERT_LABEL_RE);
  if (!m) return null;
  const rung: Rung =
    severity === "critical" ? "warning" : severity === "info" ? "note" : "caution";
  return { rung, word: RUNG_WORD[rung], headline: m[3]?.trim() || null };
}

// A CLOSED verb set on purpose. The corpus grew an implicit `Verb ·` convention and
// applied it about half the time ("KiCad 10 · PCB-editor keys" vs "The KiCad 10 keys
// you'll use" are the same thing written two ways). A closed set means an unlisted
// verb degrades to the generic callout instead of silently joining the family.
// `Setup` is deliberately ABSENT: GuideBlocks absorbs a `Setup · …` callout into the
// SetupBand summary and never renders it as a block, so listing it here would be
// dead code that reads as working.
// `Route it` is absent too: it is a Do wearing an aside's clothes, and Phase 5
// relabels it rather than the aside family absorbing it.
export const ASIDE_VERBS = ["Keys", "Alternative"] as const;
export type AsideVerb = (typeof ASIDE_VERBS)[number];

export function parseAsideLabel(
  label: string,
): { verb: AsideVerb; headline: string } | null {
  const [head, ...rest] = label.split("·").map((s) => s.trim());
  if (!rest.length) return null;
  const verb = ASIDE_VERBS.find((v) => v.toLowerCase() === head.toLowerCase());
  if (!verb) return null;
  return { verb, headline: rest.join(" · ") };
}
