// The c15t cookie parser behind the server-side consent rule. Fixtures are the
// exact strings c15t 2.2.1's `setCookie` writes (flatten + shorten + `k:v,`),
// read from its dist rather than recalled.
import { describe, expect, it } from "vitest";

import { measurementGranted } from "@/lib/server-consent";

describe("measurementGranted", () => {
  it("is true only for c.measurement:1", () => {
    expect(
      measurementGranted("c.necessary:1,c.measurement:1,i.time:1759000000000,i.type:all"),
    ).toBe(true);
    expect(measurementGranted("c.measurement:1")).toBe(true);
    expect(measurementGranted(encodeURIComponent("c.necessary:1,c.measurement:1"))).toBe(true);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["Reject All (refused categories are omitted)", "c.necessary:1,i.time:1759000000000"],
    ["zero", "c.measurement:0"],
    ["true spelled out", "c.measurement:true"],
    ["another category granted", "c.necessary:1,c.marketing:1"],
    ["a lookalike key", "c.measurementX:1,xc.measurement:1"],
    ["JSON", JSON.stringify({ consents: { measurement: true } })],
    ["garbage", "%%%"],
  ])("is false when %s", (_label, value) => {
    expect(measurementGranted(value)).toBe(false);
  });
});
