import { describe, it, expect } from "vitest";
import { applySessionClaims } from "@/lib/session-claims";

// The session callback's pure core. Auth.js puts the DB user id in `token.sub`
// at initial sign-in (adapter `user.id`); copying it onto `session.user.id`
// lets every server surface that only needs the id skip a
// `db.user.findUnique({ where: { email } })` round trip (one per authed
// request before this existed).
describe("applySessionClaims", () => {
  const session = () =>
    ({ user: { email: "raven@example.com" } }) as Parameters<typeof applySessionClaims>[0];

  it("copies token.sub onto session.user.id", () => {
    const out = applySessionClaims(session(), { sub: "usr_123", role: "LEARNER" });
    expect(out.user?.id).toBe("usr_123");
  });

  it("copies the role, defaulting to LEARNER", () => {
    expect(applySessionClaims(session(), { sub: "u" }).user?.role).toBe("LEARNER");
    expect(applySessionClaims(session(), { sub: "u", role: "ADMIN" }).user?.role).toBe("ADMIN");
  });

  it("leaves session.user.id unset when token.sub is missing", () => {
    const out = applySessionClaims(session(), {});
    expect(out.user?.id).toBeUndefined();
  });

  it("is a no-op on a session with no user", () => {
    const bare = {} as Parameters<typeof applySessionClaims>[0];
    expect(applySessionClaims(bare, { sub: "u" })).toBe(bare);
  });
});
