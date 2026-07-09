"use server";

// NOTE: a "use server" module may export ONLY async functions. Do NOT add an
// `export type` here (it survives tsc but throws at runtime). The client infers
// the result shape via Awaited<ReturnType<typeof requestFieldGuide>>.

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/env";
import { signFieldGuideToken } from "@/lib/field-guide-token";
import { fieldGuideEmail } from "@/lib/field-guide-email";
import { clusterByKey } from "@/lib/library/clusters";
import { siteUrl } from "@/lib/seo/jsonld";

// Email the signed-in user a portable download link for a field guide (a cluster
// key, or "combined" for the whole-library book). Transactional (the user asked
// for it), so it is NOT gated by emailConsent. `marketingOptIn` is a SEPARATE,
// optional opt-in that writes the same GDPR emailConsent field.
export async function requestFieldGuide(
  guide: string,
  marketingOptIn = false,
): Promise<
  | { ok: true; email: string }
  | { ok: false; needsAuth: true }
  | { ok: false; error: string }
> {
  const isCombined = guide === "combined";
  const cluster = isCombined ? null : clusterByKey(guide);
  if (!isCombined && !cluster) return { ok: false, error: "Unknown field guide." };

  const session = await auth();
  const sessionEmail = session?.user?.email;
  if (!sessionEmail) return { ok: false, needsAuth: true };

  const user = await db.user.findUnique({
    where: { email: sessionEmail },
    select: { id: true, email: true, emailConsent: true },
  });
  if (!user?.email) return { ok: false, needsAuth: true };

  // Separate, optional marketing opt-in → the same emailConsent field, stamped.
  if (marketingOptIn && !user.emailConsent) {
    await db.user.update({
      where: { id: user.id },
      data: { emailConsent: true, emailConsentUpdatedAt: new Date() },
    });
  }

  const base = siteUrl();
  const path = isCombined ? "/library/field-guide/pdf" : `/library/field-guide/${guide}/pdf`;
  const token = signFieldGuideToken(user.id, guide);
  const url = `${base}${path}?t=${token}`;
  const guideLabel = isCombined
    ? "the OTD Reference Library (complete)"
    : `the ${cluster!.label} Field Guide`;

  const { subject, html, text } = fieldGuideEmail({ url, guideLabel, host: new URL(base).host });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.AUTH_RESEND_FROM, to: user.email, subject, html, text }),
  });
  if (!res.ok) return { ok: false, error: "We couldn't send the email just now. Please try again." };

  return { ok: true, email: user.email };
}
