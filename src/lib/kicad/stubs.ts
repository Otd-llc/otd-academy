// KiCad missing-asset STUB generators (export-engine Task 6, design §3.5).
//
// 16 of 17 BOM parts have NO uploaded CAD assets. Rather than fail the export,
// we synthesize clearly-labeled PLACEHOLDER symbols/footprints so the KiCad
// project still opens, the learner can see what is missing, and replace the
// stub with a real asset. Each stub is loudly marked as an UNVERIFIED auto-stub
// so it can never be mistaken for a curated asset.
//
// Both generators are PURE (no React/DB/env/network/fs) and emit
// S-expression text that:
//   - parses cleanly with `parseSexpr`, and
//   - (for symbols) feeds straight into Task 4's `buildSymbolLib` as a
//     bare `(symbol ...)` body.
//
// Target format is KiCad 10. The symbol-library / footprint S-expr shapes are
// anchored to the samples exercised in `kicad-lib.test.ts` / `kicad-meta`.

import {
  serializeSexpr,
  sym,
  str,
  list,
  type SNode,
} from "@/lib/kicad/sexpr";
import type { Pin, Pinout } from "@/lib/schemas/part-fact";

// The `pinout` input is the verified PINOUT-fact shape exported from
// part-fact.ts (`Pinout = { pins: Pin[] }`); no separate `PinoutData` type
// exists, so we re-export an alias for callers that prefer that name.
export type PinoutData = Pinout;

// ── Symbol geometry constants (KiCad mils-as-mm grid, 1.27 step) ───────────
// Pins sit on the 1.27 mm (50 mil) grid KiCad uses for schematic symbols. The
// body is a centred rectangle; pins march DOWN the left and right edges.
const GRID = 1.27;
const PIN_PITCH = 2.54; // one pin every 100 mil down an edge
const PIN_LENGTH = 2.54;
const BODY_HALF_WIDTH = 7.62; // 300 mil half-width → 600 mil wide box
const TEXT_SIZE = list([sym("size"), num(1.27), num(1.27)]);

function num(n: number): SNode {
  // Emit integers without a trailing ".0" and trim float noise, matching how
  // KiCad writes coordinates (e.g. `2.54`, `0`, `-7.62`).
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
  return sym(s);
}

/** Standard `(effects (font (size 1.27 1.27)))` text styling. */
function effects(extra: SNode[] = []): SNode {
  return list([sym("effects"), list([sym("font"), TEXT_SIZE]), ...extra]);
}

/**
 * Map a Foundry PINOUT pin `type` to a KiCad electrical pin type. Documented
 * mapping (design §3.5 leaves the analog/clock/strapping/absent calls to us):
 *   gnd      → power_in     (ground rails are power inputs in KiCad)
 *   power    → power_in     (supply pins)
 *   io       → bidirectional
 *   nc       → no_connect
 *   analog   → passive      (we don't know in/out; passive avoids ERC noise)
 *   clock    → passive      (same — a real clock pin would be input, but the
 *                            stub can't tell direction, so stay neutral)
 *   strapping→ passive      (boot-strap pins are config inputs; passive is safe)
 *   (absent) → unspecified  (genuinely unknown)
 * Everything maps to an ERC-quiet type so a stubbed board doesn't drown the
 * learner in false electrical-rule errors.
 */
export function pinTypeToKicad(type: Pin["type"]): string {
  switch (type) {
    case "gnd":
    case "power":
      return "power_in";
    case "io":
      return "bidirectional";
    case "nc":
      return "no_connect";
    case "analog":
    case "clock":
    case "strapping":
      return "passive";
    case undefined:
      return "unspecified";
    default: {
      // Exhaustiveness guard — a new PIN_TYPE must be mapped here.
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Build one `(pin ...)` node laid out on an edge.
 * @param pin     the PINOUT-fact pin (real number + name + type)
 * @param x       the pin-endpoint x (away from the body)
 * @param y       the pin-endpoint y
 * @param angle   pin rotation: 0 = points right (left edge), 180 = points left
 */
function buildPinNode(pin: Pin, x: number, y: number, angle: number): SNode {
  return list([
    sym("pin"),
    sym(pinTypeToKicad(pin.type)),
    sym("line"),
    list([sym("at"), num(x), num(y), num(angle)]),
    list([sym("length"), num(PIN_LENGTH)]),
    list([sym("name"), str(pin.name), effects()]),
    list([sym("number"), str(pin.number), effects()]),
  ]);
}

export type StubSymbolInput = { mpn: string; pinout?: PinoutData };

/**
 * Synthesize a stub `(symbol "STUB-<mpn>" ...)` body. With a PINOUT fact: a
 * rectangle with one pin per fact pin, split between the left and right edges,
 * each carrying its real number + name and a mapped electrical type. Without a
 * pinout: a generic empty box with a "no pinout — replace this stub" note.
 *
 * The symbol always carries:
 *   - `Reference` = "U" (generic),
 *   - `Value` = the mpn,
 *   - a visible `STUB — UNVERIFIED auto-generated placeholder` property AND a
 *     `(text ...)` graphic, so it is unmistakable in the KiCad symbol editor.
 *
 * Output is a BARE `(symbol ...)` node — exactly what `buildSymbolLib` expects.
 */
export function buildStubSymbol(input: StubSymbolInput): string {
  const { mpn, pinout } = input;
  const symbolName = `STUB-${mpn}`;
  const pins = pinout?.pins ?? [];

  // Split pins L/R; size the body tall enough for the busier edge.
  const leftCount = Math.ceil(pins.length / 2);
  const rightCount = pins.length - leftCount;
  const rowsPerSide = Math.max(leftCount, rightCount, 1);
  const bodyHalfHeight = Math.max(GRID * 2, (rowsPerSide * PIN_PITCH) / 2 + GRID);

  const items: SNode[] = [
    sym("symbol"),
    str(symbolName),
    list([sym("in_bom"), sym("yes")]),
    list([sym("on_board"), sym("yes")]),
    // Reference U, sitting above the body.
    list([
      sym("property"),
      str("Reference"),
      str("U"),
      list([sym("at"), num(0), num(bodyHalfHeight + GRID), num(0)]),
      effects(),
    ]),
    // Value = mpn, below the reference.
    list([
      sym("property"),
      str("Value"),
      str(mpn),
      list([sym("at"), num(0), num(bodyHalfHeight + GRID * 2), num(0)]),
      effects(),
    ]),
    // Footprint left empty (the export's footprintFor() association fills it).
    list([
      sym("property"),
      str("Footprint"),
      str(""),
      list([sym("at"), num(0), num(0), num(0)]),
      effects([sym("hide")]),
    ]),
    // LOUD machine-readable marker property (hidden field but greppable + shows
    // in the symbol properties dialog).
    list([
      sym("property"),
      str("ki_description"),
      str("STUB — UNVERIFIED auto-generated placeholder. Replace with a real asset before fabrication."),
      list([sym("at"), num(0), num(0), num(0)]),
      effects([sym("hide")]),
    ]),
  ];

  // The drawable unit: KiCad nests graphics + pins in a `(symbol "<name>_0_1")`
  // sub-symbol. We use a single unit/style sub-symbol.
  const unitItems: SNode[] = [
    sym("symbol"),
    str(`${symbolName}_0_1`),
    // Body rectangle.
    list([
      sym("rectangle"),
      list([sym("start"), num(-BODY_HALF_WIDTH), num(bodyHalfHeight)]),
      list([sym("end"), num(BODY_HALF_WIDTH), num(-bodyHalfHeight)]),
      list([
        sym("stroke"),
        list([sym("width"), num(0)]),
        list([sym("type"), sym("default")]),
      ]),
      list([sym("fill"), list([sym("type"), sym("background")])]),
    ]),
    // Visible STUB banner text centred in the body.
    list([
      sym("text"),
      str("STUB · UNVERIFIED"),
      list([sym("at"), num(0), num(0), num(0)]),
      effects(),
    ]),
  ];

  if (pins.length === 0) {
    // Generic box: add a "no pinout" note so the learner knows why it's empty.
    unitItems.push(
      list([
        sym("text"),
        str("no pinout — replace this stub"),
        list([sym("at"), num(0), num(-GRID * 2), num(0)]),
        effects(),
      ]),
    );
  } else {
    let li = 0;
    let ri = 0;
    pins.forEach((pin, idx) => {
      const onLeft = idx < leftCount;
      if (onLeft) {
        const y = bodyHalfHeight - GRID - li * PIN_PITCH;
        unitItems.push(buildPinNode(pin, -(BODY_HALF_WIDTH + PIN_LENGTH), y, 0));
        li++;
      } else {
        const y = bodyHalfHeight - GRID - ri * PIN_PITCH;
        unitItems.push(buildPinNode(pin, BODY_HALF_WIDTH + PIN_LENGTH, y, 180));
        ri++;
      }
    });
  }

  items.push(list(unitItems));
  return serializeSexpr(list(items)) + "\n";
}

// ── Footprint geometry ─────────────────────────────────────────────────────
// A stub footprint is a courtyard/silk rectangle + the mpn + package on silk +
// a loud STUB marker. For common 2-terminal chip packages we size the rect (and
// drop 2 generic pads) roughly; everything else gets a default placeholder rect.
//
// Sizes are body half-extents in mm (rough, datasheet-typical). The learner
// replaces these — they exist only so the board has *something* to place.
type PkgGeom = {
  /** body half-width / half-height in mm */
  halfW: number;
  halfH: number;
  /** 2-terminal chip → emit 2 pads at ±padX */
  twoTerminal?: { padX: number; padW: number; padH: number };
};

const PACKAGE_GEOM: Record<string, PkgGeom> = {
  // Imperial chip packages (length × width in mm): rect ≈ body, pads at ends.
  "0402": { halfW: 0.5, halfH: 0.25, twoTerminal: { padX: 0.48, padW: 0.6, padH: 0.6 } },
  "0603": { halfW: 0.8, halfH: 0.4, twoTerminal: { padX: 0.75, padW: 0.8, padH: 0.9 } },
  "0805": { halfW: 1.0, halfH: 0.625, twoTerminal: { padX: 0.95, padW: 1.0, padH: 1.4 } },
  "1206": { halfW: 1.6, halfH: 0.8, twoTerminal: { padX: 1.5, padW: 1.0, padH: 1.8 } },
  // Small SOT / TSOT outlines (no pads in the stub — pin count varies; the
  // learner replaces the footprint, so a sized courtyard is enough).
  "sot-23": { halfW: 1.5, halfH: 0.7 },
  "sot-23-5": { halfW: 1.5, halfH: 0.95 },
  "sot-23-6": { halfW: 1.5, halfH: 0.95 },
  "tsot-23-5": { halfW: 1.5, halfH: 0.95 },
};

// Default placeholder when the package string is unknown/absent — a comfortably
// large rect so it's obviously a stub and easy to grab on the canvas.
const DEFAULT_GEOM: PkgGeom = { halfW: 2.5, halfH: 2.5 };

/** Look up a rough geometry for a package string (case-insensitive, trimmed). */
function geomFor(footprint: string | undefined): PkgGeom {
  if (!footprint) return DEFAULT_GEOM;
  const key = footprint.trim().toLowerCase();
  return PACKAGE_GEOM[key] ?? DEFAULT_GEOM;
}

/** A silk `(fp_text ...)` line. */
function fpText(kind: "reference" | "value" | "user", value: string, y: number): SNode {
  return list([
    sym("fp_text"),
    sym(kind),
    str(value),
    list([sym("at"), num(0), num(y), num(0)]),
    list([sym("layer"), str("F.SilkS")]),
    effects(),
  ]);
}

/** An `(fp_rect ...)` on a given layer (used for courtyard + silk outline). */
function fpRect(halfW: number, halfH: number, layer: string): SNode {
  return list([
    sym("fp_rect"),
    list([sym("start"), num(-halfW), num(-halfH)]),
    list([sym("end"), num(halfW), num(halfH)]),
    list([sym("stroke"), list([sym("width"), num(0.05)]), list([sym("type"), sym("default")])]),
    list([sym("fill"), sym("none")]),
    list([sym("layer"), str(layer)]),
  ]);
}

/** A generic SMD `(pad ...)` for a 2-terminal stub. */
function fpPad(name: string, x: number, w: number, h: number): SNode {
  return list([
    sym("pad"),
    str(name),
    sym("smd"),
    sym("roundrect"),
    list([sym("at"), num(x), num(0)]),
    list([sym("size"), num(w), num(h)]),
    list([sym("layers"), str("F.Cu"), str("F.Paste"), str("F.Mask")]),
    list([sym("roundrect_rratio"), num(0.25)]),
  ]);
}

export type StubFootprintInput = { mpn: string; footprint?: string };

/**
 * Synthesize a stub `(footprint "STUB-<mpn>" ...)`: a courtyard rectangle + a
 * silk outline + the mpn and package string on silk + a loud `STUB` marker. For
 * a recognised 2-terminal chip package (0402/0603/0805/1206) it adds 2 generic
 * SMD pads sized roughly to the package; SOT/TSOT outlines get a sized
 * courtyard only; unknown/absent packages get a default placeholder rectangle.
 *
 * This is a placeholder the learner REPLACES — it is intentionally minimal and
 * loudly marked, not a fabrication-ready footprint.
 */
export function buildStubFootprint(input: StubFootprintInput): string {
  const { mpn, footprint } = input;
  const geom = geomFor(footprint);
  const pkgLabel = footprint?.trim() || "unknown package";

  // Courtyard sits a touch outside the body.
  const crtW = geom.halfW + 0.25;
  const crtH = geom.halfH + 0.25;

  const items: SNode[] = [
    sym("footprint"),
    str(`STUB-${mpn}`),
    list([sym("layer"), str("F.Cu")]),
    list([sym("attr"), sym("through_hole")]),
    // Reference designator on silk (KiCad substitutes the real ref des).
    fpText("reference", "REF**", crtH + 0.5),
    // Value carries the mpn + STUB marker — visible on silk.
    fpText("value", `STUB ${mpn}`, -(crtH + 0.5)),
    // The package string as a user silk label.
    fpText("user", `pkg: ${pkgLabel} (UNVERIFIED stub)`, -(crtH + 1.5)),
    // Courtyard + silk outline rectangles.
    fpRect(crtW, crtH, "F.CrtYd"),
    fpRect(geom.halfW, geom.halfH, "F.SilkS"),
  ];

  if (geom.twoTerminal) {
    const { padX, padW, padH } = geom.twoTerminal;
    items.push(fpPad("1", -padX, padW, padH));
    items.push(fpPad("2", padX, padW, padH));
  }

  return serializeSexpr(list(items)) + "\n";
}
