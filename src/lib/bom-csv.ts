// WS3: Pure CSV → BOM-row parser. No DB, no React.
// Header row required: refDes, manufacturer, mpn, quantity (mandatory);
// unitPrice, altMpn, altManufacturer, notes (optional); extra columns ignored.
// Rows are 1-indexed by source line (header = row 1, first data row = row 2).

export interface ParsedBomRow {
  refDes: string; // normalized comma-joined, no spaces
  manufacturer: string;
  mpn: string;
  quantity: number;
  unitPriceCents: number | null;
  altMpn: string | null;
  altManufacturer: string | null;
  notes: string | null;
}

export interface RowError {
  row: number; // 1-indexed source line
  message: string;
}

export interface ParseResult {
  rows: ParsedBomRow[];
  errors: RowError[];
}

const REQUIRED = ["refDes", "manufacturer", "mpn", "quantity"] as const;
const OPTIONAL = ["unitPrice", "altMpn", "altManufacturer", "notes"] as const;
const ALL_COLUMNS = [...REQUIRED, ...OPTIONAL] as const;

// Split a single CSV line into fields, honoring double-quoted fields:
// commas inside quotes are literal; "" is an escaped quote.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

export function parseBomCsv(text: string): ParseResult {
  // Split into lines (handle \r\n and \n).
  const allLines = text.split(/\r\n|\n/);
  // Drop a single trailing empty line (e.g. a file ending in a newline).
  if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
    allLines.pop();
  }

  // Find the first non-empty line (the header) and remember its line number.
  let headerLineNo = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i]!.trim() !== "") {
      headerLineNo = i;
      break;
    }
  }

  if (headerLineNo === -1) {
    return { rows: [], errors: [{ row: 1, message: "empty CSV: no header row" }] };
  }

  // Map header names (case-insensitive) to column indices.
  const headerFields = splitCsvLine(allLines[headerLineNo]!).map((h) => h.trim());
  const colIndex: Record<string, number> = {};
  for (const canonical of ALL_COLUMNS) {
    const idx = headerFields.findIndex(
      (h) => h.toLowerCase() === canonical.toLowerCase(),
    );
    if (idx !== -1) colIndex[canonical] = idx;
  }

  const missing = REQUIRED.filter((c) => colIndex[c] === undefined);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: `missing required column(s): ${missing.join(", ")}` }],
    };
  }

  const rows: ParsedBomRow[] = [];
  const errors: RowError[] = [];

  const cellAt = (fields: string[], col: string): string => {
    const idx = colIndex[col];
    if (idx === undefined) return "";
    return (fields[idx] ?? "").trim();
  };

  for (let i = headerLineNo + 1; i < allLines.length; i++) {
    const raw = allLines[i]!;
    // 1-indexed source line number.
    const rowNo = i + 1;
    // Skip fully blank lines.
    if (raw.trim() === "") continue;

    const fields = splitCsvLine(raw);

    const manufacturer = cellAt(fields, "manufacturer");
    const mpn = cellAt(fields, "mpn");
    const refDesRaw = cellAt(fields, "refDes");
    const quantityRaw = cellAt(fields, "quantity");
    const unitPriceRaw = cellAt(fields, "unitPrice");
    const altMpnRaw = cellAt(fields, "altMpn");
    const altManufacturerRaw = cellAt(fields, "altManufacturer");
    const notesRaw = cellAt(fields, "notes");

    const rowErrors: string[] = [];

    // quantity must parse to a positive integer.
    let quantity = NaN;
    if (!/^\d+$/.test(quantityRaw) || (quantity = Number.parseInt(quantityRaw, 10)) <= 0) {
      rowErrors.push(`invalid quantity "${quantityRaw}" (must be a positive integer)`);
    }

    // unitPrice blank → null; else round(parseFloat * 100); negative/NaN → error.
    let unitPriceCents: number | null = null;
    if (unitPriceRaw !== "") {
      const n = Number.parseFloat(unitPriceRaw);
      if (!Number.isFinite(n) || n < 0) {
        rowErrors.push(`invalid unitPrice "${unitPriceRaw}"`);
      } else {
        unitPriceCents = Math.round(n * 100);
      }
    }

    // refDes split on commas AND whitespace, trim each segment, re-join with commas.
    // Split on commas first, then expand any whitespace within each token
    // (whitespace-separated refs like "R1 R2"). Every piece is trimmed. A blank
    // segment (empty cell, trailing comma "R1,", double comma "R1,,R2", or
    // "R1, , R2") is a hard error: it would make the emitted comma-count diverge
    // from the validated count, which the DB CHECK / zod refine then reject.
    const refDesParts = refDesRaw
      .split(",")
      .flatMap((token) => token.trim().split(/\s+/))
      .map((s) => s.trim());
    if (refDesParts.some((s) => s.length === 0)) {
      rowErrors.push(`refDes has an empty designator segment`);
    }
    const refDes = refDesParts.join(",");

    // Count guard compares the SAME segment list to quantity, so the emitted
    // comma-count always equals the validated count (only meaningful when valid).
    if (Number.isInteger(quantity) && quantity > 0 && refDesParts.length !== quantity) {
      rowErrors.push(`refDes count ${refDesParts.length} ≠ quantity ${quantity}`);
    }

    if (rowErrors.length > 0) {
      for (const message of rowErrors) errors.push({ row: rowNo, message });
      continue; // exclude rows with any error
    }

    rows.push({
      refDes,
      manufacturer,
      mpn,
      quantity,
      unitPriceCents,
      altMpn: altMpnRaw === "" ? null : altMpnRaw,
      altManufacturer: altManufacturerRaw === "" ? null : altManufacturerRaw,
      notes: notesRaw === "" ? null : notesRaw,
    });
  }

  return { rows, errors };
}
