// The route auth gate, unit-tested in isolation from the edge runtime.
//
// The load-bearing case is "a rejected-config session" below. Auth.js assigns a
// truthy ERROR OBJECT (not null) to `req.auth` when it refuses to run — an
// untrusted host, a bad secret. The proxy used to gate on `!req.auth`, so that
// object read as "signed in" and every non-public route FAILED OPEN. This test
// pins the fix (gate on `.user`) so it cannot be simplified back.
import { describe, it, expect } from "vitest";
import { resolveRouteGate, type GateSession } from "@/lib/route-gate";

const admin: GateSession = { user: { role: "ADMIN" } };
const learner: GateSession = { user: { role: "LEARNER" } };
const roleless: GateSession = { user: {} }; // signed in, role momentarily absent

// Exactly what was observed in req.auth when Auth.js rejected the host:
const authError = {
  message: "There was a problem with the server configuration.",
} as unknown as GateSession;

describe("resolveRouteGate", () => {
  describe("unauthenticated (null)", () => {
    it("redirects a non-public route to /sign-in", () => {
      expect(resolveRouteGate(null, "/account")).toBe("/sign-in");
      expect(resolveRouteGate(null, "/admin/students")).toBe("/sign-in");
      expect(resolveRouteGate(null, "/learn")).toBe("/sign-in");
    });
    it("lets a public route through", () => {
      expect(resolveRouteGate(null, "/library")).toBeNull();
      expect(resolveRouteGate(null, "/parts")).toBeNull();
      expect(resolveRouteGate(null, "/")).toBeNull();
    });
  });

  describe("a rejected-config session (truthy, no user) — the fail-open bug", () => {
    it("is treated as signed-OUT on a non-public route (fail CLOSED)", () => {
      // A `!session` check returns null here and serves the page. Gating on
      // `.user` is the entire fix — do not weaken these two assertions.
      expect(resolveRouteGate(authError, "/account")).toBe("/sign-in");
      expect(resolveRouteGate(authError, "/admin/students")).toBe("/sign-in");
    });
    it("still lets a public route through", () => {
      expect(resolveRouteGate(authError, "/library")).toBeNull();
    });
  });

  describe("signed in", () => {
    it("lets an ADMIN into everything", () => {
      expect(resolveRouteGate(admin, "/admin/students")).toBeNull();
      expect(resolveRouteGate(admin, "/curriculum")).toBeNull();
      expect(resolveRouteGate(admin, "/account")).toBeNull();
    });
    it("bounces an explicit LEARNER off an admin-only view to /learn", () => {
      expect(resolveRouteGate(learner, "/curriculum")).toBe("/learn");
      expect(resolveRouteGate(learner, "/admin/students")).toBe("/learn");
      expect(resolveRouteGate(learner, "/parts/new")).toBe("/learn");
    });
    it("lets a LEARNER into non-admin routes (incl. public guide)", () => {
      expect(resolveRouteGate(learner, "/account")).toBeNull();
      expect(resolveRouteGate(learner, "/learn")).toBeNull();
      expect(resolveRouteGate(learner, "/projects/x/v1/guide")).toBeNull();
    });
    it("does NOT lock out a signed-in user whose role is momentarily absent", () => {
      // An absent role must degrade to a no-op, never be read as LEARNER.
      expect(resolveRouteGate(roleless, "/curriculum")).toBeNull();
      expect(resolveRouteGate(roleless, "/account")).toBeNull();
    });
  });
});
