// Minimal `.kicad_pcb` (board-setup-only) generation
// (export-engine Task 5, design §3.2 / §3.3 / decision §5).
//
// PURE (no React/DB/env/network/fs). Emits a structurally well-formed but
// EMPTY board: version/generator/general header, A4 paper, the 2-layer copper
// stack + standard technical layers, and a `(setup ...)` block reflecting the
// BoardConfig design rules. There are deliberately NO `(footprint ...)` and NO
// `(net ...)` children — those arrive when the learner runs KiCad's "Update PCB
// from Schematic" (design decision §5: the schematic is the source of nets).
//
// `.kicad_pcb` IS an S-expression, so we build it through the Task 4 sexpr.ts
// primitives and serialize with the shared serializer (round-trip stable).
//
// Target format KiCad 10. The `(version ...)` / layer-name / setup-key shapes
// below are based on the documented `.kicad_pcb` format; FIDELITY ASSUMPTIONS
// for manual acceptance are flagged inline.

import {
  serializeSexpr,
  sym,
  str,
  list,
  type SNode,
} from "@/lib/kicad/sexpr";
import { resolveBoardConfig, type BoardConfig } from "@/lib/kicad/project";

// KiCad 10 board-file format version, taken from a KiCad 10.0 RELEASE-saved
// .kicad_pcb. NOT the doxygen/master value (20260603) — master runs ahead of
// the release and was rejected as "more recent version".
const PCB_VERSION = "20260206";
const GENERATOR = "otd-academy";
const GENERATOR_VERSION = "10.0";

/**
 * The canonical KiCad layer table for a 2-layer board: the two copper layers
 * (ordinals 0 and 31) followed by the standard non-copper technical layers in
 * KiCad's fixed ordinal order. Each row is `(<ord> "<name>" <type> [ "<userName>" ])`.
 *
 * Only the copper count varies with `copperLayers`. The 2-layer default (top
 * F.Cu + bottom B.Cu) is standard; a >2 override emits inner copper layers
 * In1.Cu… between them (l1-01 ships 4-layer, sig/GND/GND/sig, via
 * BOARD_CONFIG_OVERRIDES). Inner layers are typed `signal`; the learner pours
 * them as GND planes in the LAYOUT lesson's pour step.
 */
function buildLayers(copperLayers: number): SNode {
  const rows: SNode[] = [];

  // Copper layers. F.Cu is ordinal 0; B.Cu is ordinal 31; inner layers take
  // ordinals 1,2,… (In1.Cu …) between them.
  rows.push(list([sym("0"), str("F.Cu"), sym("signal")]));
  const innerCount = Math.max(0, copperLayers - 2);
  for (let i = 1; i <= innerCount; i++) {
    rows.push(list([sym(String(i)), str(`In${i}.Cu`), sym("signal")]));
  }
  rows.push(list([sym("31"), str("B.Cu"), sym("signal")]));

  // Standard technical/user layers (fixed ordinals, present on every board).
  const tech: Array<[number, string, string]> = [
    [32, "B.Adhes", "user"],
    [33, "F.Adhes", "user"],
    [34, "B.Paste", "user"],
    [35, "F.Paste", "user"],
    [36, "B.SilkS", "user"],
    [37, "F.SilkS", "user"],
    [38, "B.Mask", "user"],
    [39, "F.Mask", "user"],
    [40, "Dwgs.User", "user"],
    [41, "Cmts.User", "user"],
    [42, "Eco1.User", "user"],
    [43, "Eco2.User", "user"],
    [44, "Edge.Cuts", "user"],
    [45, "Margin", "user"],
    [46, "B.CrtYd", "user"],
    [47, "F.CrtYd", "user"],
    [48, "B.Fab", "user"],
    [49, "F.Fab", "user"],
  ];
  for (const [ord, name, type] of tech) {
    rows.push(list([sym(String(ord)), str(name), sym(type)]));
  }

  return list([sym("layers"), ...rows]);
}

/**
 * The physical `(stackup ...)` — a 1.6 mm FR4 board (2- or 4-layer) with the
 * board's surface finish. Modelled on a real KiCad-10 4-layer stackup (0.035 mm
 * copper; prepreg 0.1 / core 1.24 / prepreg 0.1 between the four coppers; the
 * 2-layer case collapses the inner stack to one 1.51 mm core). Without this block
 * KiCad auto-generates the stackup and leaves Board finish = "None".
 */
function buildStackup(cfg: BoardConfig): SNode {
  const copper = (name: string) =>
    list([sym("layer"), str(name), list([sym("type"), str("copper")]), list([sym("thickness"), sym("0.035")])]);
  const dielectric = (name: string, kind: string, thickness: number) =>
    list([
      sym("layer"), str(name), list([sym("type"), str(kind)]),
      list([sym("thickness"), sym(String(thickness))]),
      list([sym("material"), str("FR4")]),
      list([sym("epsilon_r"), sym("4.5")]),
      list([sym("loss_tangent"), sym("0.02")]),
    ]);
  const tech = (name: string, kind: string, thickness?: number) =>
    list([
      sym("layer"), str(name), list([sym("type"), str(kind)]),
      ...(thickness !== undefined ? [list([sym("thickness"), sym(String(thickness))])] : []),
    ]);

  const rows: SNode[] = [
    tech("F.SilkS", "Top Silk Screen"),
    tech("F.Paste", "Top Solder Paste"),
    tech("F.Mask", "Top Solder Mask", 0.01),
    copper("F.Cu"),
  ];
  if (cfg.copperLayers >= 4) {
    rows.push(
      dielectric("dielectric 1", "prepreg", 0.1),
      copper("In1.Cu"),
      dielectric("dielectric 2", "core", 1.24),
      copper("In2.Cu"),
      dielectric("dielectric 3", "prepreg", 0.1),
    );
  } else {
    rows.push(dielectric("dielectric 1", "core", 1.51));
  }
  rows.push(
    copper("B.Cu"),
    tech("B.Mask", "Bottom Solder Mask", 0.01),
    tech("B.Paste", "Bottom Solder Paste"),
    tech("B.SilkS", "Bottom Silk Screen"),
    list([sym("copper_finish"), str(cfg.copperFinish)]),
    list([sym("dielectric_constraints"), sym("no")]),
  );
  return list([sym("stackup"), ...rows]);
}

/**
 * The Plot dialog's pre-ticked layer set, as a KiCad LSET bitmask indexed by the
 * layer ordinals `buildLayers` emits: F.Cu 0, In1…Inn 1…n, B.Cu 31, B.SilkS 36,
 * F.SilkS 37, B.Mask 38, F.Mask 39, Edge.Cuts 44.
 *
 * We pre-tick EXACTLY the fab set — every copper layer, both silkscreens, both
 * solder masks, Edge.Cuts — and nothing else. Notably F.Paste/B.Paste (34/35)
 * stay OFF: a hand-soldered board needs no stencil, and the DRC_GERBER lesson
 * card tells the learner to leave them unticked.
 *
 * Why this matters: whatever is ticked here is what the learner's Plot dialog
 * opens with. The previous stub pre-ticked all 32 copper bits plus paste, which
 * plotted 19 files for a 9-layer fab set and buried the real layers in courtyard
 * / fab / empty-user-layer noise the board house has to be told to ignore.
 *
 * Emitted as the `0x<hi>_<lo>` pair KiCad writes for a 64-bit LSET. KiCad 10
 * renumbers layers on load (F.Cu 0, B.Cu 2, In1 4 …) and remaps the mask with
 * them, so the ordinals here must match `buildLayers`, not a KiCad-10-saved file.
 */
function plotLayerSelection(copperLayers: number): string {
  const bits: number[] = [0, 31]; // F.Cu, B.Cu
  for (let i = 1; i <= Math.max(0, copperLayers - 2); i++) bits.push(i); // In1.Cu…
  bits.push(36, 37, 38, 39, 44); // both silk, both mask, Edge.Cuts
  let lo = 0, hi = 0;
  for (const b of bits) {
    if (b < 32) lo |= 1 << b;
    else hi |= 1 << (b - 32);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `0x${hex(hi)}_${hex(lo)}`;
}

/**
 * The `(setup ...)` block: board design-rule defaults derived from BoardConfig.
 * Carries the physical stackup (with the board finish), the global clearances,
 * plus a `(pcbplotparams ...)` stub so the file is complete enough for KiCad to
 * open without re-deriving plot settings.
 */
function buildSetup(cfg: BoardConfig): SNode {
  return list([
    sym("setup"),
    buildStackup(cfg),
    list([sym("pad_to_mask_clearance"), sym("0")]),
    list([
      sym("allow_soldermask_bridges_in_footprints"),
      sym("no"),
    ]),
    list([
      sym("pcbplotparams"),
      list([sym("layerselection"), sym(plotLayerSelection(cfg.copperLayers))]),
      list([sym("plot_on_all_layers_selection"), sym("0x0000000_00000000")]),
      list([sym("disableapertmacros"), sym("no")]),
      list([sym("usegerberextensions"), sym("no")]),
      list([sym("usegerberattributes"), sym("yes")]),
      list([sym("usegerberadvancedattributes"), sym("yes")]),
      list([sym("creategerberjobfile"), sym("yes")]),
      list([sym("dashed_line_dash_ratio"), sym("12.000000")]),
      list([sym("dashed_line_gap_ratio"), sym("3.000000")]),
      list([sym("svgprecision"), sym("4")]),
      list([sym("plotframeref"), sym("no")]),
      list([sym("mode"), sym("1")]),
      list([sym("useauxorigin"), sym("no")]),
      list([sym("hpglpennumber"), sym("1")]),
      list([sym("hpglpenspeed"), sym("20")]),
      list([sym("hpglpendiameter"), sym("15.000000")]),
      list([sym("pdf_front_fp_property_popups"), sym("yes")]),
      list([sym("pdf_back_fp_property_popups"), sym("yes")]),
      list([sym("dxfpolygonmode"), sym("yes")]),
      list([sym("dxfimperialunits"), sym("yes")]),
      list([sym("dxfusepcbnewfont"), sym("yes")]),
      list([sym("psnegative"), sym("no")]),
      list([sym("psa4output"), sym("no")]),
      list([sym("plotreference"), sym("yes")]),
      list([sym("plotvalue"), sym("yes")]),
      list([sym("plotfptext"), sym("yes")]),
      list([sym("plotinvisibletext"), sym("no")]),
      list([sym("sketchpadsonfab"), sym("no")]),
      list([sym("plotpadnumbers"), sym("no")]),
      list([sym("hidednponfab"), sym("no")]),
      list([sym("sketchdnponfab"), sym("yes")]),
      list([sym("crossoutdnponfab"), sym("yes")]),
      list([sym("subtractmaskfromsilk"), sym("no")]),
      list([sym("outputformat"), sym("1")]),
      list([sym("mirror"), sym("no")]),
      list([sym("drillshape"), sym("1")]),
      list([sym("scaleselection"), sym("1")]),
      list([sym("outputdirectory"), str("")]),
    ]),
  ]);
}

export type BuildBasePcbOpts = {
  /** Board-config overrides; omitted fields fall back to DEFAULT_BOARD_CONFIG. */
  config?: Partial<BoardConfig>;
  /** Title-block title — the KiCad project name. Omitted ⇒ no `(title_block ...)`. */
  projectName?: string;
  /** Title-block revision, e.g. `v1`. Reaches the fab as the Gerber `%TF.ProjectId` revision field. */
  rev?: string;
  /** Title-block date (already formatted). */
  date?: string;
  /** Title-block company. */
  company?: string;
  /**
   * Short git SHA of the build that produced this export, stamped into the title
   * block's Comment1. Omitted when unset (a starter built off-Vercel records no
   * provenance rather than a wrong one).
   */
  gitSha?: string;
};

/**
 * `(title_block (title <project>) [(date ..)] [(rev ..)] [(company ..)])`, the
 * same shape (and sub-node order) `schematic.ts` emits, so the board and the
 * schematic agree.
 *
 * `rev` is the load-bearing one: KiCad copies the board's title-block revision
 * into every plotted Gerber's `%TF.ProjectId` attribute and into the `.gbrjob`
 * `"Revision"` field. With no title block at all, that field ships as the
 * literal `rev?` — so the fab receives a board stamped "revision unknown" while
 * the silkscreen says `v1`.
 *
 * `gitSha` lands in **Comment1**, which board text can reference as
 * `${COMMENT1}` — KiCad resolves title-block variables at plot time into real
 * silkscreen geometry (verified against KiCad 10.0.3 by plotting the same board
 * with two different Comment1 values and diffing the output). That makes a
 * silk-stamped build hash automatic instead of hand-typed, which is how the
 * previous hand-typed stamp ended up naming a commit that post-dated the fixes
 * the export was actually missing.
 */
function buildTitleBlock(opts: BuildBasePcbOpts): SNode | undefined {
  if (!opts.projectName) return undefined;
  const items: SNode[] = [sym("title_block"), list([sym("title"), str(opts.projectName)])];
  if (opts.date) items.push(list([sym("date"), str(opts.date)]));
  if (opts.rev) items.push(list([sym("rev"), str(opts.rev)]));
  if (opts.company) items.push(list([sym("company"), str(opts.company)]));
  if (opts.gitSha) items.push(list([sym("comment"), sym("1"), str(opts.gitSha)]));
  return list(items);
}

/**
 * Build a minimal, board-setup-only `.kicad_pcb` body (S-expression text, one
 * trailing newline). Structure:
 *   (kicad_pcb (version ..)(generator "otd-academy")(generator_version ..)
 *     (general (thickness 1.6)(legacy_teardrops no))
 *     (paper "A4")
 *     (layers ..)        ; 2-layer copper stack + standard tech layers
 *     (setup ..))        ; design-rule defaults from BoardConfig
 *
 * No `(footprint ...)` and no `(net ...)` children — by design (§5), those are
 * pulled across by the learner's "Update PCB from Schematic". The output is a
 * valid, openable, empty board.
 */
export function buildBasePcb(opts: BuildBasePcbOpts = {}): string {
  const cfg = resolveBoardConfig(opts.config);
  const titleBlock = buildTitleBlock(opts);

  const root = list([
    sym("kicad_pcb"),
    list([sym("version"), sym(PCB_VERSION)]),
    list([sym("generator"), str(GENERATOR)]),
    list([sym("generator_version"), str(GENERATOR_VERSION)]),
    list([
      sym("general"),
      list([sym("thickness"), sym("1.6")]),
      list([sym("legacy_teardrops"), sym("no")]),
    ]),
    list([sym("paper"), str("A4")]),
    // KiCad's position for the title block is after (paper ...), matching schematic.ts.
    ...(titleBlock ? [titleBlock] : []),
    buildLayers(cfg.copperLayers),
    buildSetup(cfg),
  ]);

  return serializeSexpr(root) + "\n";
}
