// Signed unsubscribe token for the one-click lifecycle-email opt-out link. Carries
// just the userId; an HMAC over a base64url payload (no DB, no expiry — an
// unsubscribe link in an old email must keep working forever). Only the server,
// holding AUTH_SECRET, can mint one, so nobody can forge a link that opts someone
// ELSE out. Mirrors certificate-token.ts (the certificate share-link signer).
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

export interface UnsubscribeClaims {
  /** The user being unsubscribed. */
  userId: string;
  /** Discriminator so a card token can never be replayed as an unsubscribe token. */
  kind: "unsub";
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signUnsubscribeToken(userId: string): string {
  const claims: UnsubscribeClaims = { userId, kind: "unsub" };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeClaims | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: UnsubscribeClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!claims || claims.kind !== "unsub" || typeof claims.userId !== "string") {
    return null;
  }
  return claims;
}
