// Signed links for the anonymous email captures: confirm (double opt-in) and
// remove. The token in the path IS the gate; the recipient has no account and
// no session. Same construction as unsubscribe-token.ts: an HMAC-SHA256 over a
// base64url JSON payload, pinned to AUTH_SECRET, no database row.
//
// Two kinds, two lifetimes (plan P.5, owner R3-7):
//   confirm  expires. A confirmation link found in an old inbox a year later
//            must not subscribe anyone; the unconfirmed row it pointed at is
//            gone by then anyway (the lifecycle sweep deletes it after 7 days).
//   remove   does not expire. It is printed in every digest, and a removal
//            request is honoured whenever it arrives.
//
// Claims carry the TABLE and the lowercased address (plus the projectId for the
// per-course waitlist, whose key is the pair), never a row id: the row may have
// been merged or re-created since the mail went out, and what the person is
// confirming or refusing is "this address, on this list".
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

export const WAITLIST_TABLES = [
  "WaitlistSignup",
  "PassWaitlist",
  "HexReleaseNotify",
] as const;
export type WaitlistTable = (typeof WAITLIST_TABLES)[number];

export type WaitlistTokenKind = "confirm" | "remove";

/** How long a confirmation link stays valid. Matches the unconfirmed-row sweep. */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface WaitlistClaims {
  v: 1;
  kind: WaitlistTokenKind;
  table: WaitlistTable;
  /** Lowercased address (20261001120000_email_hygiene stores them that way). */
  email: string;
  /** WaitlistSignup only: the course the row is keyed to. */
  projectId?: string;
  /** confirm only: expiry, ms since epoch. */
  exp?: number;
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signWaitlistToken(
  claims: Omit<WaitlistClaims, "v" | "exp">,
  now: Date = new Date(),
): string {
  const full: WaitlistClaims = {
    v: 1,
    kind: claims.kind,
    table: claims.table,
    email: claims.email.toLowerCase(),
    ...(claims.projectId ? { projectId: claims.projectId } : {}),
    ...(claims.kind === "confirm"
      ? { exp: now.getTime() + CONFIRM_TTL_MS }
      : {}),
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** The claims, or null for anything malformed, forged, of the wrong kind, or expired. */
export function verifyWaitlistToken(
  token: string,
  expectKind: WaitlistTokenKind,
  now: Date = new Date(),
): WaitlistClaims | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const want = sign(body);
  if (sig.length !== want.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;
  if (c.v !== 1) return null;
  if (c.kind !== expectKind) return null;
  if (
    typeof c.table !== "string" ||
    !(WAITLIST_TABLES as readonly string[]).includes(c.table)
  ) {
    return null;
  }
  if (typeof c.email !== "string" || !c.email) return null;
  if (c.projectId !== undefined && typeof c.projectId !== "string") return null;
  if (c.table === "WaitlistSignup" && typeof c.projectId !== "string")
    return null;
  if (expectKind === "confirm") {
    if (typeof c.exp !== "number" || !(c.exp > now.getTime())) return null;
  }
  return {
    v: 1,
    kind: expectKind,
    table: c.table as WaitlistTable,
    email: c.email.toLowerCase(),
    ...(typeof c.projectId === "string" ? { projectId: c.projectId } : {}),
    ...(typeof c.exp === "number" ? { exp: c.exp } : {}),
  };
}
