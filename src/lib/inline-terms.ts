// Inline glossary-term markup for guide prose/callout text.
//
// Authors mark a jargon word with a wiki-style marker so it renders as an inline
// GlossaryTerm popover instead of plain text:
//   [[refdes]]            → trigger + label "refdes", looked up as "refdes"
//   [[Rd|the 5.1 kΩ Rd]]  → looked up as "Rd", but the visible label is the
//                            right-hand side
//
// This module is PURE (no React, no DOM): it splits a string into ordered
// segments the renderer maps to text nodes / <GlossaryTerm>. Keeping it pure
// makes the tokenizer unit-testable in isolation and importable from the server
// `GuideBlocks` renderer. Unknown terms still degrade gracefully — that's the
// GlossaryTerm component's job, not ours.

export type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "term"; term: string; label: string };

// `[[ ... ]]` where the inner run contains no `]` (so a stray `[[` with no
// closing `]]`, or bracketed prose, stays literal). Non-greedy + global.
const TERM_RE = /\[\[([^\]]+?)\]\]/g;

/**
 * Split `text` into ordered text / term segments on `[[term]]` /
 * `[[term|label]]` markers. A marker with an empty term (e.g. `[[|x]]`) is left
 * as literal text. Returns `[]` for an empty string and never emits an empty
 * text segment.
 */
export function parseInlineTerms(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  TERM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_RE.exec(text)) !== null) {
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const term = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    // Empty term → not a real marker; leave the raw text in place (we simply
    // don't advance `last`, so it falls into the surrounding text slice).
    if (!term) continue;
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim() || term;
    if (m.index > last) {
      segments.push({ kind: "text", value: text.slice(last, m.index) });
    }
    segments.push({ kind: "term", term, label });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments;
}
