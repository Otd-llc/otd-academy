// The middleware matcher in src/proxy.ts decides which requests the auth gate
// ever sees. A path the matcher excludes never reaches `resolveRouteGate` at
// all, so an exclusion that is wider than intended is a silent auth bypass
// rather than a visible error.
//
// The matcher has to stay a literal inside `export const config` — Next reads it
// by static analysis at build time and cannot follow an imported constant — so
// it cannot be imported the way `isDevOnlyBlocked` is. This test reads the
// literal straight out of the source file instead.
//
// Escaping is the trap here. The file contains the TypeScript *source* of the
// string (`.*\\..*`), which is one backslash more than the value the regex
// engine sees (`.*\..*`). Comparing against the raw source text passes on a
// pattern that could never match, so the literal is run through JSON.parse to
// recover the real runtime value before it is tested.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function middlewareMatcher(): RegExp {
  const src = readFileSync(resolve(__dirname, "../../proxy.ts"), "utf8");
  // `[\s\S]` rather than `.` with the `s` flag: tsconfig targets ES2017, where
  // the dotAll flag is not available.
  const literal = src.match(/("\/\(\([\s\S]*?"),/);
  if (!literal) throw new Error("could not find the matcher literal in src/proxy.ts");
  return new RegExp(`^${JSON.parse(literal[1]) as string}$`);
}

const matcher = middlewareMatcher();
const runs = (pathname: string) => matcher.test(pathname);

describe("middleware matcher", () => {
  // The regression this file exists for. Revision labels are `[A-Za-z0-9 .-]+`
  // and the schema names `v1.1` as canonical vocabulary, so a dot in the URL is
  // ordinary data, not an asset request. While the matcher excluded every path
  // containing a dot, one normally-created revision took the whole operator
  // subtree out of the gate's reach.
  it("runs on operator routes whose revision label contains a dot", () => {
    for (const p of [
      "/projects/l1-01-wroom-breakout/v1.1",
      "/projects/l1-01-wroom-breakout/v1.1/builds/BUILD-001",
      "/projects/l1-01-wroom-breakout/v1.1/builds/BUILD-001/boards/SN001",
      "/projects/l1-01-wroom-breakout/v2.0/errata/new",
    ]) {
      expect(runs(p), p).toBe(true);
    }
  });

  it("runs on the plain operator and account routes", () => {
    for (const p of [
      "/account",
      "/admin/students",
      "/curriculum",
      "/projects/new",
      "/projects/l1-01-wroom-breakout/v1",
    ]) {
      expect(runs(p), p).toBe(true);
    }
  });

  // The exclusion the dot-escape was actually there to provide. These are
  // fetched by the browser directly and must not pay for a gate check.
  it("skips static asset requests", () => {
    for (const p of [
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/og/card.png",
      "/fonts/bebas.woff2",
      "/images/hex/thumb.webp",
      "/apple-touch-icon.png",
    ]) {
      expect(runs(p), p).toBe(false);
    }
  });

  it("skips the routes exempted by name", () => {
    for (const p of [
      "/api/auth/callback/resend",
      "/api/stripe/webhook",
      "/api/cron/lifecycle",
      "/api/printable-pack",
      "/api/printable/hex/base.3mf",
      "/sign-in",
    ]) {
      expect(runs(p), p).toBe(false);
    }
  });

  // A dot inside a path segment is not an extension. Anything the allowlist does
  // not name stays gated, so a new asset type fails closed (gated, working) not
  // open (ungated, silently public).
  it("does not treat an unrecognised dotted segment as an asset", () => {
    for (const p of [
      "/projects/some.slug/v1",
      "/library/ohms-law.notanextension",
      "/c/AbCdEf0123456789012345.x",
    ]) {
      expect(runs(p), p).toBe(true);
    }
  });
});
