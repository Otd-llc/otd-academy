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
