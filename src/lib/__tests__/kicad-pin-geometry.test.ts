// Tests for KiCad symbol-pin geometry (export-engine Task 7, design §3.4).
//
// This is the RISKIEST math in the whole export feature: power/ground rails are
// wired GEOMETRICALLY in a `.kicad_sch` — a component pin is connected to a net
// only if a net-carrier (power port / label) sits at the pin's EXACT connection
// coordinate. So we must, for each pin, compute the absolute sheet coordinate of
// its connection point given the symbol-instance placement. These tests
// hand-compute the expected coordinate at instance rotations 0/90/180/270 and a
// mirrored case and assert the module reproduces them exactly.
//
// CONVENTIONS UNDER TEST (documented fully in pin-geometry.ts):
//   - Coordinates are KiCad schematic mm with Y increasing DOWNWARD (screen).
//   - A symbol pin's `(at x y angle)` IS its electrical connection point (the
//     free end, outside the body); `length` is the distance back to the body.
//     This matches real `.kicad_sym` files and the shipped stubs.ts generator,
//     so a carrier placed at the transformed `(at)` coincides with KiCad's own
//     connection node. (The task's "anchor + length·unitVector" wording is the
//     inverse of real KiCad; we follow KiCad so the wiring actually connects.)
//   - Instance transform order: symbol point → mirror → rotate(rot, Y-down) →
//     translate by instance (x, y). Rotation uses the matrix
//       x' = x·cos(rot) − y·sin(rot)
//       y' = x·sin(rot) + y·cos(rot)
//     (a positive `rot` is CCW in the math frame; with Y-down it reads CW on
//     screen — KiCad's symbol-placement rotation).

import { describe, expect, test } from "vitest";
import {
  pinConnectionPoint,
  extractSymbolPins,
} from "@/lib/kicad/pin-geometry";

// Round helper — float math leaves 1e-15 noise; assert to a sane mm precision.
function near(actual: number, expected: number, eps = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
}

// A single reference pin: connection point (the `(at)`) at (-7.62, 0), pin
// pointing toward +X (angle 0) — i.e. the body is to the right of the pin, the
// connection node is at x=-7.62. This mirrors SAMPLE_SYM's VIN pin.
const PIN = { atX: -7.62, atY: 0, angle: 0, length: 2.54 };

describe("pin-geometry — pinConnectionPoint at instance rotations", () => {
  test("rotation 0: connection point is the anchor translated by the instance", () => {
    // symbol point (-7.62, 0) → no rotation → translate by (100, 50)
    // = (100 - 7.62, 50 + 0) = (92.38, 50)
    const p = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 0 });
    near(p.x, 92.38);
    near(p.y, 50);
    // pin direction unchanged at rotation 0
    expect(((p.angle % 360) + 360) % 360).toBe(0);
  });

  test("rotation 90: (x,y) → (-y, x) then translate", () => {
    // rot 90: x' = x·0 − y·1 = -y ; y' = x·1 + y·0 = x
    // symbol (-7.62, 0) → (-0, -7.62) = (0, -7.62) ; translate (100, 50)
    // = (100, 50 - 7.62) = (100, 42.38)
    const p = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 90 });
    near(p.x, 100);
    near(p.y, 42.38);
    // pin angle rotates by +90
    expect(((p.angle % 360) + 360) % 360).toBe(90);
  });

  test("rotation 180: (x,y) → (-x, -y) then translate", () => {
    // symbol (-7.62, 0) → (7.62, 0) ; translate (100, 50) = (107.62, 50)
    const p = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 180 });
    near(p.x, 107.62);
    near(p.y, 50);
    expect(((p.angle % 360) + 360) % 360).toBe(180);
  });

  test("rotation 270: (x,y) → (y, -x) then translate", () => {
    // rot 270: x' = x·0 − y·(-1) = y ; y' = x·(-1) + y·0 = -x
    // symbol (-7.62, 0) → (0, 7.62) ; translate (100, 50) = (100, 57.62)
    const p = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 270 });
    near(p.x, 100);
    near(p.y, 57.62);
    expect(((p.angle % 360) + 360) % 360).toBe(270);
  });

  test("mirror 'y' (flip across Y axis: x → -x) before rotation", () => {
    // mirror y: symbol (-7.62, 0) → (7.62, 0) ; rotation 0 ; translate (100,50)
    // = (107.62, 50). Pin that pointed +X now points -X → angle 180.
    const p = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 0, mirror: "y" });
    near(p.x, 107.62);
    near(p.y, 50);
    expect(((p.angle % 360) + 360) % 360).toBe(180);
  });

  test("mirror 'x' (flip across X axis: y → -y) before rotation", () => {
    // A pin off the X-axis to show the y-flip. Connection point (0, -2.54),
    // angle 90 (points +Y toward body). mirror x → (0, 2.54), angle → 270.
    const pin = { atX: 0, atY: -2.54, angle: 90, length: 2.54 };
    const p = pinConnectionPoint(pin, { x: 10, y: 20, rotation: 0, mirror: "x" });
    near(p.x, 10);
    near(p.y, 22.54); // 20 + 2.54
    expect(((p.angle % 360) + 360) % 360).toBe(270);
  });

  test("combined: rotation 90 on an off-axis pin", () => {
    // Connection point (-7.62, 2.54), angle 0. rot 90: (x,y)→(-y,x)
    // → (-2.54, -7.62) ; translate (100, 100) = (97.46, 92.38).
    const pin = { atX: -7.62, atY: 2.54, angle: 0, length: 2.54 };
    const p = pinConnectionPoint(pin, { x: 100, y: 100, rotation: 90 });
    near(p.x, 97.46);
    near(p.y, 92.38);
    expect(((p.angle % 360) + 360) % 360).toBe(90);
  });

  test("is a pure function — repeated calls give identical results", () => {
    const a = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 90 });
    const b = pinConnectionPoint(PIN, { x: 100, y: 50, rotation: 90 });
    expect(a).toEqual(b);
  });
});

// ── extractSymbolPins — parse pins out of a real (symbol ...) body ──────────

// A real-shape symbol: pins live inside the `(symbol "<name>_0_1" ...)` unit
// sub-symbol, NOT directly under the top symbol. extractSymbolPins must descend
// into the unit symbol(s) and pull every pin's number/name/(at)/length.
const SAMPLE_SYM = `(symbol "AP2112K-3.3" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0)
    (effects (font (size 1.27 1.27)))
  )
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
)`;

describe("pin-geometry — extractSymbolPins", () => {
  test("pulls every pin's number, name, (at x y angle) and length from the unit symbol", () => {
    const pins = extractSymbolPins(SAMPLE_SYM);
    expect(pins).toHaveLength(3);

    const byNumber = new Map(pins.map((p) => [p.number, p]));
    expect(byNumber.get("1")).toEqual({
      number: "1",
      name: "VIN",
      atX: -7.62,
      atY: 0,
      angle: 0,
      length: 2.54,
    });
    expect(byNumber.get("2")).toEqual({
      number: "2",
      name: "GND",
      atX: -7.62,
      atY: -2.54,
      angle: 0,
      length: 2.54,
    });
    expect(byNumber.get("5")).toEqual({
      number: "5",
      name: "VOUT",
      atX: 7.62,
      atY: 0,
      angle: 180,
      length: 2.54,
    });
  });

  test("tolerates a kicad_symbol_lib wrapper around the symbol", () => {
    const wrapped = `(kicad_symbol_lib (version 20211014) (generator x)\n${SAMPLE_SYM}\n)`;
    const pins = extractSymbolPins(wrapped);
    expect(pins).toHaveLength(3);
  });

  test("tolerates a bare (symbol ...) with no pins → empty list", () => {
    const noPins = `(symbol "EMPTY" (in_bom yes) (on_board yes))`;
    expect(extractSymbolPins(noPins)).toEqual([]);
  });

  test("feeds straight into pinConnectionPoint", () => {
    const pins = extractSymbolPins(SAMPLE_SYM);
    const gnd = pins.find((p) => p.name === "GND")!;
    // GND connection (-7.62, -2.54) at instance (50, 50, 0) → (42.38, 47.46)
    const p = pinConnectionPoint(gnd, { x: 50, y: 50, rotation: 0 });
    near(p.x, 42.38);
    near(p.y, 47.46);
  });
});
