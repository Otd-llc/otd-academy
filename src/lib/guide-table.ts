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
