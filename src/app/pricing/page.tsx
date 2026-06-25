// Public pricing storefront (GTM monetization).
//
// /pricing — the top of the purchase funnel. Anonymous-readable (admitted by
// `isPublicPath`, listed in the sitemap). Good-better-best: one project on its
// own vs the All-Access Pass (the hero). The Pass price shows its launch number
// only while the launch window is open.
//
// Server component (RSC): the session is resolved once via `auth()` WITHOUT a
// redirect (this route must render for anonymous visitors). The Pass + a
// representative single-project price come straight from Prisma. Signed-in
// viewers see the right CTA: the Pass, an upgrade (pay the difference), a
// per-project buy pointer, or "you already have the Pass".
//
// Copy voice: no em-dashes, sentence-case headers, answer-first, concrete. No
// fabricated metrics or testimonials. Keep `force-dynamic` so the CI build (stub
// DATABASE_URL) doesn't prerender the DB query.

import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignUpCta } from "@/components/SignUpCta";
import { BuyPassButton, UpgradePassButton } from "@/components/learn/PassButtons";
import { PassWaitlistForm } from "@/components/learn/PassWaitlistForm";
import { formatUsd } from "@/lib/format-money";
import { productOfferJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { currentPassPriceId, isLaunchActive } from "@/lib/pass-pricing";
import { quoteUpgrade } from "@/lib/pass-upgrade";

const title = "Pricing | One Thousand Drones Academy";
const description =
  "All of Level 1 is free, including the battery power module. Buy a single premium build, or get the All-Access Pass for every premium board and bench tool. One-time purchase, no subscription, 14-day money-back guarantee.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, type: "website", url: "/pricing" },
  twitter: { card: "summary_large_image", title, description },
};

export const dynamic = "force-dynamic";

// The lowest premium project price ($49 on L2) is the representative "one
// project" number in the good-better-best comparison. Resolved from the catalog
// so it stays honest if a price changes.
async function representativeProjectPriceCents(): Promise<number | null> {
  const cheapest = await db.project.findFirst({
    where: {
      accessTier: "PREMIUM",
      priceCents: { not: null, gt: 0 },
      archivedAt: null,
    },
    orderBy: { priceCents: "asc" },
    select: { priceCents: true },
  });
  return cheapest?.priceCents ?? null;
}

export default async function PricingPage() {
  const now = new Date();

  const session = await auth();
  const email = session?.user?.email ?? null;

  const [bundle, singleProjectCents] = await Promise.all([
    db.bundle.findUnique({ where: { key: "all-access" } }),
    representativeProjectPriceCents(),
  ]);

  // The Pass price active right now (launch while the window is open, else
  // standard). Null when the Pass isn't provisioned yet (set-pass-price.ts not
  // run) — we still render the page, just without a live buy button.
  const passCents = bundle ? currentPassPriceId(bundle, now) : null;
  const launchOpen = bundle ? isLaunchActive(bundle, now) : false;
  const standardCents = bundle?.priceCents ?? null;
  // The Pass is sellable only once set-pass-price.ts has provisioned a Stripe
  // price id (loadSellablePass enforces the same server-side). Until then the
  // Pass renders as a waitlist, not a buy button that would error.
  const passOnSale = bundle?.stripePriceId != null && passCents !== null;

  // Resolve the signed-in viewer's state for the CTA: do they already hold the
  // Pass, and what is their pay-the-difference quote.
  let signedIn = false;
  let hasPass = false;
  let upgradeChargeCents: number | null = null;
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) {
      signedIn = true;
      const passEntitlement = await db.entitlement.findFirst({
        where: { userId: user.id, bundleId: { not: null } },
        select: { id: true },
      });
      hasPass = passEntitlement != null;
      if (!hasPass && passCents !== null) {
        const purchases = await db.entitlement.findMany({
          where: {
            userId: user.id,
            source: "PURCHASE",
            projectId: { not: null },
          },
          select: { project: { select: { priceCents: true } } },
        });
        if (purchases.length > 0) {
          const quote = quoteUpgrade(
            passCents,
            purchases.map((p) => p.project?.priceCents ?? null),
          );
          upgradeChargeCents = quote.chargeCents;
        }
      }
    }
  }

  const base = siteUrl();
  const passOfferLd =
    passCents !== null
      ? productOfferJsonLd({
          name: "All-Access Pass",
          description:
            "Every premium build and bench tool, one one-time purchase.",
          url: `${base}/pricing`,
          priceCents: passCents,
        })
      : null;
  const singleOfferLd =
    singleProjectCents !== null
      ? productOfferJsonLd({
          name: "Single premium build",
          description: "One premium board, start to finish.",
          url: `${base}/courses`,
          priceCents: singleProjectCents,
        })
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {passOfferLd ? <JsonLd data={passOfferLd} /> : null}
      {singleOfferLd ? <JsonLd data={singleOfferLd} /> : null}

      <PageHeader
        eyebrow="PRICING"
        title="Pay once, keep it"
        accentWord="keep it"
        lead="All of Level 1 is free. Buy a single premium build, or get the All-Access Pass for every premium board and bench tool. One-time purchase, no subscription."
      />

      {/* Good-better-best: one project vs the Pass (the hero). */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Single build */}
        <div className="glass-card flex flex-col gap-4 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
            One build
          </p>
          <p className="font-display text-2xl tracking-wide text-white">
            A single premium board
          </p>
          {singleProjectCents !== null ? (
            <p className="font-mono text-3xl text-white">
              {formatUsd(singleProjectCents)}
              <span className="ml-2 text-sm uppercase tracking-wider text-muted">
                and up
              </span>
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Price shown on each course
            </p>
          )}
          <p className="font-serif text-sm italic text-muted">
            Buy just the build you want. You get its full guide: schematic,
            layout, fabrication, and bring-up, plus lifetime access.
          </p>
          <ul className="space-y-1.5 font-mono text-xs uppercase tracking-wider text-muted">
            <li>One board, start to finish</li>
            <li>Lifetime access to that build</li>
            <li>Your purchase counts toward the Pass later</li>
          </ul>
          <Link
            href="/courses"
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
          >
            Browse the builds
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* All-Access Pass (the hero) */}
        <div className="glass-card flex flex-col gap-4 border-command-gold p-6 shadow-[0_0_24px_-6px_rgba(200,150,62,0.55)]">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
              All-Access Pass
            </p>
            {launchOpen ? (
              <span className="rounded bg-command-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                Launch price
              </span>
            ) : null}
          </div>
          <p className="font-display text-2xl tracking-wide text-white">
            Every premium build and bench tool
          </p>

          {passCents !== null ? (
            <p className="font-mono text-3xl text-white">
              {formatUsd(passCents)}
              {launchOpen && standardCents !== null && standardCents > passCents ? (
                <span className="ml-3 align-middle text-base text-muted line-through">
                  {formatUsd(standardCents)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Coming soon
            </p>
          )}

          <p className="font-serif text-sm italic text-muted">
            One purchase unlocks every premium board across the curriculum and all
            six bench tools. The same depth as professional and enterprise
            hardware training, without the seat license or the subscription.
          </p>
          <ul className="space-y-1.5 font-mono text-xs uppercase tracking-wider text-muted">
            <li>Every premium board and bench tool</li>
            <li>Lifetime access, no subscription</li>
            <li>New premium builds included as they ship</li>
          </ul>

          {/* CTA by viewer state. */}
          <div className="mt-auto">
            {hasPass ? (
              <p className="font-mono text-sm uppercase tracking-wider text-status-green">
                You have the All-Access Pass.
              </p>
            ) : !passOnSale ? (
              <div className="space-y-2">
                <PassWaitlistForm defaultEmail={email ?? undefined} />
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  The Pass opens with the Level 1 launch.
                </p>
              </div>
            ) : !signedIn ? (
              <div className="space-y-2">
                <SignUpCta />
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Sign in to buy. Free to create an account.
                </p>
              </div>
            ) : upgradeChargeCents !== null ? (
              <UpgradePassButton chargeCents={upgradeChargeCents} />
            ) : passCents !== null ? (
              <BuyPassButton priceCents={passCents} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Full price list: every tier, even though paid tracks open at launch. */}
      <section className="glass-card mt-8 p-6">
        <p className="font-display text-xl tracking-wide text-white">
          Full price list
        </p>
        <p className="mt-1 font-serif text-sm italic text-muted">
          Every paid build is a one-time purchase. Paid tracks open with the Level
          1 launch. Join the Pass waitlist above and we&apos;ll tell you first.
        </p>
        <dl className="mt-4 divide-y divide-panel-border">
          {(
            [
              [
                "Level 1, full track (includes the L2.01 battery module)",
                "Free",
              ],
              ["Level 2 builds (L2.02 to L2.05)", "$49 each"],
              ["Level 3 builds", "$89 each"],
              ["Capstone builds (EEG front-end, fleet hub)", "$149 each"],
              ["Bench-tool builds", "$89 each"],
              [
                "All-Access Pass (every premium build and bench tool)",
                launchOpen ? "$299 launch, then $399" : "$399",
              ],
            ] as const
          ).map(([label, price]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <dt className="font-serif text-sm text-gray-1">{label}</dt>
              <dd className="whitespace-nowrap font-mono text-sm uppercase tracking-wider text-command-gold">
                {price}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Guarantee. */}
      <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted">
        14-day money-back guarantee. If a build is not for you, email us within 14
        days for a full refund.
      </p>

      {/* Parts kit note: the optional kit beside the free DigiKey cart. */}
      <section className="glass-card mt-8 p-6">
        <p className="font-display text-xl tracking-wide text-white">
          Parts are separate, and you choose how to get them
        </p>
        <p className="mt-2 font-serif text-sm italic text-muted">
          Every build lists its bill of materials. You can add the whole list to a
          DigiKey cart in one click and order it yourself for the cost of the
          parts, or buy an optional pre-pulled kit when one is offered. The course
          price covers the guide, not the hardware.
        </p>
      </section>

      {/* FAQ — answer-first, concrete. */}
      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-wide text-white">
          Common questions
        </h2>
        <dl className="mt-4 space-y-5">
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Is this a subscription?
            </dt>
            <dd className="mt-1 font-serif text-sm text-muted">
              No. Every purchase is one-time. A build you buy, and the All-Access
              Pass, stay yours with no recurring charge.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              What is free?
            </dt>
            <dd className="mt-1 font-serif text-sm text-muted">
              All of Level 1 is free, including the L2.01 battery power module. You
              can build those start to finish with a free account, no payment.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Can I get a refund?
            </dt>
            <dd className="mt-1 font-serif text-sm text-muted">
              Yes. Email us within 14 days of your purchase for a full refund.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              I already bought some builds. Do I pay full price for the Pass?
            </dt>
            <dd className="mt-1 font-serif text-sm text-muted">
              No. We credit what you already paid for individual builds toward the
              Pass, so you pay only the difference. If your purchases already cover
              it, the Pass is added to your account at no extra charge.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Do I need to buy parts from you?
            </dt>
            <dd className="mt-1 font-serif text-sm text-muted">
              No. Each build lists its parts and gives you a one-click DigiKey cart
              so you can order them yourself. An optional kit is offered beside that
              cart when one is available.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
