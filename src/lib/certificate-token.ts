// Signed token for a public, shareable completion/certificate card. Carries
// {slug, name, variant, score?} so the dynamic OG image route can render the
// card for a logged-out crawler WITHOUT a session — and so nobody can forge a
// card with someone else's name (only the server, holding AUTH_SECRET, can mint).
// Minted by the authed complete/exam pages; verified by the public card route.
// HMAC over a base64url JSON payload — no DB, no expiry (a shared link should
// keep working). Mirrors capture-token.ts.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

export type CardVariant = "cert" | "done";

export interface CardClaims {
  slug: string;
  name: string;
  variant: CardVariant;
  score?: number;
  total?: number;
  /** Issue date (YYYY-MM-DD) stamped at mint — shown on the certificate. */
  date?: string;
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signCardToken(claims: CardClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyCardToken(token: string): CardClaims | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: CardClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (
    !claims ||
    typeof claims.slug !== "string" ||
    typeof claims.name !== "string" ||
    (claims.variant !== "cert" && claims.variant !== "done")
  ) {
    return null;
  }
  return claims;
}
