// Pure helpers for the table content-block editor (Task 3).
//
// The table block stores `rows: Cell[][]` and `columns: string[]`. The editor
// must keep every row RECTANGULAR to `columns.length` so the rendered
// `<table>` (GuideBlocks) never has ragged rows and the saved JSON matches the
// schema's intent. These helpers are framework-free + side-effect-free so they
// can be unit-tested without a DOM harness; TableBlockEditor calls them on
// every column add/remove.
import type { ContentBlock } from "@/lib/schemas/guide";

// The cell shape of a table block (schema `cellSchema`). Extracted so both the
// editor and these helpers share one source of truth.
export type TableCell = Extract<ContentBlock, { type: "table" }>["rows"][number][number];

/** A fresh, schema-valid empty cell (plain `{text}`, no optional keys). */
export function emptyCell(): TableCell {
  return { text: "" };
}

/**
 * Force every row to exactly `columnCount` cells: truncate rows that are too
 * long and pad short rows with fresh empty cells. Returns a NEW array (and new
 * row arrays for any row that changed) — never mutates the input. `columnCount`
 * is clamped to a minimum of 1 (a table always has at least one column).
 */
export function resizeRows(
  rows: readonly (readonly TableCell[])[],
  columnCount: number,
): TableCell[][] {
  const width = Math.max(1, Math.floor(columnCount));
  return rows.map((row) => {
    if (row.length === width) return [...row];
    if (row.length > width) return row.slice(0, width);
    const padded = [...row];
    while (padded.length < width) padded.push(emptyCell());
    return padded;
  });
}

/**
 * Drop optional keys that have fallen empty so a plain cell is exactly
 * `{text}` (matches the schema's optional `decoration`/`tone`). A non-badge
 * decoration never carries a tone. A `badge` decoration ALWAYS carries a tone:
 * an existing tone is preserved, otherwise `'gold'` is injected so the saved
 * data matches the controlled `<select value={cell.tone ?? 'gold'}>` the editor
 * shows (no UI/data mismatch).
 */
export function normalizeCell(cell: TableCell): TableCell {
  const next: TableCell = { text: cell.text };
  if (cell.decoration) {
    next.decoration = cell.decoration;
    if (cell.decoration === "badge") next.tone = cell.tone ?? "gold";
  }
  return next;
}

/**
 * Pure form of the editor's decoration `<select>` change: given a cell and the
 * selected decoration value, return the next cell. `''` ("none") strips
 * decoration AND tone → a plain `{text}` cell; `badge` keeps an existing tone or
 * defaults to `'gold'`; `ref`/`mpn` carry no tone, so any stray tone is dropped.
 */
export function applyCellDecoration(cell: TableCell, value: string): TableCell {
  if (value === "") return { text: cell.text };
  const decoration = value as NonNullable<TableCell["decoration"]>;
  if (decoration === "badge") {
    return { text: cell.text, decoration, tone: cell.tone ?? "gold" };
  }
  return { text: cell.text, decoration };
}

/**
 * Bounds-checked adjacent swap inside an array. Returns a NEW array with the
 * element at `index` swapped with its neighbour in direction `dir` (-1 = up/
 * earlier, 1 = down/later). If the swap would land out of bounds the original
 * array is returned UNCHANGED (a fresh reference is only created on a real
 * move). Never mutates the input.
 */
export function moveWithin<T>(arr: readonly T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (j < 0 || j >= arr.length) return [...arr];
  const next = [...arr];
  [next[index], next[j]] = [next[j]!, next[index]!];
  return next;
}
