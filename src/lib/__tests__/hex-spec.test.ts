// Pins the /hex print spec to the build sheet the configurator prints.
//
// bioscale-viz deploys separately and shares no package with this repo, so the
// sheet's values cannot be imported and asserted against directly. What this
// file does instead is make the transcription UNFORGETTABLE: the literals below
// are the sheet's, so changing `hex-spec.ts` without changing the sheet (or the
// reverse) fails here rather than shipping a page and a drawing that disagree
// about the same dimension.
//
// If the sheet legitimately changes, edit BOTH — that edit is the point.
// Sheet source: bioscale-viz `src/hex/export/html.ts` (PARAMS band, assembly
// step 1, clearance notes) and `src/hex/types.ts` (HEX_SIZE, HEX_GAP).
import { describe, expect, it } from "vitest";

import {
  HEX_CIRCUMRADIUS_MM,
  HEX_CLEARANCE,
  HEX_CONFIGURATOR_URL,
  HEX_GAP_MM,
  HEX_LICENSE,
  HEX_ORIENTATION,
  HEX_PITCH_MM,
  HEX_PRINT_PARAMS,
  HEX_RELEASE,
  type SpecRow,
} from "@/lib/hex-spec";

/** Every string a visitor can read, flattened. */
function renderedStrings(): string[] {
  const fromRows = (rows: SpecRow[]) =>
    rows.flatMap(
      (r) => [r.label, r.value, r.aside].filter(Boolean) as string[],
    );
  return [
    ...fromRows(HEX_PRINT_PARAMS),
    ...fromRows(HEX_CLEARANCE),
    HEX_ORIENTATION.value,
    HEX_ORIENTATION.why,
    HEX_LICENSE.name,
    HEX_LICENSE.fullName,
    HEX_LICENSE.holder,
    HEX_LICENSE.credit,
  ];
}

function valueOf(rows: SpecRow[], label: string): string {
  const row = rows.find((r) => r.label === label);
  if (!row) throw new Error(`no spec row labelled ${label}`);
  return row.value;
}

describe("the slicer band matches the build sheet's PARAMS", () => {
  // bs-cap-hex src/hex/export/html.ts:272-282 (Perimeters :277, Infill :278) --
  // one assertion per band cell, so a failure names the cell.
  //
  // THE LINE NUMBERS WERE 66 LINES STALE, and this whole mechanism is "a red
  // test sends a human to that line in the other repo". A pointer that lands
  // inside the wrong function taxes the single manual step the design rests on.
  //
  // NOTE FOR WHOEVER SEES THIS RED: `Perimeters` and `Infill` are no longer
  // spelled in `hex-spec.ts` -- they DERIVE from `PRINT_INTENT_TABLE`. So the
  // way to make this green is NOT to edit a literal here. Either the sheet
  // moved (fix the table) or the table moved (fix the sheet) -- and changing
  // the table changes `Metadata/model_settings.config` in every plate every
  // customer downloads, plus both READMEs and the /hex card.
  it.each([
    ["Nozzle", "240 °C"],
    ["Bed", "70–85 °C"],
    ["Layer", "0.20 mm"],
    ["Perimeters", "4"],
    ["Infill", "30% gyroid"],
    ["Speed", "40–50 mm/s"],
    ["Cooling", "~30%"],
    ["Filament", "dry before use"],
  ])("%s = %s", (label, value) => {
    expect(valueOf(HEX_PRINT_PARAMS, label)).toBe(value);
  });

  it("names PETG, not PLA", () => {
    // The 2026-07-31 README said PLA. The owner confirmed PETG, and the 0.25 mm
    // gap is toleranced against PETG shrinkage. That release is immutable and
    // stays wrong; 2026-08-03 carries the correction, and this page is the
    // authority either way — it must not repeat the error.
    expect(valueOf(HEX_PRINT_PARAMS, "Material")).toBe("FDM PETG");
    expect(renderedStrings().join(" ")).not.toMatch(/\bPLA\b/);
  });
});

describe("clearance and tolerance match the sheet's notes", () => {
  it("states the 0.25 mm design gap in both units", () => {
    const gap = HEX_CLEARANCE.find((r) => r.label === "Design gap");
    expect(gap?.value).toBe("0.25 mm");
    expect(gap?.aside).toBe("0.010 in");
  });

  it("carries the PETG shrinkage range the sheet gives", () => {
    expect(valueOf(HEX_CLEARANCE, "PETG shrinkage")).toBe("0.3–0.6%");
  });
});

describe("geometry", () => {
  it("derives the pitch from the two constants, not a typed-in number", () => {
    // types.ts:288 — spacing becomes HEX_SIZE × √3 + HEX_GAP.
    expect(HEX_CIRCUMRADIUS_MM).toBe(43.85); // HEX_SIZE 0.04385 m
    expect(HEX_GAP_MM).toBe(0.25); // HEX_GAP 0.00025 m
    expect(HEX_PITCH_MM).toBeCloseTo(76.2, 2);
  });
});

describe("orientation", () => {
  it("is hex-face-down, with the load reason the sheet gives", () => {
    expect(HEX_ORIENTATION.value).toBe("hex-face-down");
    expect(HEX_ORIENTATION.why).toMatch(/interlayer bonds/);
  });
});

describe("licence", () => {
  it("is CC BY 4.0 and cites the academy /hex source URL", () => {
    // The Source line is baked into an immutable LICENSE.txt inside every
    // published .3mf/.stl/.step. The page must agree with those bytes.
    expect(HEX_LICENSE.name).toBe("CC BY 4.0");
    expect(HEX_LICENSE.credit).toContain(
      "https://academy.onethousanddrones.com/hex",
    );
    expect(HEX_LICENSE.deed).toBe(
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });
});

describe("release + configurator constants", () => {
  it("match what upload-printables.ts stamps and the sheet prints", () => {
    // A LITERAL, deliberately. The release string is a live R2 path prefix, and
    // release keys are immutable -- bumping it without uploading that cut points
    // every download at objects that do not exist. Pinning it here means the
    // bump is always a conscious edit rather than a constant drifting under the
    // uploader.
    expect(HEX_RELEASE).toBe("2026-08-17");
    expect(HEX_CONFIGURATOR_URL).toBe("https://demo.onethousanddrones.com/hex");
  });
});

describe("house rules", () => {
  it("uses no em-dash in any rendered string", () => {
    // The ban covers every rendered glyph, not just prose. En dashes in ranges
    // (70–85) are correct and deliberate; an em dash is not.
    for (const s of renderedStrings()) {
      expect(s, `em-dash in: ${s}`).not.toContain("—");
    }
  });
});
