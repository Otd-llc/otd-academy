import { describe, it, expect } from "vitest";
import {
  resolveSignIn,
  SESSION_CONFLICT_REDIRECT,
  RATE_LIMITED_REDIRECT,
} from "@/lib/auth-link-guard";

// `resolveSignIn` is the pure decision behind the NextAuth `signIn` callback.
// It returns `true` to allow, `false` to reject outright, or a redirect-path
// string to bounce the user with a friendly message.
//
// The case that matters most: Auth.js silently LINKS a never-before-seen OAuth
// account onto whatever user is currently signed in (handle-login.js). We never
// offer "connect another account", so an active session whose email differs from
// the incoming profile means someone is signing in as a different person without
// signing out first — block it.
//
// The guard is provider-aware but stays a PURE function: the caller (auth.ts)
// computes `emailVerified` per provider (Google's profile.email_verified, the
// GitHub verified-primary email, magic-link verified-by-construction) and passes
// it in. The guard only knows the rules, not the providers' wire formats.
describe("resolveSignIn", () => {
  const base = {
    provider: "google" as string | undefined,
    emailVerified: true as boolean | undefined,
    profileEmail: "brooke@example.com" as string | undefined,
    activeUserEmail: undefined as string | undefined,
    isVerificationRequest: false as boolean | undefined,
  };

  // ── Provider allowlist ────────────────────────────────────────────────
  it("rejects unknown providers", () => {
    expect(resolveSignIn({ ...base, provider: "twitter" })).toBe(false);
    expect(resolveSignIn({ ...base, provider: undefined })).toBe(false);
  });

  // ── Google (regression: the original resolveGoogleSignIn behaviour) ────
  it("allows a verified google sign-in with no active session", () => {
    expect(resolveSignIn({ ...base, activeUserEmail: undefined })).toBe(true);
  });

  it("rejects when the profile email is missing", () => {
    expect(resolveSignIn({ ...base, profileEmail: undefined })).toBe(false);
  });

  it("rejects unverified google emails", () => {
    expect(resolveSignIn({ ...base, emailVerified: false })).toBe(false);
    expect(resolveSignIn({ ...base, emailVerified: undefined })).toBe(false);
  });

  it("allows re-authenticating as the same already-signed-in user", () => {
    expect(
      resolveSignIn({
        ...base,
        profileEmail: "raven@example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(true);
  });

  it("matches the active user case-insensitively", () => {
    expect(
      resolveSignIn({
        ...base,
        profileEmail: "Raven@Example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(true);
  });

  it("blocks linking a different google account onto an active session", () => {
    expect(
      resolveSignIn({
        ...base,
        profileEmail: "brooke@example.com",
        activeUserEmail: "raven@example.com",
      }),
    ).toBe(SESSION_CONFLICT_REDIRECT);
  });

  // ── GitHub ────────────────────────────────────────────────────────────
  it("allows a github sign-in with a verified primary email", () => {
    expect(resolveSignIn({ ...base, provider: "github", emailVerified: true })).toBe(true);
  });

  it("rejects a github sign-in whose primary email is unverified", () => {
    expect(resolveSignIn({ ...base, provider: "github", emailVerified: false })).toBe(false);
    expect(resolveSignIn({ ...base, provider: "github", emailVerified: undefined })).toBe(false);
  });

  it("rejects a github sign-in with no resolvable email", () => {
    expect(
      resolveSignIn({ ...base, provider: "github", profileEmail: undefined }),
    ).toBe(false);
  });

  // ── Magic-link (Resend, type: "email") ────────────────────────────────
  it("allows the magic-link SEND step (verification request, not yet verified)", () => {
    // At the send step Auth.js passes email.verificationRequest=true with no
    // verified email yet — there is nothing to verify, it's just emailing a token.
    expect(
      resolveSignIn({
        ...base,
        provider: "resend",
        emailVerified: undefined,
        isVerificationRequest: true,
      }),
    ).toBe(true);
  });

  it("bounces a magic-link SEND step requested while signed in as someone else", () => {
    expect(
      resolveSignIn({
        ...base,
        provider: "resend",
        profileEmail: "brooke@example.com",
        activeUserEmail: "raven@example.com",
        emailVerified: undefined,
        isVerificationRequest: true,
      }),
    ).toBe(SESSION_CONFLICT_REDIRECT);
  });

  it("allows a magic-link click (verified by construction)", () => {
    expect(
      resolveSignIn({ ...base, provider: "resend", emailVerified: true }),
    ).toBe(true);
  });

  it("rejects a magic-link CLICK that is not flagged verified", () => {
    // A click (isVerificationRequest=false) must still carry emailVerified=true;
    // a falsy flag here means we never confirmed inbox control — reject.
    expect(
      resolveSignIn({ ...base, provider: "resend", emailVerified: false }),
    ).toBe(false);
    expect(
      resolveSignIn({ ...base, provider: "resend", emailVerified: undefined }),
    ).toBe(false);
  });

  it("rejects a verification-request that somehow has no email", () => {
    // The missing-email check precedes the send-step branch, so a send step with
    // no resolvable address is rejected rather than allowed.
    expect(
      resolveSignIn({
        ...base,
        provider: "resend",
        profileEmail: undefined,
        emailVerified: undefined,
        isVerificationRequest: true,
      }),
    ).toBe(false);
  });

  it("blocks a magic-link click that would link onto a different active session", () => {
    expect(
      resolveSignIn({
        ...base,
        provider: "resend",
        profileEmail: "brooke@example.com",
        activeUserEmail: "raven@example.com",
        emailVerified: true,
      }),
    ).toBe(SESSION_CONFLICT_REDIRECT);
  });

  // ── Cross-provider conflict ───────────────────────────────────────────
  it("blocks linking a verified github account onto a different active session", () => {
    expect(
      resolveSignIn({
        ...base,
        provider: "github",
        profileEmail: "brooke@example.com",
        activeUserEmail: "raven@example.com",
        emailVerified: true,
      }),
    ).toBe(SESSION_CONFLICT_REDIRECT);
  });
});

describe("RATE_LIMITED_REDIRECT", () => {
  it("is the generic rate-limit redirect, distinct from session_conflict", () => {
    expect(RATE_LIMITED_REDIRECT).toBe("/sign-in?error=rate_limited");
    expect(RATE_LIMITED_REDIRECT).not.toBe(SESSION_CONFLICT_REDIRECT);
  });
});
