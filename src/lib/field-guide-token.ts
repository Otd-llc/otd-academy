// Signed, expiring download token for a gated Library field guide. Carries the
// userId + which guide (a cluster key, or "combined" for the whole-library book)
// + an expiry; an HMAC over a base64url payload (no DB). Only the server, holding
// AUTH_SECRET, can mint one, so an emailed link is portable (it works on any
// device WITHOUT a second sign-in) yet cannot be forged or replayed for a
// different guide. Mirrors unsubscribe-token.ts / certificate-token.ts, plus an
// expiry (an emailed download link should not live forever). `kind` discriminates
// it from the other HMAC tokens so one can never be replayed as another.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

export interface FieldGuideClaims {
  userId: string;
  /** A Library cluster key, or "combined" for the whole-library book. */
  guide: string;
  /** Expiry, unix seconds. */
  exp: number;
  kind: "fgd";
}

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signFieldGuideToken(userId: string, guide: string, nowMs: number = Date.now()): string {
  const claims: FieldGuideClaims = {
    userId,
    guide,
    exp: Math.floor(nowMs / 1000) + TTL_SECONDS,
    kind: "fgd",
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

// Returns the claims iff the signature is valid, the kind matches, and it has not
// expired; null otherwise. The caller still checks that `guide` matches the route.
export function verifyFieldGuideToken(token: string, nowMs: number = Date.now()): FieldGuideClaims | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: FieldGuideClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (
    !claims ||
    claims.kind !== "fgd" ||
    typeof claims.userId !== "string" ||
    typeof claims.guide !== "string" ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }
  if (claims.exp * 1000 < nowMs) return null; // expired
  return claims;
}
