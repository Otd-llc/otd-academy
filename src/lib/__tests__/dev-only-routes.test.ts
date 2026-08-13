// The dev-only route gate. See src/lib/dev-only-routes.ts for why this moved out
// of the pages: a page-level notFound() cannot set a 404 status on a route Next
// prerenders, and three routes were serving the 404 body with status 200 in
// production because of it.
//
// These tests are the reason the logic is a pure function rather than an inline
// condition in the middleware.

import { describe, it, expect } from "vitest";
import { isDevOnlyBlocked, DEV_ONLY_PREFIXES } from "../dev-only-routes";

const PROD = { NODE_ENV: "production" } as Record<string, string | undefined>;
const DEV = { NODE_ENV: "development" } as Record<string, string | undefined>;

describe("isDevOnlyBlocked", () => {
  it("blocks each dev-only prefix in production", () => {
    for (const p of DEV_ONLY_PREFIXES) {
      expect(isDevOnlyBlocked(`/${p}`, PROD), p).toBe(true);
      expect(isDevOnlyBlocked(`/${p}/anything/deeper`, PROD), p).toBe(true);
    }
  });

  it("blocks nothing outside production", () => {
    for (const p of DEV_ONLY_PREFIXES) {
      expect(isDevOnlyBlocked(`/${p}/x`, DEV), p).toBe(false);
    }
  });

  it("leaves real routes alone in production", () => {
    for (const p of ["/", "/library", "/library/ohms-law", "/courses", "/account", "/hex"]) {
      expect(isDevOnlyBlocked(p, PROD), p).toBe(false);
    }
  });

  // The bug a `startsWith` implementation would have. A lookalike prefix must
  // inherit neither the block nor, more importantly, the exemption.
  it("matches whole path segments, not string prefixes", () => {
    for (const p of ["/sandboxes", "/film-renderer", "/diagram-renderer", "/film", "/sandbox-x"]) {
      expect(isDevOnlyBlocked(p, PROD), p).toBe(false);
    }
  });

  describe("the export escape hatch", () => {
    it("re-opens diagram-render when DIAGRAM_EXPORT is set", () => {
      expect(isDevOnlyBlocked("/diagram-render/foo", { ...PROD, DIAGRAM_EXPORT: "1" })).toBe(false);
    });

    it("re-opens film-render when FILM_EXPORT is set", () => {
      expect(isDevOnlyBlocked("/film-render/logbook", { ...PROD, FILM_EXPORT: "1" })).toBe(false);
    });

    it("does not cross the wires between the two", () => {
      expect(isDevOnlyBlocked("/film-render/logbook", { ...PROD, DIAGRAM_EXPORT: "1" })).toBe(true);
      expect(isDevOnlyBlocked("/diagram-render/foo", { ...PROD, FILM_EXPORT: "1" })).toBe(true);
    });

    it("treats an empty value as unset", () => {
      // A deployment that carries `FILM_EXPORT=` should stay closed. An env var
      // that exists but says nothing is not a decision to open the route.
      expect(isDevOnlyBlocked("/film-render/logbook", { ...PROD, FILM_EXPORT: "" })).toBe(true);
    });

    it("gives /sandbox no hatch at all", () => {
      // Deliberate: a sandbox round is never captured from a deployed build.
      expect(
        isDevOnlyBlocked("/sandbox/share-cards", {
          ...PROD,
          FILM_EXPORT: "1",
          DIAGRAM_EXPORT: "1",
          SANDBOX_EXPORT: "1",
        }),
      ).toBe(true);
    });
  });

  // The three routes that were actually measured serving 200 in production on
  // 2026-08-13. Named individually so a regression points at the incident.
  it("blocks the three routes that were live with a soft 404", () => {
    expect(isDevOnlyBlocked("/film-render/logbook", PROD)).toBe(true);
    expect(isDevOnlyBlocked("/diagram-render/foo", PROD)).toBe(true);
    expect(isDevOnlyBlocked("/sandbox/share-cards", PROD)).toBe(true);
  });
});
