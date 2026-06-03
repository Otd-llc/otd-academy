// Pure helper for the inline guide-card editor's per-block error surfacing.
//
// `saveGuideCard`'s field errors are keyed by the Zod issue path, prefixed with
// `contentBlocks.` (e.g. `contentBlocks.0.label`, or a bare `contentBlocks.2`).
// `collectBlockErrors` pulls every message that targets block index `i`,
// stripping the `contentBlocks.<i>.` prefix so the surfaced message names the
// offending sub-field. Framework-free + side-effect-free so it can be
// unit-tested without a DOM harness.

/**
 * Collect every field-error message that targets the block at index `i`.
 *
 * A key matches when it is exactly `contentBlocks.<i>` (a bare block-level
 * error) or starts with `contentBlocks.<i>.` (a sub-field error). The trailing
 * dot in the prefix-match guards the index boundary so index `1` does NOT match
 * `contentBlocks.10.*`. The `contentBlocks.<i>.` portion is stripped from each
 * surfaced message so it names the offending sub-field; a bare block-level error
 * is surfaced verbatim. Returns `[]` for `undefined` input.
 */
export function collectBlockErrors(
  fieldErrors: Record<string, string[]> | undefined,
  i: number,
): string[] {
  if (!fieldErrors) return [];
  const prefix = `contentBlocks.${i}`;
  const out: string[] = [];
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (key === prefix || key.startsWith(`${prefix}.`)) {
      const sub = key.slice(prefix.length).replace(/^\./, "");
      for (const msg of messages) out.push(sub ? `${sub}: ${msg}` : msg);
    }
  }
  return out;
}
