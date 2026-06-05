// KiCad export orchestration (export-engine Task 8, design §1, §3).
//
// `buildKicadExportZip(revisionId)` is the pure-ish assembler: it READS the
// revision's BOM + curated part assets (from R2), runs the Task 4–7 generators,
// and zips the §1 output tree into a single `Buffer`. The schematic is emitted
// UNWIRED — no nets, no power ports, no connections — because wiring the canvas
// (power rails included) is the student's lesson; the export never queries
// db.net/db.netNode. It performs NO auth and NO mutation — the `"use server"`
// action (`@/lib/actions/kicad-export`) wraps it with `requireUser`, the R2 PUT
// of the zip, and the `BOM_EXPORT` Artifact row.
//
// R2 reads go through `@/lib/part-r2` (`getR2ObjectText` / `getR2ObjectBytes`) so
// a test can `vi.mock` that module and exercise BOTH the real-asset path (an
// uploaded SYMBOL/FOOTPRINT/MODEL_3D) and the stub path (a missing asset) without
// touching the bucket.
//
// ── refDes EXPANSION (design §1, §2 notes) ──
// A `BomLine.refDes` is comma-joined ("C2,C3,C7" = three physical caps sharing
// ONE part). We expand it into per-INSTANCE designators for placement + the
// schematic (one symbol drawn per designator), while the libraries are built
// per-PART (deduped) since all three instances share one symbol/footprint.
//
// DETERMINISM: everything downstream of the DB read is deterministic (the
// generators are). The only non-determinism is the DB row order, which we
// normalise by sorting BOM lines by (manufacturer, mpn) and designators
// naturally, so the same revision yields a byte-stable tree.

import JSZip from "jszip";

import { db } from "@/lib/db";
import { getR2ObjectText, getR2ObjectBytes } from "@/lib/part-r2";
import { env } from "@/env";
import { pinoutSchema, type Pinout } from "@/lib/schemas/part-fact";

import { buildSymbolLib } from "@/lib/kicad/symbol-lib";
import { setFootprintModelPath } from "@/lib/kicad/footprint-lib";
import { buildSymLibTable, buildFpLibTable } from "@/lib/kicad/lib-tables";
import { buildKicadPro } from "@/lib/kicad/project";
import { gridPlacement } from "@/lib/kicad/placement";
import { buildBasePcb } from "@/lib/kicad/pcb";
import { buildStubSymbol, buildStubFootprint } from "@/lib/kicad/stubs";
import {
  buildExportReport,
  type PartCoverage,
  type AssetStatus,
} from "@/lib/kicad/report";
import {
  buildSchematic,
  type SchematicPart,
} from "@/lib/kicad/schematic";

// ── Internal shapes ─────────────────────────────────────────────────────────

/** A symbol/footprint name safe for a KiCad `<nick>:<item>` reference: the MPN
 *  with characters KiCad dislikes collapsed to `_`. */
function safeLibItemName(mpn: string): string {
  return mpn.replace(/[^A-Za-z0-9._+-]+/g, "_").replace(/^_+|_+$/g, "") || "PART";
}

/** How a part's symbol resolved (independent of its footprint):
 *   - `uploaded` — a SYMBOL PartAsset fetched from R2 (project lib carries it).
 *   - `referenced` — no asset; emitted by the part's `kicadSymbol` lib-id and
 *      resolved from the user's KiCad standard libs (NO file, NO embedded def).
 *   - `stub`      — neither; an auto-generated placeholder symbol. */
type SymbolMode = "uploaded" | "referenced" | "stub";
/** How a part's footprint resolved (independent of its symbol). Mirrors above. */
type FootprintMode = "uploaded" | "referenced" | "stub";

/** Per-part assembled data the generators consume. */
type ResolvedPart = {
  mpn: string;
  /** `Part.description` — populates the schematic instance's Description field. */
  description: string;
  /** `Part.datasheetUrl` — populates the schematic instance's (KiCad-mandatory)
   *  Datasheet field. `null` when the part has no datasheet URL. */
  datasheetUrl: string | null;
  /** The (possibly grouped) BomLine refDes string, e.g. "C2,C3,C7". */
  refDesGroup: string;
  /** Individual designators expanded from the group. */
  designators: string[];
  /** Symbol/footprint item name used across the PROJECT libs + instances
   *  (`<slug>:<itemName>`). Unused for the referenced lib-ids. */
  itemName: string;

  // ── Symbol resolution ──
  symbolMode: SymbolMode;
  /** Symbol lib-id placed on the schematic instance: `<slug>:<itemName>` for
   *  uploaded/stub, or the standard-lib `kicadSymbol` for referenced. */
  symbolLibId: string;
  /** The symbol body to embed (uploaded/stub). UNDEFINED for `referenced` — a
   *  referenced part gets no project symbol + no embedded lib_symbols def. */
  symbolText?: string;

  // ── Footprint resolution ──
  footprintMode: FootprintMode;
  /** Footprint reference for the instance's Footprint property: `<slug>:<itemName>`
   *  for uploaded/stub, or the standard-lib `kicadFootprint` for referenced. */
  footprintRef: string;
  /** The footprint body to bundle in `.pretty/` (uploaded/stub; 3D path already
   *  rewritten). UNDEFINED for `referenced` — no file is emitted. */
  footprintText?: string;

  /** Bundled 3D model { filename, bytes } when a MODEL_3D asset existed. A
   *  referenced footprint brings its own 3D from KiCad, so we never bundle one. */
  model3d?: { filename: string; bytes: Buffer };
  /** Coverage row for the report. */
  coverage: PartCoverage;
};

// ── Asset trust → report status ──────────────────────────────────────────────

/** Map a fetched asset's `trust` to a report `AssetStatus`. A real (fetched)
 *  asset is `verified` only when its trust is VERIFIED; anything else uploaded
 *  is `unverified`. */
function statusForTrust(trust: string): AssetStatus {
  return trust === "VERIFIED" ? "verified" : "unverified";
}

// ── The orchestrator ─────────────────────────────────────────────────────────

export type BuildKicadExportResult = {
  zip: Buffer;
  coverage: PartCoverage[];
  /** The EXPORT_REPORT.md text (also written into the zip). */
  report: string;
};

/**
 * Assemble the KiCad project tree for a revision and return it zipped.
 *
 * Orchestration order:
 *   1. Load revision + project (slug → KiCad project name / lib nickname; the
 *      revision's label + updatedAt feed the schematic title block's rev/date).
 *   2. Load BOM lines → part (+ its PartAssets + PINOUT PartFact), sorted stably.
 *   3. (No nets — the export is UNWIRED by design; the student wires it.)
 *   4. Per part: resolve SYMBOL/FOOTPRINT/MODEL_3D — fetch the asset text/bytes
 *      from R2 when a PartAsset row exists, else synthesize a stub. Rewrite each
 *      footprint's 3D path to `${KIPRJMOD}/3dmodels/<file>`. Track coverage.
 *   5. Expand grouped refDes → per-instance designator list.
 *   6. Run the generators: symbol lib (Footprint pre-wired to <slug>:<fp>), the
 *      .pretty footprints, lib-tables, .kicad_pro, gridPlacement (over the
 *      expanded designators), base .kicad_pcb, .kicad_sch (expanded parts +
 *      placements, title-block rev/date), EXPORT_REPORT.md.
 *   7. Zip the §1 tree → Buffer.
 */
export async function buildKicadExportZip(
  revisionId: string,
): Promise<BuildKicadExportResult> {
  // ── 1. Revision + project ──
  const revision = await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: {
      id: true,
      label: true,
      updatedAt: true,
      project: { select: { slug: true, name: true } },
    },
  });
  const projectName = revision.project.slug;
  // Title-block fields: the revision label is the schematic `rev`; its
  // `updatedAt` (a DB value, not `Date.now()`) is the deterministic `date`.
  const revLabel = revision.label;
  const revDate = revision.updatedAt.toISOString().slice(0, 10); // YYYY-MM-DD

  // ── 2. BOM lines → part (+ assets + PINOUT fact) ──
  const bomLines = await db.bomLine.findMany({
    where: { revisionId },
    select: {
      refDes: true,
      part: {
        select: {
          id: true,
          mpn: true,
          manufacturer: true,
          footprint: true,
          description: true,
          datasheetUrl: true,
          kicadSymbol: true,
          kicadFootprint: true,
          assets: {
            select: { kind: true, r2Key: true, filename: true, trust: true },
          },
          factGroups: {
            where: { group: "PINOUT" },
            select: { data: true },
          },
        },
      },
    },
  });

  // Stable order so the emitted tree is reproducible (DB row order isn't).
  bomLines.sort((a, b) => {
    const am = `${a.part.manufacturer}${a.part.mpn}`;
    const bm = `${b.part.manufacturer}${b.part.mpn}`;
    return am < bm ? -1 : am > bm ? 1 : 0;
  });

  // ── 3. (Deliberately) NO nets ──
  // The export hands the student a fully-placed, fielded, footprint-assigned but
  // UNWIRED canvas — wiring everything (power rails included) is the lesson. So
  // buildSchematic emits placed parts only (no nets/power ports) and the export
  // never queries connectivity data. Result: the generated .kicad_sch contains
  // zero `power:` symbols.

  const r2On = env.R2_ENABLED && !!env.R2_BUCKET;

  // ── 4. Resolve each part's assets (dedup per part). ──
  const resolvedParts: ResolvedPart[] = [];
  for (const line of bomLines) {
    const part = line.part;
    const itemName = safeLibItemName(part.mpn);

    // Expand the grouped refDes into individual designators.
    const designators = line.refDes
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    // PINOUT fact (for stub pin generation).
    let pinout: Pinout | undefined;
    const factRow = part.factGroups[0];
    if (factRow) {
      const parsed = pinoutSchema.safeParse(factRow.data);
      if (parsed.success) pinout = parsed.data;
    }

    const bySymbol = part.assets.find((a) => a.kind === "SYMBOL");
    const byFootprint = part.assets.find((a) => a.kind === "FOOTPRINT");
    const byModel = part.assets.find((a) => a.kind === "MODEL_3D");

    const projectLibId = `${projectName}:${itemName}`;

    // SYMBOL — precedence: uploaded asset → standard-lib reference → stub.
    let symbolMode: SymbolMode;
    let symbolLibId: string;
    let symbolText: string | undefined;
    let symbolStatus: AssetStatus;
    const fetchedSymbol = await tryFetchText(bySymbol?.r2Key, r2On);
    if (fetchedSymbol !== undefined && bySymbol) {
      symbolMode = "uploaded";
      symbolLibId = projectLibId;
      symbolText = fetchedSymbol;
      symbolStatus = statusForTrust(bySymbol.trust);
    } else if (part.kicadSymbol) {
      // Referenced: emit the standard-lib lib-id; NO project file, NO embedded def.
      symbolMode = "referenced";
      symbolLibId = part.kicadSymbol;
      symbolText = undefined;
      symbolStatus = "referenced";
    } else {
      symbolMode = "stub";
      symbolLibId = projectLibId;
      symbolText = buildStubSymbol({ mpn: part.mpn, pinout });
      symbolStatus = "stubbed";
    }

    // FOOTPRINT — precedence: uploaded asset → standard-lib reference → stub.
    let footprintMode: FootprintMode;
    let footprintRef: string;
    let footprintText: string | undefined;
    let footprintStatus: AssetStatus;
    const fetchedFootprint = await tryFetchText(byFootprint?.r2Key, r2On);
    if (fetchedFootprint !== undefined && byFootprint) {
      footprintMode = "uploaded";
      footprintRef = projectLibId;
      footprintText = fetchedFootprint;
      footprintStatus = statusForTrust(byFootprint.trust);
    } else if (part.kicadFootprint) {
      // Referenced: emit the standard footprint lib-id; NO project .kicad_mod file.
      footprintMode = "referenced";
      footprintRef = part.kicadFootprint;
      footprintText = undefined;
      footprintStatus = "referenced";
    } else {
      footprintMode = "stub";
      footprintRef = projectLibId;
      footprintText = buildStubFootprint({
        mpn: part.mpn,
        footprint: part.footprint ?? undefined,
      });
      footprintStatus = "stubbed";
    }

    // MODEL_3D: real bytes from R2 (optional — missing → omitted, never stubbed).
    // Only an UPLOADED footprint carries a bundled model; a REFERENCED footprint
    // brings its own 3D from KiCad's standard library, so we never bundle one.
    let model3d: ResolvedPart["model3d"];
    let model3dStatus: AssetStatus = "missing";
    if (byModel && footprintMode !== "referenced") {
      const bytes = await tryFetchBytes(byModel.r2Key, r2On);
      if (bytes !== undefined) {
        // Name the bundled model deterministically by item name + its extension.
        const ext = extFromName(byModel.filename) ?? "step";
        model3d = { filename: `${itemName}.${ext}`, bytes };
        model3dStatus = statusForTrust(byModel.trust);
      }
    }

    // Rewrite the (bundled) footprint's 3D-model path to the bundled file. Only
    // applies when we have a project footprint body (uploaded/stub).
    if (model3d && footprintText !== undefined) {
      footprintText = setFootprintModelPath(
        footprintText,
        `\${KIPRJMOD}/3dmodels/${model3d.filename}`,
      );
    }

    resolvedParts.push({
      mpn: part.mpn,
      description: part.description,
      datasheetUrl: part.datasheetUrl,
      refDesGroup: line.refDes,
      designators,
      itemName,
      symbolMode,
      symbolLibId,
      symbolText,
      footprintMode,
      footprintRef,
      footprintText,
      model3d,
      coverage: {
        mpn: part.mpn,
        refDes: line.refDes,
        symbol: symbolStatus,
        footprint: footprintStatus,
        model3d: model3dStatus,
      },
    });
  }

  // ── 5. Expanded per-instance designator list (for placement + schematic). ──
  // Each designator maps to its part's resolved symbol lib-id + footprint ref.
  const allDesignators: string[] = [];
  const schematicParts: SchematicPart[] = [];
  for (const p of resolvedParts) {
    for (const refDes of p.designators) {
      allDesignators.push(refDes);
      schematicParts.push({
        refDes,
        // Referenced symbols carry NO symbolText → no embedded lib_symbols def.
        symbolText: p.symbolText,
        libId: p.symbolLibId,
        // Footprint ref is resolved INDEPENDENTLY of the symbol (project or std-lib).
        footprintRef: p.footprintRef,
        // Visible Value is the part's MPN (uploaded/stub use the bare item name;
        // referenced lib-ids like "Device:R" would otherwise show "R").
        value: p.mpn,
        datasheet: p.datasheetUrl ?? undefined,
        description: p.description ?? undefined,
      });
    }
  }

  // ── 6. Run the generators. ──
  const placements = gridPlacement(allDesignators);

  // Project symbol library: ONLY uploaded + stub symbols (a `referenced` symbol
  // lives in the user's KiCad standard lib and must NOT be embedded here). May be
  // empty when every part is referenced — buildSymbolLib still emits a valid
  // (kicad_symbol_lib ...) with zero (symbol ...) children.
  const embeddedSymbolParts = resolvedParts.filter(
    (p) => p.symbolText !== undefined,
  );
  // The embedded symbol's Footprint property points at the part's footprint ref
  // (project `<slug>:<fp>` for uploaded/stub, or the std-lib footprint lib-id for
  // a referenced footprint) — resolved INDEPENDENTLY of how the symbol resolved.
  const footprintRefByItem = new Map<string, string>();
  for (const p of resolvedParts) {
    footprintRefByItem.set(p.itemName, p.footprintRef);
  }
  const symbolLib = buildSymbolLib(
    embeddedSymbolParts.map((p) => ({
      name: p.itemName,
      kicadSymText: p.symbolText!,
    })),
    {
      footprintFor: (name) => footprintRefByItem.get(name),
    },
  );

  const kicadPro = buildKicadPro({ projectName });
  const symLibTable = buildSymLibTable([
    { nick: projectName, file: `${projectName}.kicad_sym`, descr: revision.project.name },
  ]);
  const fpLibTable = buildFpLibTable([
    { nick: projectName, file: `${projectName}.pretty`, descr: revision.project.name },
  ]);
  const basePcb = buildBasePcb();

  const schematic = buildSchematic({
    projectName,
    parts: schematicParts,
    placements,
    rev: revLabel,
    date: revDate,
    company: env.KICAD_EXPORT_COMPANY,
  });

  const coverage = resolvedParts.map((p) => p.coverage);
  const report = buildExportReport(coverage, {
    projectName: revision.project.name,
    generatedNote: `Revision \`${revision.label}\` · project \`${projectName}\``,
  });

  // ── 7. Zip the §1 tree. ──
  // Pin every entry's modification date to the Unix epoch so two runs of the
  // same input produce byte-identical zips (JSZip otherwise stamps "now").
  const FIXED = new Date(0);
  const opts = { date: FIXED } as const;

  const zip = new JSZip();
  const root = zip.folder(projectName)!;
  root.file(`${projectName}.kicad_pro`, kicadPro, opts);
  root.file(`${projectName}.kicad_sch`, schematic, opts);
  root.file(`${projectName}.kicad_pcb`, basePcb, opts);
  root.file("sym-lib-table", symLibTable, opts);
  root.file("fp-lib-table", fpLibTable, opts);

  const libs = root.folder("libs")!;
  libs.file(`${projectName}.kicad_sym`, symbolLib, opts);

  // Each footprint as its own `.kicad_mod` inside the `.pretty/` dir — ONLY
  // uploaded + stub footprints. A `referenced` footprint resolves from the user's
  // KiCad standard libs (no file bundled). The `.pretty/` dir is still created
  // (possibly empty) so the fp-lib-table entry resolves to a valid directory.
  const pretty = libs.folder(`${projectName}.pretty`)!;
  for (const p of resolvedParts) {
    if (p.footprintText === undefined) continue;
    pretty.file(`${p.itemName}.kicad_mod`, p.footprintText, opts);
  }

  // Bundled 3D models (only those that existed + fetched).
  const modelFiles = resolvedParts.filter((p) => p.model3d);
  if (modelFiles.length > 0) {
    const models = libs.folder("3dmodels")!;
    for (const p of modelFiles) {
      models.file(p.model3d!.filename, p.model3d!.bytes, opts);
    }
  }

  root.file("bom.csv", buildBomCsv(resolvedParts), opts);
  root.file("EXPORT_REPORT.md", report, opts);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return { zip: buffer, coverage, report };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch an asset's text from R2; undefined when there's no key, R2 is off, or
 *  the object can't be fetched (→ caller falls back to a stub). */
async function tryFetchText(
  key: string | undefined,
  r2On: boolean,
): Promise<string | undefined> {
  if (!key || !r2On) return undefined;
  try {
    return await getR2ObjectText(key);
  } catch {
    return undefined;
  }
}

/** Fetch an asset's bytes from R2; undefined when there's no key, R2 is off, or
 *  the object can't be fetched (→ caller omits the 3D model). */
async function tryFetchBytes(
  key: string | undefined,
  r2On: boolean,
): Promise<Buffer | undefined> {
  if (!key || !r2On) return undefined;
  try {
    return await getR2ObjectBytes(key);
  } catch {
    return undefined;
  }
}

/** The lowercased extension of a filename (no leading dot), or undefined. */
function extFromName(filename: string): string | undefined {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename);
  return m ? m[1]!.toLowerCase() : undefined;
}

/** A minimal `bom.csv` for the bundled tree (design §1). Deterministic. */
function buildBomCsv(parts: ResolvedPart[]): string {
  const rows = ["Reference,Qty,MPN"];
  for (const p of parts) {
    rows.push(`"${p.refDesGroup}",${p.designators.length},"${p.mpn}"`);
  }
  return rows.join("\n") + "\n";
}
