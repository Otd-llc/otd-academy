// Pure policy for the signup-abuse rate limiter (design §7). No I/O — the rules,
// the key normalization, and the transform order live here so they can be
// unit-tested and can never drift from the limiter that runs them
// (abuse-limit.ts). Mirrors resolveSignIn / resolveRouteGate.
//
// Transform order is LOAD-BEARING (design §7.1–7.2): normalize-alias → IPv6 /64
// → HMAC last (pinned to AUTH_SECRET). The limiter needs only equality, so the
// HMAC is transparent — and it keeps Upstash from holding a plaintext list of the
// victims being bombed.
import { createHmac } from "node:crypto";
import { env } from "@/env";

// ── The rules. Numbers are SOURCED (design §7); do not "tidy" them. ──────────
// window strings are @upstash/ratelimit Durations. `magic:global:day` is a
// function so the env override resolves at read time (design §7.3); it is ORDERED
// LAST so an earlier denial never spends the shared global quota.
export const RULES = {
  "magic:email:burst": { limit: 1, window: "60 s" }, // Supabase cooldown
  "magic:email:hour": { limit: 5, window: "1 h" }, // Cognito ResendConfirmationCode
  "magic:email:day": { limit: 15, window: "24 h" }, // bounds a slow-drip bomb
  "magic:ip:hour": { limit: 50, window: "1 h" }, // Auth0 /passwordless/start (callback pre-check)
  "magic:global:day": {
    limit: () => env.MAGIC_GLOBAL_DAILY_CAP ?? 2000,
    window: "24 h",
  },
  "waitlist:ip:hour": { limit: 20, window: "1 h" },
  "tip:ip:hour": { limit: 10, window: "1 h" },
  "checkout:user": { limit: 15, window: "1 h" }, // Tier 3: authenticated Stripe actions
  // Burst only. The real bounds on saved hex clusters are row COUNTS (50
  // active / 200 total / 100 revisions), which a sliding-window rate limiter
  // cannot express and which are counted in SQL inside an advisory-locked
  // transaction. This just stops a stuck client hammering the endpoint.
  "hex:save:user": { limit: 30, window: "1 h" },
} as const;

export type RuleName = keyof typeof RULES;

/** A check to run. `identity` is already normalized + HMAC'd (never raw PII). */
export type Check = { rule: RuleName; identity: string };

// ── Key normalization ────────────────────────────────────────────────────────

const GMAIL = new Set(["gmail.com", "googlemail.com"]);
const YAHOO = new Set(["yahoo.com", "ymail.com", "rocketmail.com"]);

/**
 * Canonicalize the COUNTER KEY only (never the delivered address — @auth/core
 * already normalized that, and the send must keep the raw address). Strips the
 * `+tag` for every domain, dots for gmail, and yahoo's `-tag`, so alias-bombing
 * collapses onto ONE per-email budget (D5). Lowercased + trimmed. Returns the
 * lowercased input unchanged if it is not a plausible address.
 */
export function emailAlias(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  local = YAHOO.has(domain) ? local.split("-")[0] : local.split("+")[0];
  if (GMAIL.has(domain)) local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/**
 * Normalize an IP for keying: an IPv6 address collapses to its /64 prefix (a host
 * controls a /64 and rotates for free, N2); IPv4 is unchanged. Null → null.
 */
export function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0]; // strip brackets + zone id
  if (!clean.includes(":")) return clean; // IPv4
  const [head, tail = ""] = clean.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const full = [
    ...headParts,
    ...Array(Math.max(0, missing)).fill("0"),
    ...tailParts,
  ];
  const first4 = full.slice(0, 4).map((h) => (h === "" ? "0" : h));
  return `${first4.join(":")}::/64`;
}

/** HMAC-SHA256 pinned to AUTH_SECRET (reuse capture-token pattern). Applied LAST. */
export function hmacKey(value: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(value)
    .digest("base64url");
}

/**
 * Trusted client IP from request headers, or null. Prefers x-vercel-forwarded-for
 * (a proxy layered on Vercel), falls back to x-forwarded-for, first hop.
 * TRUSTWORTHY ON VERCEL ONLY — Vercel overwrites XFF to prevent spoofing; on any
 * other host this is spoofable and the IP rules become worthless (design §13).
 */
export function clientIp(h: Headers): string | null {
  const raw = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for");
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first ? first : null;
}

/** Env-namespaced key prefix so Preview cannot drain Prod's counters (N1). */
export function nsPrefix(rule: RuleName): string {
  return `otd:${env.VERCEL_ENV ?? "local"}:${rule}`;
}

// ── The check sets ───────────────────────────────────────────────────────────

/**
 * Per-email + global checks for a magic-link send. Takes the RAW email; applies
 * emailAlias → hmacKey internally. Does NOT include the IP rule — that is the
 * callback pre-check (ipOnlyCheck), design §4.3. Global is ordered LAST.
 */
export function magicLinkChecks(rawEmail: string): Check[] {
  const emailId = hmacKey(emailAlias(rawEmail));
  return [
    { rule: "magic:email:burst", identity: emailId },
    { rule: "magic:email:hour", identity: emailId },
    { rule: "magic:email:day", identity: emailId },
    { rule: "magic:global:day", identity: "global" }, // shared counter, not PII
  ];
}

/** Build an IP-keyed check for any IP rule (normalize → /64 → HMAC). Null when no IP. */
export function ipCheckFor(rule: RuleName, ip: string | null): Check | null {
  const prefix = ipPrefix(ip);
  if (!prefix) return null;
  return { rule, identity: hmacKey(prefix) };
}

/** The IP-only pre-check for the signIn callback (design §4.3). Null when no IP. */
export function ipOnlyCheck(ip: string | null): Check | null {
  return ipCheckFor("magic:ip:hour", ip);
}

/** The per-user checkout check (Tier 3, design §2). HMAC the user's cuid — not
 *  PII-sensitive like an email/IP, but HMAC keeps the key format uniform and
 *  keeps raw user ids out of Upstash. */
export function userCheck(userId: string): Check {
  return { rule: "checkout:user", identity: hmacKey(userId) };
}

/** Per-user burst check for saving a hex cluster. Same HMAC treatment as
 *  userCheck, for the same reason: keep raw user ids out of Upstash. */
export function hexSaveCheck(userId: string): Check {
  return { rule: "hex:save:user", identity: hmacKey(userId) };
}
