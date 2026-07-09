import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { EmailPreferences } from "@/components/account/EmailPreferences";
import { ManageBillingButton } from "@/components/account/ManageBillingButton";
import { DunningBanner } from "@/components/billing/DunningBanner";
import { pastDueSubscription } from "@/lib/past-due-subscription";
import { avatarSrc } from "@/lib/effective-avatar";

// Signed-in account settings: your avatar (seeded from the sign-in provider,
// overridable with an upload), a read-only identity summary, and your email
// opt-in. Auth-gated by middleware; the redirect here is a defense-in-depth
// backstop.
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      avatarUpdatedAt: true,
      emailConsent: true,
      stripeCustomerId: true,
    },
  });
  if (!user) redirect("/sign-in");

  const current = avatarSrc(user.id, user.avatarUpdatedAt, user.image);
  const initial = (user.name?.trim()?.[0] ?? user.email[0] ?? "?").toUpperCase();
  const pastDue = await pastDueSubscription(user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {pastDue ? <DunningBanner /> : null}
      <PageHeader
        eyebrow="ACCOUNT"
        title="Your account"
        lead="Your avatar and identity."
      />

      <section className="mt-8 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Avatar
        </p>
        <p className="mt-1 font-serif text-sm text-muted">
          Seeded from your sign-in provider. Upload your own to override it.
        </p>
        <AvatarUploader
          current={current}
          initial={initial}
          hasCustom={!!user.avatarUpdatedAt}
        />
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Email
        </p>
        <p className="mt-1 font-serif text-sm text-muted">
          Occasional build tips, new lessons, and launch news. Sign-in links come
          through no matter what.
        </p>
        <EmailPreferences initialConsent={user.emailConsent} />
      </section>

      {user.stripeCustomerId ? (
        <section className="mt-10 border-t border-panel-border/60 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ Billing
          </p>
          <p className="mt-1 font-serif text-sm text-muted">
            View your invoices, update your payment method, or cancel a subscription.
          </p>
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        </section>
      ) : null}

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Identity
        </p>
        <dl className="mt-3 space-y-2.5">
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
              Name
            </dt>
            <dd className="font-serif text-sm text-text">
              {user.name ?? "Not set"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
              Email
            </dt>
            <dd className="font-mono text-sm text-text">{user.email}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
