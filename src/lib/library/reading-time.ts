// Estimated reading time for a Library lesson, derived from its contentBlocks.
//
// Not a measured metric — a merchandising signal that sets the reader's
// expectation ("this is a short read") so they are likelier to click through.
// Computed from the prose word count at an average adult reading speed, and
// deterministic: the same content always yields the same number.
//
// PURE + DEFENSIVE over the raw JSON (contentBlocks is Prisma `Json`, unknown
// shape at runtime). It walks any block tree collecting the text of the
// prose-bearing fields across the Library block types (prose/heading/callout/
// steps/table/quiz/deepDive/…), so it degrades gracefully if a block drifts
// rather than throwing on the public landing.

const WORDS_PER_MINUTE = 200;

// Object keys whose STRING value is prose the reader reads.
const PROSE_KEYS = new Set([
  "md", "text", "body", "summary", "label", "sublabel", "caption",
  "title", "term", "prompt", "q", "explain", "intro", "note", "plain",
]);
// Keys whose value is an array of prose STRINGS (not wrapping objects).
const STRING_ARRAY_KEYS = new Set(["items", "columns", "options"]);

function collect(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string") {
      if (PROSE_KEYS.has(key)) out.push(value);
    } else if (Array.isArray(value)) {
      if (STRING_ARRAY_KEYS.has(key)) {
        for (const s of value) if (typeof s === "string") out.push(s);
      } else {
        for (const item of value) collect(item, out);
      }
    } else if (value && typeof value === "object") {
      collect(value, out);
    }
  }
}

// Count words in a chunk of (possibly markdown) prose. Strips URLs + the common
// markdown / inline-glossary punctuation so link targets and `**` / `[[ ]]`
// markers don't inflate the count, then splits on whitespace.
function countWords(text: string): number {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_`~|]+/g, " ")
    .replace(/\[\[|\]\]/g, " ")
    .replace(/[[\]()]/g, " ");
  return cleaned.trim().split(/\s+/).filter(Boolean).length;
}

// Whole-minute estimate, floored at 1 so nothing ever reads "0 min".
export function readingMinutes(contentBlocks: unknown): number {
  const chunks: string[] = [];
  collect(contentBlocks, chunks);
  const words = chunks.reduce((sum, c) => sum + countWords(c), 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
