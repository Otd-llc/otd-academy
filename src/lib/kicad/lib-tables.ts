// KiCad library-table emitters (export-engine Task 4, design §3.2).
//
// PURE (no React/DB/env/network/fs). Emit the project-local `sym-lib-table`
// and `fp-lib-table` index files that tell KiCad where the bundled symbol /
// footprint libraries live, addressed via `${KIPRJMOD}` (the project dir) so
// the zip is relocatable on the learner's machine.
//
// These two files use KiCad's CANONICAL lib-table layout, which is NOT the
// general pretty-printed S-expr shape: each row is a single line with the
// sub-fields packed with NO separating space —
//   (lib (name "X")(type "KiCad")(uri "${KIPRJMOD}/libs/X")(options "")(descr ""))
// — matching what KiCad itself writes. We therefore template these directly
// (with proper quote/backslash escaping) rather than route them through the
// general serializer, so the output matches a KiCad-written table byte-for-byte
// and diffs cleanly at manual acceptance.
//
// Target format KiCad 10. The lib-table `(version 7)` is the value KiCad 8–10
// emit; bump if a KiCad-10 reference table shows otherwise at acceptance.

import { escapeString } from "@/lib/kicad/sexpr";

const LIB_TABLE_VERSION = 7;

export type LibTableEntry = {
  /** Library nickname (the `<nick>` half of a `<nick>:<item>` reference). */
  nick: string;
  /** Project-local file/dir under `libs/` (e.g. `proj.kicad_sym`, `proj.pretty`). */
  file: string;
  /** Optional human description; defaults to "". */
  descr?: string;
};

function renderRow(entry: LibTableEntry): string {
  const nick = escapeString(entry.nick);
  const uri = escapeString(`\${KIPRJMOD}/libs/${entry.file}`);
  const descr = escapeString(entry.descr ?? "");
  return `  (lib (name "${nick}")(type "KiCad")(uri "${uri}")(options "")(descr "${descr}"))`;
}

function renderTable(headKeyword: string, entries: LibTableEntry[]): string {
  const lines = [
    `(${headKeyword}`,
    `  (version ${LIB_TABLE_VERSION})`,
    ...entries.map(renderRow),
    `)`,
  ];
  return lines.join("\n") + "\n";
}

/**
 * The `sym-lib-table` file body: a `(sym_lib_table ...)` with one `(lib ...)`
 * row per entry, each URI pointing at `${KIPRJMOD}/libs/<file>` (the bundled
 * `.kicad_sym`). One trailing newline.
 */
export function buildSymLibTable(entries: LibTableEntry[]): string {
  return renderTable("sym_lib_table", entries);
}

/**
 * The `fp-lib-table` file body: a `(fp_lib_table ...)` with one `(lib ...)`
 * row per entry, each URI pointing at `${KIPRJMOD}/libs/<file>` (the bundled
 * `.pretty` footprint dir). One trailing newline.
 */
export function buildFpLibTable(entries: LibTableEntry[]): string {
  return renderTable("fp_lib_table", entries);
}
