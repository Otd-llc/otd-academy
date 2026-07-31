// Verify a generated KiCad starter zip carries every correction the L1.01
// starter had to be fixed for. Board-agnostic: point it at any starter zip.
//
// The corrections, and why each one is checked (all learned the hard way on
// l1-01-wroom-breakout, PRs #355/#357/#360-#363):
//
//   1. 3D-model paths under `libs/3dmodels/` — a bare `${KIPRJMOD}/3dmodels/`
//      resolves to a directory that does not exist in the zip, so every
//      bundled model silently fails to load in the 3D viewer (#363).
//   2. refdes silkscreen normalised to 1 mm / 1 mm / 0.15 mm — vendor-tool
//      footprints ship a sub-millimetre refdes the learner cannot read on the
//      board, and would have to resize by hand, one part at a time (#362).
//   3. A fab-floor via preset (0.6 mm pad / 0.3 mm drill) at the top of the via
//      dropdown — the Power-class via is too fat to escape a tight pin field,
//      and without a preset the learner has to hand-type sizes (#361).
//   4. VBUS in the Power net class — the LAYOUT lesson tells the learner the
//      supply nets are "already assigned to Power". A missing VBUS pattern
//      silently drops the raw 5 V rail to the 0.25 mm Default width (#360).
//      Pass `--power-nets VSERVO` (comma-separated) for a board whose design
//      carries a supply rail beyond the default four; those are usually the
//      HIGHEST-current nets on the board, so they are the worst ones to leave
//      on a 0.25 mm track.
//   5. No keepout zone on a two-terminal footprint — the KEMET 0805 asset
//      shipped a `copperpour not_allowed` zone that raised a DRC error and cut
//      an island out of the ground pour. A keepout on a MULTI-pad footprint is
//      reported, not failed: on the WROOM it is the antenna keep-out, which is
//      the point of that lesson section.
//   6. Solder-mask bridges allowed on the USB-C footprint — the connector's
//      fine-pitch pads legitimately share mask webs; without the attribute the
//      board DRCs dirty on a correct footprint.
//   7. ENIG finish + the board's copper-layer count actually in the stackup
//      (#357, #355) — the PCBWay order and the lesson both assume them.
//
// Two more checks are not L1.01 fixes; they are traps L1.01 happened to avoid
// and a later board did not:
//
//   8. Every symbol pin on the 1.27 mm connection grid. An off-grid pin places
//      fine and then refuses to take a wire, which a beginner reads as "the
//      wire will not connect". Caught on l1-03's SMAJ5.0A symbol asset.
//   9. No part fell back to an auto-generated stub. A stub is a placeholder,
//      and for anything that is not two-terminal it has no pads at all.
//
// Check 6 applies only when the board's BOM carries a USB-C connector, so it
// reports `n/a` rather than failing on a board that has none.
//
//   pnpm exec tsx scripts/verify-kicad-starter.ts <starter.zip> [--layers 4]
import { readFileSync } from "node:fs";
import JSZip from "jszip";

import {
  parseSexpr,
  isList,
  head,
  findChild,
  atomValue,
  type SList,
} from "@/lib/kicad/sexpr";

/** The reference-designator font of a bundled footprint, if it has one. */
function refFont(fpText: string): { w?: string; h?: string; t?: string } | null {
  const node = parseSexpr(fpText);
  if (!isList(node)) return null;
  const ref = node.items.find(
    (c): c is SList =>
      isList(c) &&
      ((head(c) === "fp_text" && atomValue(c.items[1]) === "reference") ||
        (head(c) === "property" && atomValue(c.items[1]) === "Reference")),
  );
  if (!ref) return null;
  const font = findChild(findChild(ref, "effects"), "font");
  if (!font) return null;
  return {
    w: atomValue(findChild(font, "size")?.items[1]),
    h: atomValue(findChild(font, "size")?.items[2]),
    t: atomValue(findChild(font, "thickness")?.items[1]),
  };
}

/** The 3D-model path a bundled footprint points at, if any. */
function modelPath(fpText: string): string | undefined {
  const m = findChild(parseSexpr(fpText), "model");
  return m ? atomValue(m.items[1]) : undefined;
}

/** KiCad's schematic connection grid. A pin that does not land on it cannot be
 *  wired to until the learner drops to a finer grid. */
const SCH_GRID = 1.27;
const onGrid = (v: number) => Math.abs(v / SCH_GRID - Math.round(v / SCH_GRID)) < 1e-6;

/**
 * Symbol pins that sit off the 1.27 mm connection grid, as `NAME@(x,y)`.
 *
 * Vendor CAD tools export symbols on whatever grid they like. KiCad places such
 * a symbol happily, but the learner then cannot snap a wire to the pin, which
 * reads as "the wire will not connect" rather than "the symbol is off grid".
 * Caught on the SMAJ5.0A asset, whose pins sit at -6.858 / +5.842 instead of a
 * symmetric +/-7.62.
 */
function offGridPins(libText: string): string[] {
  const root = parseSexpr(libText);
  if (!isList(root)) return [];
  const bad: string[] = [];

  const walk = (node: SList, symbolName: string) => {
    for (const child of node.items) {
      if (!isList(child)) continue;
      const kw = head(child);
      if (kw === "symbol") {
        walk(child, atomValue(child.items[1]) ?? symbolName);
        continue;
      }
      if (kw === "pin") {
        const at = findChild(child, "at");
        const x = Number(atomValue(at?.items[1]));
        const y = Number(atomValue(at?.items[2]));
        if (Number.isFinite(x) && Number.isFinite(y) && !(onGrid(x) && onGrid(y))) {
          bad.push(`${symbolName}@(${x},${y})`);
        }
        continue;
      }
      walk(child, symbolName);
    }
  };
  walk(root, "?");
  return [...new Set(bad)];
}

type Check = [name: string, result: boolean | "n/a"];

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error(
      "usage: pnpm exec tsx scripts/verify-kicad-starter.ts <starter.zip> [--layers N] [--power-nets A,B]",
    );
    process.exit(2);
  }
  const layersArg = process.argv.indexOf("--layers");
  const layers = layersArg >= 0 ? Number(process.argv[layersArg + 1]) : 4;

  // A board with a supply rail beyond the default four names it here, and the
  // rail must be in the Power class or it routes at the Default track width.
  const netsArg = process.argv.indexOf("--power-nets");
  const extraPowerNets =
    netsArg >= 0 ? (process.argv[netsArg + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];
  const powerNets = ["VBUS", "+3V3", "+5V", "GND", ...extraPowerNets];

  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files);
  const readText = async (suffix: string) => {
    const k = names.find((f) => f.endsWith(suffix));
    return k ? zip.files[k]!.async("string") : "";
  };

  const proText = await readText(".kicad_pro");
  if (!proText) throw new Error("no .kicad_pro in the zip");
  const pro = JSON.parse(proText);
  const pcb = await readText(".kicad_pcb");
  const sch = await readText(".kicad_sch");
  const report = await readText("EXPORT_REPORT.md");

  const patterns = (pro.net_settings?.netclass_patterns ?? []) as Array<{
    netclass: string;
    pattern: string;
  }>;
  const vias = (pro.board?.design_settings?.via_dimensions ?? []) as Array<{
    diameter: number;
    drill: number;
  }>;

  // Bundled footprints (uploaded + stub). A `referenced` footprint resolves
  // from the learner's KiCad standard libs and ships no file here.
  const fpFiles = names.filter((f) => f.endsWith(".kicad_mod"));
  const fps: Record<string, string> = {};
  for (const n of fpFiles) fps[n.split("/").pop()!] = await zip.files[n]!.async("string");

  const badRef: string[] = [];
  const badModel: string[] = [];
  for (const [name, text] of Object.entries(fps)) {
    const f = refFont(text);
    if (!f || f.w !== "1" || f.h !== "1" || f.t !== "0.15") {
      badRef.push(`${name}(${f ? `${f.w}/${f.h}/${f.t}` : "no-ref"})`);
    }
    const mp = modelPath(text);
    if (mp && !mp.startsWith("${KIPRJMOD}/libs/3dmodels/")) badModel.push(`${name}(${mp})`);
  }

  // A model file must exist in the zip for every model path a footprint claims.
  const bundledModels = new Set(
    names.filter((f) => f.includes("/libs/3dmodels/")).map((f) => f.split("/").pop()!),
  );
  const danglingModel = Object.entries(fps)
    .map(([name, t]) => [name, modelPath(t)] as const)
    .filter(([, mp]) => mp && !bundledModels.has(mp.split("/").pop()!))
    .map(([name, mp]) => `${name}->${mp}`);

  // Parts whose CAD had to be auto-stubbed. A stub is a placeholder, not a
  // part: the 2-terminal stub footprint has pads, but anything with a
  // different pin count gets an outline with NO pads at all.
  // Per-part rows are `| MPN | refDes | symbol | footprint | 3D |`.
  const stubbed = report
    .split("\n")
    .map((l) => l.split("|").map((c) => c.trim()))
    .filter((c) => c.length === 7 && (c[3] === "stubbed" || c[4] === "stubbed"))
    .map((c) => `${c[1]} (${c[2]})`);

  // Keepout zones inside a footprint. Two very different cases:
  //
  //   - On a two-terminal jellybean it is always a defect. The KEMET 0805
  //     decoupling cap shipped one, and it both raised a DRC error and cut an
  //     island out of the ground pour. Checked across every bundled two-pad
  //     footprint, not just that one part, so the next asset to arrive with one
  //     is caught on whichever board first uses it.
  //   - On the WROOM module it is the ANTENNA keep-out, which is the whole
  //     point of that lesson section. Reported, never failed.
  const keepouts = Object.entries(fps).filter(([, t]) => t.includes("(keepout"));
  const padCount = (t: string) => (t.match(/\(pad /g) ?? []).length;
  const badKeepout = keepouts.filter(([, t]) => padCount(t) <= 2).map(([n]) => n);
  const okKeepout = keepouts.filter(([, t]) => padCount(t) > 2).map(([n]) => n);

  const usbc = fps["USB4110-GF-A.kicad_mod"];

  // Symbol pin grid: the project library plus every def embedded in the
  // schematic (which includes the flattened standard-library symbols).
  const symLibName = names.find((f) => f.endsWith(".kicad_sym"));
  const symLib = symLibName ? await zip.files[symLibName]!.async("string") : "";
  const offGrid = [...new Set([...offGridPins(symLib), ...offGridPins(sch)])];

  const checks: Check[] = [
    [`${powerNets.join("/")} all map to the Power net class`, powerNets.every((n) => patterns.some((p) => p.netclass === "Power" && p.pattern === n))],
    ["via dropdown leads with the 0.6/0.3 mm fab-floor preset", vias[0]?.diameter === 0.6 && vias[0]?.drill === 0.3],
    [`refdes font 1/1/0.15 on all ${fpFiles.length} bundled footprints`, badRef.length === 0],
    ["3D-model paths under libs/3dmodels/", badModel.length === 0],
    ["every claimed 3D model is actually bundled", danglingModel.length === 0],
    ["no two-terminal footprint carries a keepout zone", badKeepout.length === 0],
    ["USB-C footprint allows soldermask bridges", usbc === undefined ? "n/a" : /\(attr[^)]*allow_soldermask_bridges/.test(usbc)],
    ["every symbol pin sits on the 1.27 mm connection grid", offGrid.length === 0],
    ['board finish = ENIG', pcb.includes('(copper_finish "ENIG")')],
    [`${layers}-layer stackup in the .kicad_pcb`, layers === 2 ? !pcb.includes("In1.Cu") : pcb.includes("In1.Cu") && pcb.includes("In2.Cu")],
    ["schematic is UNWIRED by design (no power ports, no wires)", !sch.includes('lib_id "power:') && !/\(\s*wire\s/.test(sch)],
    ["no part fell back to an auto-generated stub", stubbed.length === 0],
  ];

  let ok = true;
  for (const [name, res] of checks) {
    console.log(`${res === "n/a" ? "n/a " : res ? "PASS" : "FAIL"}  ${name}`);
    if (res === false) ok = false;
  }
  if (badRef.length) console.log(`  refdes offenders: ${badRef.join(", ")}`);
  if (badModel.length) console.log(`  model-path offenders: ${badModel.join(", ")}`);
  if (danglingModel.length) console.log(`  dangling models: ${danglingModel.join(", ")}`);
  if (badKeepout.length) console.log(`  keepout offenders: ${badKeepout.join(", ")}`);
  if (okKeepout.length) console.log(`  note: intentional keepout (multi-pad, e.g. the antenna): ${okKeepout.join(", ")}`);
  if (offGrid.length) console.log(`  off-grid pins: ${offGrid.join(", ")}`);
  if (stubbed.length) console.log(`  stubbed parts: ${stubbed.join(", ")}`);

  console.log(`\n${ok ? "ALL PASS" : "SOME FAILED"} — ${zipPath}`);
  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
