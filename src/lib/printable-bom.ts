// Pure roll-up for the learner's printable BOM (the bench shopping/checklist
// sheet at /projects/[slug]/[revLabel]/guide/bom). Sorts lines by reference
// designator in natural order (C1 < R2 < R10, not lexical) and totals the line
// count + part count. Kept pure (no Prisma) so it's unit-testable; the print RSC
// resolves the BomLine+Part rows and hands them in.

export interface PrintableBomRow {
  refDes: string;
  qty: number;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  datasheetUrl: string | null;
  lifecycle: "ACTIVE" | "NRND" | "EOL" | "OBSOLETE";
}

export interface PrintableBom {
  lines: PrintableBomRow[];
  lineCount: number;
  totalParts: number;
}

// Natural sort key from the first refDes token: ["R", 10] sorts after ["R", 2].
function refKey(refDes: string): [string, number] {
  const first = refDes.split(",")[0]?.trim() ?? "";
  const m = first.match(/^([A-Za-z]+)(\d+)/);
  return m ? [m[1].toUpperCase(), parseInt(m[2], 10)] : [first.toUpperCase(), 0];
}

export function summarizePrintableBom(rows: PrintableBomRow[]): PrintableBom {
  const lines = [...rows].sort((a, b) => {
    const [pa, na] = refKey(a.refDes);
    const [pb, nb] = refKey(b.refDes);
    return pa === pb ? na - nb : pa.localeCompare(pb);
  });
  return {
    lines,
    lineCount: lines.length,
    totalParts: lines.reduce((sum, r) => sum + r.qty, 0),
  };
}
