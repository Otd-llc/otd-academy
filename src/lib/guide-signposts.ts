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
