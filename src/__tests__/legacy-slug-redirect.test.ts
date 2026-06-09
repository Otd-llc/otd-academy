import { describe, it, expect } from "vitest";
import { legacySlugRedirect } from "@/lib/legacy-slug-redirect";

describe("legacySlugRedirect", () => {
  it("strips the legacy foundry- prefix from a /projects/ path, keeping the sub-path", () => {
    expect(
      legacySlugRedirect("/projects/foundry-l1-01-wroom-breakout/v1/guide"),
    ).toBe("/projects/l1-01-wroom-breakout/v1/guide");
  });

  it("rewrites a bare /projects/foundry-<slug> path", () => {
    expect(legacySlugRedirect("/projects/foundry-bn-01-usb-c-power-meter")).toBe(
      "/projects/bn-01-usb-c-power-meter",
    );
  });

  it("returns null for an already-clean /projects/ path", () => {
    expect(legacySlugRedirect("/projects/l1-01-wroom-breakout/v1/guide")).toBe(
      null,
    );
  });

  it("returns null for non-/projects paths", () => {
    expect(legacySlugRedirect("/learn")).toBe(null);
    expect(legacySlugRedirect("/parts/foundry-thing")).toBe(null);
    expect(legacySlugRedirect("/")).toBe(null);
  });
});
