"use client";

// Per-type editor for the `table` content block (Task 3 — the heavy one, in
// its own file per design §6). CONTROLLED: it holds no state of its own; every
// edit produces a fresh block and calls `onChange`.
//
// Invariants kept on every mutation:
//   - rows stay RECTANGULAR to `columns.length` (resizeRows pads/truncates on
//     column add/remove — see `src/lib/guide-table.ts`, unit-tested);
//   - a cell's optional `decoration`/`tone` keys are OMITTED when not set, so a
//     plain cell is `{text}` and matches the schema's optional fields (the
//     "badge" tone select only renders, and only writes `tone`, for badges);
//   - at least one column and one row always remain (the schema requires
//     `columns` min-length 1; an empty grid is meaningless).

import { useId } from "react";
import type { ContentBlock } from "@/lib/schemas/guide";
import { IconButton } from "@/components/IconButton";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { resizeRows, type TableCell } from "@/lib/guide-table";

type TableBlock = Extract<ContentBlock, { type: "table" }>;
type Decoration = NonNullable<TableCell["decoration"]>;
type Tone = NonNullable<TableCell["tone"]>;

const DECORATIONS: Decoration[] = ["ref", "mpn", "badge"];
const TONES: Tone[] = ["gold", "blue", "critical", "dim"];

const inputClass =
  "w-full rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const selectClass =
  "rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const labelClass =
  "block font-mono text-xs uppercase tracking-wider text-muted";

export function TableBlockEditor({
  block,
  onChange,
}: {
  block: TableBlock;
  onChange: (next: ContentBlock) => void;
}) {
  const baseId = useId();
  const { columns, rows } = block;

  // --- column ops (keep rows rectangular via resizeRows) ----------------
  function setColumnName(i: number, name: string) {
    const nextCols = columns.map((c, ci) => (ci === i ? name : c));
    onChange({ ...block, columns: nextCols });
  }
  function addColumn() {
    const nextCols = [...columns, `Column ${columns.length + 1}`];
    onChange({ ...block, columns: nextCols, rows: resizeRows(rows, nextCols.length) });
  }
  function removeColumn(i: number) {
    if (columns.length <= 1) return; // schema requires >= 1 column
    const nextCols = columns.filter((_, ci) => ci !== i);
    // Drop the matching cell from every row, then re-rectangularize defensively.
    const trimmed = rows.map((row) => row.filter((_, ci) => ci !== i));
    onChange({
      ...block,
      columns: nextCols,
      rows: resizeRows(trimmed, nextCols.length),
    });
  }

  // --- row ops ----------------------------------------------------------
  function addRow() {
    const newRow = resizeRows([[]], columns.length)[0]!;
    onChange({ ...block, rows: [...rows, newRow] });
  }
  function removeRow(ri: number) {
    onChange({ ...block, rows: rows.filter((_, i) => i !== ri) });
  }

  // --- cell ops (omit optional keys when unset) -------------------------
  function updateCell(ri: number, ci: number, patch: Partial<TableCell>) {
    const nextRows = rows.map((row, r) =>
      r === ri
        ? row.map((cell, c) => (c === ci ? normalizeCell({ ...cell, ...patch }) : cell))
        : row,
    );
    onChange({ ...block, rows: nextRows });
  }
  function setCellText(ri: number, ci: number, text: string) {
    updateCell(ri, ci, { text });
  }
  function setCellDecoration(ri: number, ci: number, value: string) {
    const writeCell = (build: (c: TableCell) => TableCell) =>
      onChange({
        ...block,
        rows: rows.map((row, r) =>
          r === ri ? row.map((c, ci2) => (ci2 === ci ? build(c) : c)) : row,
        ),
      });
    if (value === "") {
      // "none": strip decoration AND tone → a plain {text} cell.
      writeCell((c) => ({ text: c.text }));
      return;
    }
    const decoration = value as Decoration;
    if (decoration === "badge") {
      // Badges keep a tone (default gold).
      writeCell((c) => ({ text: c.text, decoration, tone: c.tone ?? "gold" }));
    } else {
      // ref/mpn carry no tone — drop it.
      writeCell((c) => ({ text: c.text, decoration }));
    }
  }
  function setCellTone(ri: number, ci: number, value: string) {
    updateCell(ri, ci, { tone: value as Tone });
  }

  return (
    <div className="space-y-3">
      {/* Columns */}
      <fieldset>
        <legend className={labelClass}>Columns</legend>
        <div className="mt-1 space-y-1.5">
          {columns.map((col, i) => {
            const id = `${baseId}-col-${i}`;
            return (
              <div key={i} className="flex items-center gap-1">
                <label htmlFor={id} className="sr-only">
                  Column {i + 1} heading
                </label>
                <input
                  id={id}
                  type="text"
                  value={col}
                  onChange={(e) => setColumnName(i, e.target.value)}
                  className={inputClass}
                />
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Remove column"
                  ariaLabel={`Remove column ${i + 1}`}
                  disabled={columns.length <= 1}
                  onClick={() => removeColumn(i)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            );
          })}
        </div>
        <div className="mt-1">
          <IconButton
            type="button"
            hint="Add column"
            ariaLabel="Add column"
            onClick={addColumn}
          >
            <PlusIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </fieldset>

      {/* Rows */}
      <fieldset>
        <legend className={labelClass}>Rows</legend>
        <div className="mt-1 space-y-2">
          {rows.map((row, ri) => (
            <div
              key={ri}
              className="flex items-start gap-2 border-l border-panel-border pl-2"
            >
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
                {row.map((cell, ci) => {
                  const textId = `${baseId}-r${ri}-c${ci}-text`;
                  const decoId = `${baseId}-r${ri}-c${ci}-deco`;
                  const toneId = `${baseId}-r${ri}-c${ci}-tone`;
                  return (
                    <div key={ci} className="flex flex-col gap-1">
                      <label htmlFor={textId} className="sr-only">
                        Row {ri + 1}, {columns[ci] ?? `column ${ci + 1}`} cell
                      </label>
                      <input
                        id={textId}
                        type="text"
                        value={cell.text}
                        onChange={(e) => setCellText(ri, ci, e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex items-center gap-1">
                        <label htmlFor={decoId} className="sr-only">
                          Row {ri + 1}, column {ci + 1} decoration
                        </label>
                        <select
                          id={decoId}
                          value={cell.decoration ?? ""}
                          onChange={(e) =>
                            setCellDecoration(ri, ci, e.target.value)
                          }
                          className={selectClass}
                        >
                          <option value="">none</option>
                          {DECORATIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        {cell.decoration === "badge" ? (
                          <>
                            <label htmlFor={toneId} className="sr-only">
                              Row {ri + 1}, column {ci + 1} badge tone
                            </label>
                            <select
                              id={toneId}
                              value={cell.tone ?? "gold"}
                              onChange={(e) =>
                                setCellTone(ri, ci, e.target.value)
                              }
                              className={selectClass}
                            >
                              {TONES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <IconButton
                type="button"
                tone="danger"
                hint="Remove row"
                ariaLabel={`Remove row ${ri + 1}`}
                disabled={rows.length <= 1}
                onClick={() => removeRow(ri)}
              >
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
        <div className="mt-1">
          <IconButton
            type="button"
            hint="Add row"
            ariaLabel="Add row"
            onClick={addRow}
          >
            <PlusIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </fieldset>
    </div>
  );
}

// Drop optional keys that have fallen empty so a plain cell is exactly
// `{text}` (matches the schema's optional `decoration`/`tone`). A non-badge
// decoration never carries a tone.
function normalizeCell(cell: TableCell): TableCell {
  const next: TableCell = { text: cell.text };
  if (cell.decoration) {
    next.decoration = cell.decoration;
    if (cell.decoration === "badge" && cell.tone) next.tone = cell.tone;
  }
  return next;
}
