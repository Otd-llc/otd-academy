import { describe, it, expect } from "vitest";
import { resolveGoogleSignIn, SESSION_CONFLICT_REDIRECT } from "@/lib/auth-link-guard";

// `resolveGoogleSignIn` is the pure decision behind the NextAuth `signIn`
// callback. It returns `true` to allow, `false` to reject outright, or a
// redirect-path string to bounce the user with a friendly message.
//
// The case that matters most: Auth.js silently LINKS a never-before-seen
// OAuth account onto whatever user is currently signed in (handle-login.js).
// We never offer "connect another account", so an active session whose email
// differs from the incoming Google profile means someone is signing in as a
// different person without signing out first — block it.
describe("resolveGoogleSignIn", () => {
  const base = {
    provider: "google",
    emailVerified: true,
    profileEmail: "brooke@example.com",
    activeUserEmail: undefined as string | undefined,
  };

  it("rejects non-google providers", () => {
    expect(resolveGoogleSignIn({ ...base, provider: "github" })).toBe(false);
  });

  it("rejects when the profile email is missing", () => {
    expect(resolveGoogleSignIn({ ...base, profileEmail: undefined })).toBe(false);
  });

  it("rejects unverified google emails", () => {
    expect(resolveGoogleSignIn({ ...base, emailVerified: false })).toBe(false);
    expect(resolveGoogleSignIn({ ...base, emailVerified: undefined })).toBe(false);
  });

  it("allows a verified google sign-in with no active session (new/normal login)", () => {
    expect(resolveGoogleSignIn({ ...base, activeUserEmail: undefined })).toBe(true);
  });

  it("allows re-authenticating as the same already-signed-in user", () => {
    expect(
      resolveGoogleSignIn({
        ...base,
        profileEmail: "raven@example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(true);
  });

  it("matches the active user case-insensitively", () => {
    expect(
      resolveGoogleSignIn({
        ...base,
        profileEmail: "Raven@Example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(true);
  });

  it("blocks linking a different google account onto an active session", () => {
    expect(
      resolveGoogleSignIn({
        ...base,
        profileEmail: "brooke@example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(SESSION_CONFLICT_REDIRECT);
  });
});
