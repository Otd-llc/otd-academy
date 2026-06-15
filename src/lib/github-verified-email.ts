// GitHub's OAuth profile carries no "email verified" flag, so auth.ts resolves
// the account email from the GitHub /user/emails endpoint. This pure function
// picks the VERIFIED PRIMARY email — the one address the user considers their
// GitHub identity. It deliberately does NOT fall back to a verified *secondary*
// email: cross-provider account-linking keys on this value, so a predictable
// "your primary, and only if verified" rule avoids silently linking onto an
// address the user didn't expect. No verified primary → undefined → the sign-in
// guard rejects (fail closed).
//
// Extracted as a pure function so the selection logic is unit-tested directly,
// not just via the downstream guard.

export type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export function pickVerifiedGithubEmail(emails: GitHubEmail[]): string | undefined {
  if (!Array.isArray(emails)) return undefined;
  return emails.find((e) => e.primary && e.verified)?.email;
}
