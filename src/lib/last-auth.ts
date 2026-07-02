// "Remember me" for the sign-in screen — the tiny client-side state that lets a
// returning, signed-OUT visitor see a "welcome back" fast-path (C1) instead of
// the full provider grid (R11). Pure helpers only (no DOM), so they unit-test in
// the fast "unit" project; the localStorage read/write lives in the client
// components (SignInForms writes the provider/email on submit; RememberLastUser
// writes the user on any signed-in page).
//
// Privacy note: this is a same-device convenience, never an auth signal — the
// real session/gate is server-side. "Not you?" clears it.

export const LAST_USER_KEY = "otd-last-user";
export const LAST_PROVIDER_KEY = "otd-last-provider";
export const LAST_EMAIL_KEY = "otd-last-email";

export type LastProvider = "google" | "github" | "resend";

export interface LastUser {
  email: string;
  name?: string;
  image?: string;
}

/** Display label for a provider (used in "last in · Google"). */
export function providerLabel(p: LastProvider): string {
  return p === "google" ? "Google" : p === "github" ? "GitHub" : "email";
}

/** Parse the stored last-user JSON, tolerating any garbage → null. */
export function parseLastUser(raw: string | null): LastUser | null {
  if (!raw) return null;
  try {
    const o: unknown = JSON.parse(raw);
    if (
      o &&
      typeof o === "object" &&
      typeof (o as { email?: unknown }).email === "string" &&
      (o as { email: string }).email.includes("@")
    ) {
      const rec = o as { email: string; name?: unknown; image?: unknown };
      return {
        email: rec.email,
        name: typeof rec.name === "string" ? rec.name : undefined,
        image: typeof rec.image === "string" ? rec.image : undefined,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Narrow a stored string to a known provider, else null. */
export function parseLastProvider(raw: string | null): LastProvider | null {
  return raw === "google" || raw === "github" || raw === "resend" ? raw : null;
}

/** Avatar initials — the name's first two words, else the email local part. */
export function initialsFrom(u: LastUser): string {
  const src = (u.name && u.name.trim()) || u.email.split("@")[0] || u.email;
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? src[0] ?? "?";
  const b = parts.length > 1 ? (parts[1]![0] ?? "") : "";
  return (a + b).toUpperCase();
}
