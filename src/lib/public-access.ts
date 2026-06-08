// Page-level gate for guide routes (middleware admits them; the page decides).
// Signed-in users fall through to the existing role/enrollment logic. Anonymous
// users may read only PUBLIC projects; otherwise they're sent to sign in.
export function resolvePublicLessonAccess(input: {
  hasSession: boolean;
  accessTier: string;
}): "allow" | "redirectSignIn" {
  if (input.hasSession) return "allow";
  return input.accessTier === "PUBLIC" ? "allow" : "redirectSignIn";
}

// Richer access decision (supersedes resolvePublicLessonAccess). Turns
// Project.accessTier into a real access product:
//   - ADMIN  → always allow (authoring / QA).
//   - PUBLIC → always allow (anonymous-readable, any card).
//   - FREE   → needs an account: signed-in allow, else redirect to sign in.
//   - PREMIUM → an Entitlement unlocks every card; otherwise card 0 is the free
//               preview (the sales surface) and cards 1+ hit the paywall.
// Pure: the guide page resolves session/role/entitlement and passes them in.
export function resolveLessonAccess(input: {
  accessTier: string;
  cardOrdinal: number;
  hasSession: boolean;
  hasEntitlement: boolean;
  isAdmin: boolean;
}): "allow" | "redirectSignIn" | "paywall" {
  if (input.isAdmin) return "allow";
  if (input.accessTier === "PUBLIC") return "allow";
  if (input.accessTier === "FREE")
    return input.hasSession ? "allow" : "redirectSignIn";
  // PREMIUM
  if (input.hasEntitlement) return "allow";
  if (input.cardOrdinal === 0) return "allow";
  return "paywall";
}
