// The unknown-static-param guard. See src/lib/static-param-404.ts for why this
// has to live in middleware: a prerendered route's status is committed before its
// notFound() runs, so /tools/<unknown> served the 404 body under a 200.
//
// These tests are the reason the logic is a pure function taking the known sets
// rather than an inline condition in the middleware that imports registries.

import { describe, it, expect } from "vitest";
import { isUnknownStaticParam, type KnownParams } from "../static-param-404";

const KNOWN: KnownParams = {
  tools: ["ohms-law", "voltage-divider", "lipo-battery-runtime"],
  briefs: ["overview", "learner"],
};

describe("isUnknownStaticParam", () => {
  it("refuses an unknown param on every guarded route", () => {
    for (const p of ["/tools/nope", "/embed/nope", "/briefs/nope"]) {
      expect(isUnknownStaticParam(p, KNOWN), p).toBe(true);
    }
  });

  it("lets a real param through", () => {
    for (const p of [
      "/tools/ohms-law",
      "/tools/voltage-divider",
      "/embed/lipo-battery-runtime",
      "/briefs/overview",
      "/briefs/learner",
    ]) {
      expect(isUnknownStaticParam(p, KNOWN), p).toBe(false);
    }
  });

  // The index pages are real routes with no param. Refusing them would 404 the
  // /tools hub, which is the opposite of the point.
  it("never refuses a guarded route's index page", () => {
    for (const p of ["/tools", "/tools/", "/embed", "/briefs", "/briefs/"]) {
      expect(isUnknownStaticParam(p, KNOWN), p).toBe(false);
    }
  });

  // /tools/[slug] is exactly one segment deep. A deeper path is not a route this
  // owns, so it must fall through to Next rather than be claimed here.
  it("ignores paths deeper than the route it guards", () => {
    for (const p of ["/tools/ohms-law/extra", "/tools/nope/deeper", "/briefs/overview/x"]) {
      expect(isUnknownStaticParam(p, KNOWN), p).toBe(false);
    }
  });

  it("leaves unguarded routes alone", () => {
    for (const p of [
      "/",
      "/library/ohms-law",
      "/courses/l1-01-wroom-breakout",
      "/parts/abc123",
      "/account",
      "/toolsy/nope",
      "/api/cron/revalidate",
    ]) {
      expect(isUnknownStaticParam(p, KNOWN), p).toBe(false);
    }
  });

  // A crawler percent-encodes. "ohms%2Dlaw" is the same tool as "ohms-law", and
  // refusing it would 404 a page that exists.
  it("decodes the param before comparing", () => {
    expect(isUnknownStaticParam("/tools/ohms%2Dlaw", KNOWN)).toBe(false);
    expect(isUnknownStaticParam("/tools/ohms%2Dlawx", KNOWN)).toBe(true);
  });

  // A malformed escape cannot name a real tool, so it is refused rather than
  // thrown on — a decode error in middleware would be a 500 on a crawler hit.
  it("refuses a malformed escape instead of throwing", () => {
    expect(() => isUnknownStaticParam("/tools/%E0%A4%A", KNOWN)).not.toThrow();
    expect(isUnknownStaticParam("/tools/%E0%A4%A", KNOWN)).toBe(true);
  });

  // The guard must not go quietly inert if a registry is empty: every param would
  // then be "unknown", which is loud and obvious, rather than every param being
  // allowed, which is the failure that hides.
  it("fails closed on an empty known set", () => {
    expect(isUnknownStaticParam("/tools/ohms-law", { tools: [], briefs: [] })).toBe(true);
  });
});
