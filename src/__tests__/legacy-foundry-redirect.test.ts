import { describe, it, expect } from "vitest";
import { legacyFoundryRedirect } from "@/lib/legacy-foundry-redirect";

describe("legacyFoundryRedirect", () => {
  it("strips the foundry- prefix from a /projects/ path, keeping the sub-path", () => {
    expect(
      legacyFoundryRedirect("/projects/foundry-l1-01-wroom-breakout/v1/guide"),
    ).toBe("/projects/l1-01-wroom-breakout/v1/guide");
  });

  it("rewrites a bare /projects/foundry-<slug> path", () => {
    expect(legacyFoundryRedirect("/projects/foundry-bn-01-usb-c-power-meter")).toBe(
      "/projects/bn-01-usb-c-power-meter",
    );
  });

  it("returns null for an already-clean /projects/ path", () => {
    expect(legacyFoundryRedirect("/projects/l1-01-wroom-breakout/v1/guide")).toBe(
      null,
    );
  });

  it("returns null for non-/projects paths", () => {
    expect(legacyFoundryRedirect("/learn")).toBe(null);
    expect(legacyFoundryRedirect("/parts/foundry-thing")).toBe(null);
    expect(legacyFoundryRedirect("/")).toBe(null);
  });
});
