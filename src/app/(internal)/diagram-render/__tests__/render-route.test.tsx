import { describe, it, expect } from "vitest";
import { basenameOf, resolveDiagramKey, allDiagramBasenames } from "../[key]/resolve";

describe("basenameOf", () => {
  it("strips the /guide-diagrams/ prefix and .svg suffix", () => {
    expect(basenameOf("/guide-diagrams/adc1-pin-map.svg")).toBe("adc1-pin-map");
  });
});

describe("resolveDiagramKey", () => {
  it("maps a known basename to its registry entry", () => {
    const entry = resolveDiagramKey("adc1-pin-map");
    expect(entry).toBeTruthy();
    expect(entry?.key).toBe("/guide-diagrams/adc1-pin-map.svg");
  });

  it("returns null for an unknown basename", () => {
    expect(resolveDiagramKey("does-not-exist")).toBeNull();
  });
});

describe("allDiagramBasenames", () => {
  it("returns every registered diagram as a bare basename", () => {
    const names = allDiagramBasenames();
    expect(names).toContain("adc1-pin-map");
    expect(names.length).toBeGreaterThanOrEqual(14);
    expect(names.every((n) => !n.includes("/") && !n.endsWith(".svg"))).toBe(true);
  });
});
