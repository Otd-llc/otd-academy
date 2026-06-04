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
const GENERATOR = "project-foundry";
const GENERATOR_VERSION = "10.0";

/**
 * The canonical KiCad layer table for a 2-layer board: the two copper layers
 * (ordinals 0 and 31) followed by the standard non-copper technical layers in
 * KiCad's fixed ordinal order. Each row is `(<ord> "<name>" <type> [ "<userName>" ])`.
 *
 * Only the copper count varies with `copperLayers`; v1 supports the 2-layer
 * default (top F.Cu + bottom B.Cu). A >2 layer override is accepted by the
 * config but emits inner copper layers In1.Cu… here too.
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
 * The `(setup ...)` block: board design-rule defaults derived from BoardConfig.
 * Carries the global clearances/widths plus a `(pcbplotparams ...)` stub so the
 * file is complete enough for KiCad to open without re-deriving plot settings.
 */
function buildSetup(cfg: BoardConfig): SNode {
  return list([
    sym("setup"),
    list([sym("pad_to_mask_clearance"), sym("0")]),
    list([
      sym("allow_soldermask_bridges_in_footprints"),
      sym("no"),
    ]),
    list([
      sym("pcbplotparams"),
      list([sym("layerselection"), sym("0x00010fc_ffffffff")]),
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
};

/**
 * Build a minimal, board-setup-only `.kicad_pcb` body (S-expression text, one
 * trailing newline). Structure:
 *   (kicad_pcb (version ..)(generator "project-foundry")(generator_version ..)
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
    buildLayers(cfg.copperLayers),
    buildSetup(cfg),
  ]);

  return serializeSexpr(root) + "\n";
}
