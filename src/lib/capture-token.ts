// Short-lived signed token authorizing the desktop capture app to upload into ONE
// guide block. Minted by an admin (createCaptureSession), ridden in the
// otd-capture:// deep link, verified by the /api/capture route. HMAC over a tiny
// JSON payload with AUTH_SECRET — no DB, no session needed at upload time.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CaptureClaims {
  cardId: string;
  blockIndex: number;
  kind: "image" | "video";
  exp: number;
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signCaptureToken(
  claims: Omit<CaptureClaims, "exp">,
): string {
  const payload: CaptureClaims = { ...claims, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyCaptureToken(token: string): CaptureClaims | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: CaptureClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (
    !claims ||
    typeof claims.cardId !== "string" ||
    typeof claims.blockIndex !== "number" ||
    (claims.kind !== "image" && claims.kind !== "video") ||
    typeof claims.exp !== "number" ||
    Date.now() > claims.exp
  ) {
    return null;
  }
  return claims;
}
