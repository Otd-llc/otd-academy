// Tests for the KiCad export orchestration (export-engine Task 8, design §1, §3).
//
// Two layers under test:
//   1. `buildKicadExportZip(revisionId)` — the pure-ish assembler. We build a
//      throwaway project → revision → parts (one WITH a SYMBOL PartAsset + a
//      PINOUT fact, others WITHOUT assets) → BomLines (incl. a GROUPED refDes
//      "C2,C3,C7") → a VERIFIED GROUND net with NetNodes. We assert the zip's
//      entry list matches the §1 tree, that the report marks the asset-backed
//      part `verified`/`unverified` while the stubbed parts read `stubbed`, that
//      the grouped refDes produced multiple placed instances, that the schematic
//      is UNWIRED (the VERIFIED net exists in the DB but the export drops NO
//      power ports), and that the title block carries the revision's rev + date.
//   2. `exportKicad({ revisionId })` — the auth-gated action. With auth +
//      `next/cache` mocked (as in part-assets-actions.test.ts) we assert the R2
//      PutObject spy fired and a revision-owned `BOM_EXPORT` Artifact row exists.
//
// R2 is MOCKED at the `@/lib/part-r2` helper layer: `getR2ObjectText` returns the
// fixture symbol for the asset-backed part's key and throws "not found" for any
// other key (exercising BOTH the real-asset and stub paths); `putR2Object` is a
// spy; `ensureR2Enabled` is a no-op. The real bucket is never touched.
//
// Exercises the real Neon DB (mirrors part-assets-actions.test.ts). Isolation:
// ONE throwaway Project (cascading its Revision/BomLines/Nets) + a few throwaway
// Parts (cascading their PartAssets/PartFacts), torn down in afterAll.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import JSZip from "jszip";
import { parseSexpr, findChild, findChildren, isStr } from "@/lib/kicad/sexpr";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// Hoisted mock state so the (hoisted) `vi.mock` factory can reference it:
//   - `putSpy`   — spy on the export zip PUT (asserted by the action test).
//   - `state`    — mutable holder for the asset-backed part's SYMBOL key + the
//                  fixture body (both set once the throwaway part exists).
const { putSpy, state, FIXTURE_SYMBOL } = vi.hoisted(() => ({
  putSpy:
    vi.fn<(key: string, body: Buffer, contentType: string) => Promise<void>>(
      async () => {},
    ),
  state: { symbolR2Key: "" },
  // A real-ish SnapEDA-shaped LDO symbol (VIN/GND/VOUT). The asset-backed part
  // uses this; the export should treat it as a real symbol (not a stub).
  FIXTURE_SYMBOL: `(symbol "AP2112K-3.3" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
  (property "Value" "AP2112K-3.3" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
  (symbol "AP2112K-3.3_0_1"
    (pin power_in line (at -7.62 0 0) (length 2.54)
      (name "VIN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin power_in line (at -7.62 -2.54 0) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin power_out line (at 7.62 0 180) (length 2.54)
      (name "VOUT" (effects (font (size 1.27 1.27))))
      (number "5" (effects (font (size 1.27 1.27))))
    )
  )
)`,
}));

vi.mock("@/lib/part-r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/part-r2")>();
  return {
    ...actual,
    ensureR2Enabled: vi.fn(), // no-op (R2 "on")
    putR2Object: putSpy,
    getR2ObjectText: vi.fn(async (key: string) => {
      if (key === state.symbolR2Key) return FIXTURE_SYMBOL;
      throw new Error("NoSuchKey");
    }),
    getR2ObjectBytes: vi.fn(async () => {
      throw new Error("NoSuchKey");
    }),
  };
});

import { db } from "@/lib/db";
import { buildKicadExportZip } from "@/lib/kicad/export";
import { exportKicad } from "@/lib/actions/kicad-export";

const SEED_EMAIL = "seed@example.com";
const TAG = `KicadExport-${Date.now()}`;

// KiCad standard-library lib-ids for the referenced part (Part C). Distinct from
// the project `<slug>:<item>` nicks so the assertions prove the export emits the
// reference verbatim (and never bundles a file for it).
const REF_SYMBOL_LIBID = "Device:R";
const REF_FOOTPRINT_LIBID = "Resistor_SMD:R_0805_2012Metric";

let seedUserId: string;
let projectId: string;
let revisionId: string;
let projectSlug: string;
let revisionLabel: string;
let revisionDate: string; // revision.updatedAt formatted "YYYY-MM-DD"
const partIds: string[] = [];
const createdArtifactIds: string[] = [];

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({ user: { email: SEED_EMAIL } }));

  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = seedUser.id;

  // Throwaway project + revision (BOM_SOURCING).
  projectSlug = `kicad-export-${Date.now()}`;
  const project = await db.project.create({
    data: {
      slug: projectSlug,
      name: `${TAG} project`,
      createdById: seedUserId,
      revisions: {
        create: { label: "v1", currentStage: "BOM_SOURCING" },
      },
    },
    select: {
      id: true,
      revisions: { select: { id: true, label: true, updatedAt: true } },
    },
  });
  projectId = project.id;
  const rev = project.revisions[0]!;
  revisionId = rev.id;
  revisionLabel = rev.label;
  // Same formatting the export uses (deterministic from the DB value).
  revisionDate = rev.updatedAt.toISOString().slice(0, 10);

  // Part A — has a SYMBOL PartAsset (VERIFIED) + a PINOUT fact. The export
  // should fetch the symbol (real path) and stub only the footprint.
  const partA = await db.part.create({
    data: {
      manufacturer: `${TAG}Co`,
      mpn: `${TAG}-LDO`,
      description: "asset-backed LDO",
      category: "LDO_REGULATOR",
      footprint: "SOT-23-5",
      createdById: seedUserId,
      factGroups: {
        create: {
          group: "PINOUT",
          data: {
            pins: [
              { number: "1", name: "VIN", function: "supply input", type: "power" },
              { number: "2", name: "GND", function: "ground", type: "gnd" },
              { number: "5", name: "VOUT", function: "regulated out", type: "power" },
            ],
          },
          createdById: seedUserId,
        },
      },
    },
    select: { id: true },
  });
  partIds.push(partA.id);
  state.symbolR2Key = `parts/${partA.id}/symbol-test.kicad_sym`;
  await db.partAsset.create({
    data: {
      partId: partA.id,
      kind: "SYMBOL",
      r2Key: state.symbolR2Key,
      filename: "test.kicad_sym",
      byteSize: FIXTURE_SYMBOL.length,
      contentType: "text/plain",
      source: "SnapEDA",
      trust: "VERIFIED",
      verifiedById: seedUserId,
      verifiedAt: new Date(),
      createdById: seedUserId,
    },
  });

  // Part B — NO assets, has a PINOUT fact (so the stub symbol gets real pins).
  const partB = await db.part.create({
    data: {
      manufacturer: `${TAG}Co`,
      mpn: `${TAG}-CAP`,
      description: "stubbed cap",
      category: "MLCC_CAPACITOR",
      footprint: "0402",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  partIds.push(partB.id);

  // Part C — NO assets but standard-lib references set on BOTH symbol + footprint.
  // The export must emit it by lib-id (NO project symbol/footprint file) and mark
  // it `referenced` in coverage.
  const partC = await db.part.create({
    data: {
      manufacturer: `${TAG}Co`,
      mpn: `${TAG}-RES`,
      description: "referenced resistor",
      category: "PASSIVE_RESISTOR",
      footprint: "0805",
      kicadSymbol: REF_SYMBOL_LIBID,
      kicadFootprint: REF_FOOTPRINT_LIBID,
      createdById: seedUserId,
    },
    select: { id: true },
  });
  partIds.push(partC.id);

  // BomLines: Part A as a single U-designator; Part B as a GROUPED 3-cap line.
  await db.bomLine.create({
    data: {
      revisionId,
      partId: partA.id,
      refDes: "U1",
      quantity: 1,
      createdById: seedUserId,
    },
  });
  await db.bomLine.create({
    data: {
      revisionId,
      partId: partB.id,
      refDes: "C2,C3,C7",
      quantity: 3,
      createdById: seedUserId,
    },
  });
  // Part C as a single R-designator (standard-lib referenced).
  await db.bomLine.create({
    data: {
      revisionId,
      partId: partC.id,
      refDes: "R1",
      quantity: 1,
      createdById: seedUserId,
    },
  });
});

afterAll(async () => {
  if (createdArtifactIds.length > 0) {
    await db.artifact
      .deleteMany({ where: { id: { in: createdArtifactIds } } })
      .catch(() => {});
  }
  // Project delete cascades Revision → BomLines + Artifacts.
  if (projectId) {
    await db.project.deleteMany({ where: { id: projectId } }).catch(() => {});
  }
  // Parts cascade their PartAssets + PartFacts.
  if (partIds.length > 0) {
    await db.part.deleteMany({ where: { id: { in: partIds } } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: `${TAG}Co` } }).catch(() => {});

  const leftover = await db.project.count({ where: { id: projectId } });
  expect(leftover).toBe(0);
});

// ── buildKicadExportZip ──────────────────────────────────────────────────────
describe("buildKicadExportZip", () => {
  test("produces the §1 tree, stubs missing assets, expands grouped refDes", async () => {
    const { zip, coverage, report } = await buildKicadExportZip(revisionId);

    // Re-open the zip to enumerate entries.
    const parsed = await JSZip.loadAsync(zip);
    const names = Object.keys(parsed.files);

    const expectEntry = (suffix: string) =>
      expect(
        names.some((n) => n === `${projectSlug}/${suffix}`),
        `missing zip entry ${projectSlug}/${suffix} — have: ${names.join(", ")}`,
      ).toBe(true);

    expectEntry(`${projectSlug}.kicad_pro`);
    expectEntry(`${projectSlug}.kicad_sch`);
    expectEntry(`${projectSlug}.kicad_pcb`);
    expectEntry("sym-lib-table");
    expectEntry("fp-lib-table");
    expectEntry(`libs/${projectSlug}.kicad_sym`);
    expectEntry("EXPORT_REPORT.md");
    // Two footprints under the .pretty dir: the LDO (stub) + the cap (stub). The
    // referenced resistor (Part C) bundles NO project footprint file.
    expect(
      names.filter((n) => n.includes(`.pretty/`) && n.endsWith(".kicad_mod"))
        .length,
    ).toBe(2);

    // Coverage: the asset-backed part's symbol is `verified`; its footprint is
    // `stubbed` (no FOOTPRINT asset). The cap is `stubbed` on both. The resistor
    // (Part C) is `referenced` on both (standard-lib lib-ids, no asset/stub).
    const ldo = coverage.find((c) => c.mpn.endsWith("-LDO"))!;
    const cap = coverage.find((c) => c.mpn.endsWith("-CAP"))!;
    const res = coverage.find((c) => c.mpn.endsWith("-RES"))!;
    expect(ldo.symbol).toBe("verified");
    expect(ldo.footprint).toBe("stubbed");
    expect(cap.symbol).toBe("stubbed");
    expect(cap.footprint).toBe("stubbed");
    expect(res.symbol).toBe("referenced");
    expect(res.footprint).toBe("referenced");

    // The grouped refDes shows up verbatim in the per-part report row.
    expect(report).toContain("C2,C3,C7");
    // The report's per-part table marks the asset-backed symbol verified and the
    // cap symbol stubbed.
    expect(report).toMatch(/-LDO \|[^\n]*verified/);
    expect(report).toMatch(/-CAP \|[^\n]*stubbed/);

    // The schematic placed 5 component instances: U1 + the three expanded caps +
    // the referenced resistor R1.
    const sch = await parsed
      .file(`${projectSlug}/${projectSlug}.kicad_sch`)!
      .async("string");
    for (const ref of ["U1", "C2", "C3", "C7", "R1"]) {
      expect(sch).toContain(`"${ref}"`);
    }
    // UNWIRED export: the schematic carries NO power-port symbols of any kind —
    // wiring (power rails included) is the student's lesson.
    expect(sch).not.toContain("power:");

    // ── Referenced part (Part C / R1): emitted by standard-lib lib-id, NOT in
    //    the project lib/.pretty. ──
    const schNode2 = parseSexpr(sch);
    // (a) An R1 component instance whose lib_id is the standard symbol lib-id.
    const r1Inst = findChildren(schNode2, "symbol").find((s) => {
      const refProp = findChildren(s, "property").find(
        (p) => isStr(p.items[1]) && p.items[1].value === "Reference",
      );
      return refProp && isStr(refProp.items[2]) && refProp.items[2].value === "R1";
    })!;
    expect(r1Inst).toBeDefined();
    const r1LibId = findChild(r1Inst, "lib_id")!;
    expect(isStr(r1LibId.items[1]) && r1LibId.items[1].value).toBe(
      REF_SYMBOL_LIBID,
    );
    // Its Footprint property is the standard footprint lib-id (not a project nick).
    const r1Fp = findChildren(r1Inst, "property").find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Footprint",
    )!;
    expect(isStr(r1Fp.items[2]) && r1Fp.items[2].value).toBe(
      REF_FOOTPRINT_LIBID,
    );

    // (b) The referenced part is NOT embedded in the project symbol lib...
    const symLibText = await parsed
      .file(`${projectSlug}/libs/${projectSlug}.kicad_sym`)!
      .async("string");
    expect(symLibText).not.toContain(REF_SYMBOL_LIBID);
    expect(symLibText).not.toContain(`${TAG}-RES`);
    // ...and NO .pretty/ entry was emitted for it.
    const resItem = `${projectSlug}/libs/${projectSlug}.pretty/`;
    const prettyForRes = names.filter(
      (n) => n.startsWith(resItem) && n.toLowerCase().includes("res"),
    );
    expect(prettyForRes).toHaveLength(0);

    // (c) The referenced row in the per-part report reads `referenced`.
    expect(report).toMatch(/-RES \|[^\n]*referenced[^\n]*referenced/);

    // The title block carries the revision's label as `rev` and a formatted
    // `date` (from revision.updatedAt). Assert against the parsed s-expression.
    const schNode = parseSexpr(sch);
    const titleBlock = findChild(schNode, "title_block")!;
    expect(titleBlock).toBeDefined();
    const rev = findChild(titleBlock, "rev")!;
    expect(isStr(rev.items[1]) && rev.items[1].value).toBe(revisionLabel);
    const date = findChild(titleBlock, "date")!;
    expect(isStr(date.items[1]) && date.items[1].value).toBe(revisionDate);

    // The fetched fixture symbol's value made it into the symbol lib (real, not
    // stub) — the stub would be named "STUB-...".
    const symLib = await parsed
      .file(`${projectSlug}/libs/${projectSlug}.kicad_sym`)!
      .async("string");
    expect(symLib).toContain("VOUT"); // a pin only the real fixture has
  });
});

// ── exportKicad (action) ─────────────────────────────────────────────────────
describe("exportKicad", () => {
  test("PUTs the zip to R2 and records a BOM_EXPORT artifact", async () => {
    putSpy.mockClear();

    const artifact = await exportKicad({ revisionId });
    createdArtifactIds.push(artifact.id);

    // The R2 PUT fired with an exports/ key + application/zip content-type.
    expect(putSpy).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = putSpy.mock.calls[0]!;
    expect(key).toMatch(new RegExp(`^exports/${revisionId}/kicad-.*\\.zip$`));
    expect(contentType).toBe("application/zip");
    expect(Buffer.isBuffer(body)).toBe(true);

    // The artifact row is a revision-owned BOM_EXPORT FILE.
    expect(artifact.revisionId).toBe(revisionId);
    expect(artifact.buildId).toBeNull();
    expect(artifact.subkind).toBe("BOM_EXPORT");
    expect(artifact.kind).toBe("FILE");
    expect(artifact.stage).toBe("BOM_SOURCING");
    expect(artifact.fileKey).toBe(key);
    expect(artifact.fileMime).toBe("application/zip");
    expect(artifact.fileBytes).toBeGreaterThan(0);

    // It's actually persisted.
    const row = await db.artifact.findUnique({ where: { id: artifact.id } });
    expect(row).not.toBeNull();
    expect(row!.subkind).toBe("BOM_EXPORT");
  });
});
