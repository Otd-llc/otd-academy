// Records an issued certificate so its printed code is checkable on /verify.
// Idempotent on the code (hash of the signed token); best-effort — a recording
// failure must never break the page or the credential flow. The token itself is
// NOT stored: /verify re-signs it from these fields when it needs to render.
import { db } from "@/lib/db";
import { certificateId } from "@/lib/certificate-id";
import type { CardClaims } from "@/lib/certificate-token";

export async function recordCertificate(
  token: string,
  claims: CardClaims,
  userId?: string | null,
): Promise<string> {
  const code = certificateId(token);
  try {
    await db.certificate.upsert({
      where: { code },
      create: {
        code,
        slug: claims.slug,
        name: claims.name,
        variant: claims.variant,
        score: claims.score ?? null,
        total: claims.total ?? null,
        userId: userId ?? null,
        ...(claims.date ? { issuedAt: new Date(`${claims.date}T00:00:00Z`) } : {}),
      },
      update: {},
    });
  } catch {
    // best-effort
  }
  return code;
}
