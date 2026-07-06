"use server";

// Lifecycle-email consent toggle for the signed-in user (GDPR opt-in). Consent is
// only ever true after the user affirmatively turns it on in the account "Email"
// section; emailConsentUpdatedAt records WHEN the choice was made (the audit
// trail). Opting out here does exactly what the one-click unsubscribe route does.
// Transactional mail (magic-link sign-in) is never gated by this.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function setEmailConsent(optIn: boolean): Promise<{ emailConsent: boolean }> {
  const user = await requireUser();
  // Coerce to a strict boolean: a server action argument is deserialized from the
  // client and must not be trusted to already be a clean boolean.
  const emailConsent = optIn === true;
  await db.user.update({
    where: { id: user.id },
    data: { emailConsent, emailConsentUpdatedAt: new Date() },
  });
  revalidatePath("/account");
  return { emailConsent };
}
