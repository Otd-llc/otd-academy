// Pure gate for the post-signup lifecycle-email consent prompt (GDPR opt-in),
// mirroring shouldRenderChrome. Show it exactly once: only for a signed-in user
// whose row loaded and who has never made an email choice
// (emailConsentUpdatedAt == null). Suppressed on /account, which has its own Email
// toggle. Kept pure so the decision is unit-testable without rendering the layout.
export function shouldAskEmailConsent(input: {
  signedIn: boolean;
  account: { emailConsentUpdatedAt: Date | null } | null;
  pathname: string;
}): boolean {
  if (!input.signedIn || !input.account) return false;
  if (input.account.emailConsentUpdatedAt != null) return false; // already chose
  if (input.pathname.startsWith("/account")) return false; // toggle lives there
  return true;
}
