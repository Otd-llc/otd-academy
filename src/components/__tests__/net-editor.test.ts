// Unit tests for the pure helpers behind NetEditor — the `refDes.pin` node-key
// formatter and the add-node draft validity check. The component itself (JSX +
// client interaction) is verified by `tsc`/`build` + running the app, since the
// vitest env is `node` with no DOM harness (mirrors page-header.test.ts); only
// the extractable pure logic is exercised here.

import { describe, it, expect } from "vitest";
import { nodeLabel, canAddNode } from "@/components/nets/net-editor-logic";

describe("nodeLabel", () => {
  it("joins refDes and pin with a dot", () => {
    expect(nodeLabel("U1", "12")).toBe("U1.12");
    expect(nodeLabel("C2", "1")).toBe("C2.1");
  });

  it("trims surrounding whitespace on both sides", () => {
    expect(nodeLabel("  U1  ", "  3 ")).toBe("U1.3");
  });

  it("collapses to the present side when the other is empty (no stray dot)", () => {
    expect(nodeLabel("U1", "")).toBe("U1");
    expect(nodeLabel("U1", "   ")).toBe("U1");
    expect(nodeLabel("", "3")).toBe("3");
    expect(nodeLabel("  ", "VOUT")).toBe("VOUT");
  });

  it("returns an empty string when both sides are blank", () => {
    expect(nodeLabel("", "")).toBe("");
    expect(nodeLabel("  ", "  ")).toBe("");
  });

  it("preserves a named pin (PINOUT pin name, not just a number)", () => {
    expect(nodeLabel("U2", "VOUT")).toBe("U2.VOUT");
  });
});

describe("canAddNode", () => {
  it("requires BOTH a refDes and a pin", () => {
    expect(canAddNode("U1", "3")).toBe(true);
  });

  it("is false when either side is empty or whitespace-only", () => {
    expect(canAddNode("", "3")).toBe(false);
    expect(canAddNode("U1", "")).toBe(false);
    expect(canAddNode("   ", "3")).toBe(false);
    expect(canAddNode("U1", "   ")).toBe(false);
    expect(canAddNode("", "")).toBe(false);
  });

  it("ignores surrounding whitespace when deciding validity", () => {
    expect(canAddNode("  U1  ", "  3  ")).toBe(true);
  });
});
