// Constant-time CRON_SECRET check, shared by the cron routes (audit Phase 6).
//
// Both crons compared `authorization !== \`Bearer ${secret}\`` — the one secret
// comparison in the repo that wasn't timing-safe (certificate/capture/field-guide
// tokens all use timingSafeEqual). Exploitability was negligible (network jitter
// dominates), but consistency is the point: every secret compare goes through
// the same shape. PLAIN module.
import { timingSafeEqual } from "node:crypto";

/**
 * True iff `authorization` is exactly `Bearer <secret>`, compared in constant
 * time. False for a missing header or an unconfigured secret (fail closed).
 */
export function cronAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false;
  const a = Buffer.from(authorization);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
