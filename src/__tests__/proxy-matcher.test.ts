import { describe, it, expect, vi } from "vitest";

// Importing proxy.ts evaluates `export default auth(...)`. Mock `@/auth` so that
// wrapper is a passthrough and Auth.js isn't initialized — we only assert on the
// exported `config.matcher`, which decides WHICH paths run the auth middleware.
vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));

import { config } from "@/proxy";

// Next compiles each matcher string as an anchored regex to decide whether the
// middleware runs for a given path. Reproduce that anchoring here.
const runsMiddleware = (path: string) =>
  config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("middleware matcher", () => {
  it("does NOT run the auth middleware on the Stripe webhook", () => {
    // Stripe POSTs server-to-server with no session cookie; if the middleware
    // ran it would 307-redirect to /sign-in and the webhook would never verify
    // the signature or grant the entitlement. Regression guard for that bug.
    expect(runsMiddleware("/api/stripe/webhook")).toBe(false);
  });

  it("excludes Auth.js routes, sign-in, the SEO crawl files, and public/ static assets", () => {
    expect(runsMiddleware("/api/auth/callback/google")).toBe(false);
    expect(runsMiddleware("/sign-in")).toBe(false);
    expect(runsMiddleware("/sitemap.xml")).toBe(false);
    expect(runsMiddleware("/robots.txt")).toBe(false);
    // public/ files (served outside _next) must NOT be 307'd to /sign-in, or
    // the guide-diagram SVGs (and any public asset) break for signed-out users.
    expect(runsMiddleware("/guide-diagrams/wroom-power-flow.svg")).toBe(false);
    expect(runsMiddleware("/brand/1kd-icon.svg")).toBe(false);
  });

  it("DOES run on app pages so auth/role gating + chrome still apply", () => {
    expect(runsMiddleware("/learn")).toBe(true);
    expect(runsMiddleware("/projects/wroom/v1/guide")).toBe(true);
    expect(runsMiddleware("/parts")).toBe(true);
    expect(runsMiddleware("/curriculum")).toBe(true);
  });
});
