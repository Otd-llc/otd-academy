// KiCad symbol-pin geometry (export-engine Task 7, design §3.4) — the crux.
//
// PURE (no React/DB/env/network/fs). KiCad schematics connect GEOMETRICALLY: a
// component pin is wired to a net only when a net-carrying element (a power-port
// pin, a label anchor, or a wire end) sits at that pin's EXACT connection
// coordinate. To auto-wire GND/+3V3/+5V we must, for each pin of a placed
// symbol, compute the absolute sheet coordinate of its connection point. This
// module does exactly that, plus parses pins out of a `.kicad_sym` body.
//
// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE CONVENTIONS (locked here; the math is unit-tested with hand-
// computed expecteds in kicad-pin-geometry.test.ts):
//
//   • Units: millimetres, the KiCad schematic unit.
//
//   • Y-AXIS: increases DOWNWARD (KiCad's native schematic/screen convention).
//     We do all math in this frame and emit coordinates directly, so no flip is
//     needed at serialization time.
//
//   • PIN ANCHOR = CONNECTION POINT. In a `.kicad_sym`, a pin's `(at x y angle)`
//     is the pin's ELECTRICAL connection point — the free end that sits OUTSIDE
//     the body (KLC S3.5) and that wires attach to. `length` is the distance
//     from that connection point BACK to the symbol body (the body sits at
//     anchor + length·unitVector(angle)). So the connection coordinate we wire
//     to is the transformed ANCHOR itself — we do NOT add `length`.
//
//     This matches real `.kicad_sym` files (e.g. SnapEDA's AP2112K) and the
//     shipped stubs.ts generator, which both place `(at)` at the connection end.
//     NOTE: the Task-7 brief described the connection end as
//     "anchor + length·unitVector(angle)", which is the INVERSE of real KiCad;
//     we deliberately follow KiCad so a carrier placed at our computed point
//     actually coincides with KiCad's own connection node. `length` and the
//     pin's intrinsic `angle` are retained (returned/used for orientation), so a
//     caller that wants the body-attach point can still derive it.
//
//   • PIN ANGLE (intrinsic, in the symbol definition): the direction the pin
//     extends FROM its connection point toward the body:
//       0 → +X (body to the right; a left-edge pin)
//       90 → +Y (body below)
//       180 → −X (body to the left; a right-edge pin)
//       270 → −Y (body above)
//
//   • INSTANCE TRANSFORM ORDER: symbol point → mirror (optional) → rotate(rot)
//     → translate by the instance (x, y). Rotation uses the matrix
//         x' = x·cos(rot) − y·sin(rot)
//         y' = x·sin(rot) + y·cos(rot)
//     (positive `rot` is CCW in the math frame; with Y-down it reads CW on
//     screen — KiCad's symbol-placement rotation). The returned `angle` is the
//     pin's intrinsic angle after the same mirror+rotation, normalised to
//     [0, 360).
// ─────────────────────────────────────────────────────────────────────────────

/** A symbol pin's intrinsic geometry, as parsed from a `.kicad_sym`. */
export type SymbolPin = {
  /** Pin connection-point X in symbol space (mm). */
  atX: number;
  /** Pin connection-point Y in symbol space (mm). */
  atY: number;
  /** Pin angle: 0=+X, 90=+Y, 180=−X, 270=−Y (direction toward the body). */
  angle: number;
  /** Pin length (mm) — distance from the connection point back to the body. */
  length: number;
};

/** A symbol instance placed on the sheet. `mirror` matches KiCad's "x"/"y" flip. */
export type SymbolInstance = {
  /** Instance origin X on the sheet (mm). */
  x: number;
  /** Instance origin Y on the sheet (mm). */
  y: number;
  /** Instance rotation in degrees (CCW in the math frame). */
  rotation: number;
  /**
   * Optional mirror, applied in symbol space BEFORE rotation:
   *   "x" → flip across the X axis (y → −y)
   *   "y" → flip across the Y axis (x → −x)
   */
  mirror?: "x" | "y";
};

/** Normalise an angle to [0, 360). */
function norm360(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** A pin's full parsed shape (geometry + identity). */
export type ExtractedPin = SymbolPin & {
  /** Pin number, e.g. "1" (the `(number ...)`). */
  number: string;
  /** Pin name, e.g. "GND" (the `(name ...)`). */
  name: string;
};

/**
 * Compute the absolute sheet coordinate (+ resulting orientation) of a symbol
 * pin's CONNECTION POINT, given the symbol-instance placement.
 *
 * The connection point is the pin's `(at)` anchor (see conventions above —
 * the anchor IS the connection node in KiCad, not anchor+length). We apply the
 * instance transform: mirror (optional) → rotate(rot) → translate by (x, y).
 *
 * Returns `{ x, y, angle }`: the absolute connection coordinate and the pin's
 * intrinsic angle after the same mirror+rotation (normalised to [0, 360)).
 */
export function pinConnectionPoint(
  pin: Pick<SymbolPin, "atX" | "atY" | "angle" | "length">,
  instance: SymbolInstance,
): { x: number; y: number; angle: number } {
  // 1. Connection point in symbol space (the anchor itself).
  let px = pin.atX;
  let py = pin.atY;
  // The pin's intrinsic direction, tracked alongside so we can report the final
  // orientation after mirror+rotate.
  let dir = norm360(pin.angle);

  // 2. Mirror (in symbol space, before rotation).
  if (instance.mirror === "y") {
    // flip across Y axis: x → −x; a +X-pointing pin becomes −X (180−dir).
    px = -px;
    dir = norm360(180 - dir);
  } else if (instance.mirror === "x") {
    // flip across X axis: y → −y; direction reflects about the X axis (−dir).
    py = -py;
    dir = norm360(-dir);
  }

  // 3. Rotate by the instance rotation. Y-down frame, matrix:
  //    x' = x·cos − y·sin ; y' = x·sin + y·cos.
  const rad = (instance.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;
  dir = norm360(dir + instance.rotation);

  // 4. Translate by the instance origin.
  return {
    x: roundMm(instance.x + rx),
    y: roundMm(instance.y + ry),
    angle: dir,
  };
}

/**
 * Round to 1e-6 mm to scrub floating-point noise from the rotation matrix while
 * staying well below KiCad's coordinate precision. Keeps golden output stable
 * and equality checks clean (e.g. a 90° rotation of 7.62 lands exactly back).
 */
function roundMm(n: number): number {
  const r = Math.round(n * 1e6) / 1e6;
  // Avoid a signed-zero (-0) leaking into output/equality.
  return r === 0 ? 0 : r;
}

// ── Pin extraction ──────────────────────────────────────────────────────────

import {
  parseSexpr,
  isList,
  isSym,
  head,
  atomValue,
  findChild,
  type SNode,
  type SList,
} from "@/lib/kicad/sexpr";

/** Recursively collect every `(pin ...)` list anywhere under `node`. */
function collectPins(node: SNode, out: SList[]): void {
  if (!isList(node)) return;
  for (const child of node.items) {
    if (isList(child)) {
      if (head(child) === "pin") out.push(child);
      else collectPins(child, out);
    }
  }
}

/**
 * The `(symbol ...)` node out of a `.kicad_sym` body, tolerating both real-world
 * shapes (a `(kicad_symbol_lib ... (symbol ...))` wrapper, or a bare
 * `(symbol ...)`). Mirrors symbol-lib.ts's tolerance.
 */
function rootSymbolNode(symbolText: string): SList {
  const node = parseSexpr(symbolText);
  if (!isList(node)) {
    throw new Error("extractSymbolPins: input is not an S-expression list");
  }
  if (head(node) === "symbol") return node;
  if (head(node) === "kicad_symbol_lib") {
    const inner = findChild(node, "symbol");
    if (inner) return inner;
    throw new Error(
      "extractSymbolPins: kicad_symbol_lib wrapper contains no (symbol ...)",
    );
  }
  throw new Error(
    `extractSymbolPins: expected (symbol ...) or (kicad_symbol_lib ...), got (${head(node) ?? "?"} ...)`,
  );
}

/** The string value of a single-arg child list, e.g. (number "1") → "1". */
function childArg(pin: SList, keyword: string): string | undefined {
  const c = findChild(pin, keyword);
  return c ? atomValue(c.items[1]) : undefined;
}

/**
 * Parse every `(pin ...)` out of a `.kicad_sym` `(symbol ...)` body and return
 * its `number`, `name`, connection-point `(atX, atY)`, `angle`, and `length`.
 *
 * Pins in a real symbol live inside the `(symbol "<name>_0_1" ...)` unit
 * sub-symbol(s), not directly under the top symbol; this descends the whole
 * tree to find them. A `(kicad_symbol_lib ...)` wrapper is unwrapped. A symbol
 * with no pins yields an empty list. Pins missing a parsable `(at x y angle)` or
 * `(length ...)` are skipped (a malformed pin can't be wired anyway).
 *
 * Pin shape (KiCad): `(pin <elec> <style> (at X Y ANGLE) (length L)
 *                       (name "N" ...) (number "P" ...))`.
 */
export function extractSymbolPins(symbolText: string): ExtractedPin[] {
  const root = rootSymbolNode(symbolText);
  const pinNodes: SList[] = [];
  collectPins(root, pinNodes);

  const out: ExtractedPin[] = [];
  for (const pin of pinNodes) {
    const at = findChild(pin, "at");
    const lengthNode = findChild(pin, "length");
    if (!at || !lengthNode) continue;

    const atX = Number(atomValue(at.items[1]));
    const atY = Number(atomValue(at.items[2]));
    // angle is optional in some shapes; default 0.
    const angleRaw = atomValue(at.items[3]);
    const angle = angleRaw === undefined ? 0 : Number(angleRaw);
    const length = Number(atomValue(lengthNode.items[1]));
    if (
      !Number.isFinite(atX) ||
      !Number.isFinite(atY) ||
      !Number.isFinite(angle) ||
      !Number.isFinite(length)
    ) {
      continue;
    }

    const number = childArg(pin, "number") ?? "";
    const name = childArg(pin, "name") ?? "";
    out.push({ number, name, atX, atY, angle, length });
  }
  return out;
}

// Re-export the guard used above for callers that want it without sexpr import.
export { isSym };
