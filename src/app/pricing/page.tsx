// Public pricing storefront (GTM monetization).
//
// /pricing — the top of the purchase funnel. Anonymous-readable (admitted by
// `isPublicPath`, listed in the sitemap). Good-better-best: one build on its own
// vs the All-Access Pass (the hero). The Pass price shows its launch number only
// while the launch window is open.
//
// Design: an engineering-drawing treatment (DrawingFrame + title block) and a
// bill-of-materials ledger, so the page speaks the audience's vernacular instead
// of generic pricing cards. Signal-blue marks identifiers/data, command-gold
// marks money.
//
// Server component (RSC): the session is resolved once via `auth()` WITHOUT a
// redirect (this route must render for anonymous visitors). The Pass + a
// representative single-build price come straight from Prisma. Signed-in viewers
// see the right CTA: the Pass, an upgrade (pay the difference), a per-build buy
// pointer, or "you already have the Pass".
//
// Copy voice: no em-dashes, sentence-case headers, answer-first, concrete. No
// fabricated metrics or testimonials. Keep `force-dynamic` so the CI build (stub
// DATABASE_URL) doesn't prerender the DB query.

import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DrawingFrame } from "@/components/marketing/DrawingFrame";
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

// The premium project price RANGE (lowest to highest), for the "one build" card
// in the good-better-best comparison. A range, not a single number, so it never
// reads as "every board is $49". Resolved from the catalog so it stays honest if
// a price changes.
async function premiumPriceRange(): Promise<{
  minCents: number | null;
  maxCents: number | null;
}> {
  const where = {
    accessTier: "PREMIUM" as const,
    priceCents: { not: null, gt: 0 },
    archivedAt: null,
  };
  const [cheapest, dearest] = await Promise.all([
    db.project.findFirst({
      where,
      orderBy: { priceCents: "asc" },
      select: { priceCents: true },
    }),
    db.project.findFirst({
      where,
      orderBy: { priceCents: "desc" },
      select: { priceCents: true },
    }),
  ]);
  return {
    minCents: cheapest?.priceCents ?? null,
    maxCents: dearest?.priceCents ?? null,
  };
}

export default async function PricingPage() {
  const now = new Date();

  const session = await auth();
  const email = session?.user?.email ?? null;

  const [bundle, priceRange] = await Promise.all([
    db.bundle.findUnique({ where: { key: "all-access" } }),
    premiumPriceRange(),
  ]);
  const singleProjectCents = priceRange.minCents;
  const maxProjectCents = priceRange.maxCents;

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

  // The Pass unit cell for the bill of materials.
  const passUnit =
    passCents !== null
      ? launchOpen && standardCents !== null && standardCents > passCents
        ? `${formatUsd(passCents)} launch / ${formatUsd(standardCents)}`
        : formatUsd(passCents)
      : "Coming soon";

  // Bill-of-materials rows. The item code is the real curriculum level, so the
  // left column carries information, not decoration.
  const bom: { code: string; desc: string; price: string; hero?: boolean }[] = [
    {
      code: "L1",
      desc: "Level 1, full track (includes the L2.01 battery module)",
      price: "Free",
    },
    { code: "L2", desc: "Level 2 builds (L2.02 to L2.05)", price: "$49 / build" },
    { code: "L3", desc: "Level 3 builds", price: "$89 / build" },
    {
      code: "CAP",
      desc: "Capstone builds (EEG front-end, fleet hub)",
      price: "$149 / build",
    },
    { code: "BN", desc: "Bench-tool builds", price: "$89 / build" },
    {
      code: "PASS",
      desc: "All-Access Pass, every premium build and bench tool",
      price: passUnit,
      hero: true,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {passOfferLd ? <JsonLd data={passOfferLd} /> : null}
      {singleOfferLd ? <JsonLd data={singleOfferLd} /> : null}

      {/* Hero: the page opens as an engineering drawing. */}
      <DrawingFrame
        title={[
          ["Doc", "Academy catalog"],
          ["Rev", "2026.06"],
          ["Status", launchOpen ? "Launch window" : "Pre-launch"],
          ["Currency", "USD"],
        ]}
      >
        <div className="px-6 py-9 sm:px-10 sm:py-11">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-command-gold">
            Pricing
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[0.92] tracking-tight text-white sm:text-6xl">
            Pay once per board.
            <br />
            <span className="text-command-gold">Or take the whole bench.</span>
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-base italic text-gray-2">
            All of Level 1 is free. Buy a single premium build, or get the
            All-Access Pass for every premium board and bench tool. One-time
            purchase, no subscription.
          </p>
        </div>
      </DrawingFrame>

      {/* Good-better-best: one build (quiet) vs the Pass (hero). */}
      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Single build */}
        <div className="glass-card flex flex-col gap-3 p-6 lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-signal-blue">
            One build
          </p>
          <p className="font-display text-2xl tracking-wide text-white">
            A single premium board
          </p>
          {singleProjectCents !== null ? (
            <p className="font-mono text-4xl text-white">
              {formatUsd(singleProjectCents)}
              {maxProjectCents !== null &&
              maxProjectCents > singleProjectCents ? (
                <span className="text-2xl text-muted">
                  {" "}
                  to {formatUsd(maxProjectCents)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Price shown on each course
            </p>
          )}
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Price depends on the build. See the bill of materials below.
          </p>
          <p className="font-serif text-sm italic text-gray-2">
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
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-gray-1 transition-colors hover:border-command-gold hover:text-command-gold"
          >
            Browse the builds
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* All-Access Pass (the hero) */}
        <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-command-gold bg-gradient-to-b from-bg-2 to-deep-space p-6 shadow-[0_0_44px_-12px_rgba(200,150,62,0.6)] lg:col-span-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-command-gold/10 blur-3xl"
          />
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold">
              All-Access Pass
            </p>
            {launchOpen ? (
              <span className="rounded border border-command-gold/40 bg-command-gold/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                Launch price
              </span>
            ) : null}
          </div>
          <p className="font-display text-3xl tracking-wide text-white">
            Every premium build and bench tool
          </p>
          {passCents !== null ? (
            <p className="font-mono text-5xl text-command-gold">
              {formatUsd(passCents)}
              {launchOpen &&
              standardCents !== null &&
              standardCents > passCents ? (
                <span className="ml-3 align-middle font-mono text-xl text-muted line-through">
                  {formatUsd(standardCents)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Coming soon
            </p>
          )}
          <p className="font-serif text-sm italic text-gray-2">
            One purchase unlocks every premium board across the curriculum and all
            six bench tools. The same depth as professional and enterprise
            hardware training, without the seat license or the subscription.
          </p>
          <ul className="grid grid-cols-1 gap-1.5 font-mono text-xs uppercase tracking-wider text-gray-2 sm:grid-cols-2">
            <li>Every premium board and bench tool</li>
            <li>Lifetime access, no subscription</li>
            <li>Pay the difference to upgrade</li>
            <li>New builds included as they ship</li>
          </ul>
          {/* CTA by viewer state. */}
          <div className="mt-auto pt-2">
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

      {/* Bill of materials: the full price list as the engineering artifact it
          is. The signature device. */}
      <DrawingFrame
        title={[
          ["Sheet", "Bill of materials"],
          ["Lines", String(bom.length)],
          ["Terms", "One-time"],
        ]}
        className="mt-5"
      >
        <div className="px-6 py-7 sm:px-10 sm:py-8">
          <p className="font-serif text-sm italic text-gray-2">
            Every line is a one-time purchase, lifetime access. Paid tracks open
            with the Level 1 launch. Join the Pass waitlist above and we&apos;ll
            tell you first.
          </p>
          <div className="mt-6 grid grid-cols-[3rem_1fr_auto] gap-x-3 border-b border-panel-border pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:grid-cols-[4rem_1fr_auto] sm:gap-x-5">
            <span>Item</span>
            <span>Description</span>
            <span className="text-right">Unit price</span>
          </div>
          <div className="divide-y divide-panel-border">
            {bom.map((r) => (
              <div
                key={r.code}
                className={`grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-3 px-1 py-3.5 sm:grid-cols-[4rem_1fr_auto] sm:gap-x-5 ${
                  r.hero ? "-mx-1 bg-command-gold/[0.07] px-2" : ""
                }`}
              >
                <span
                  className={`font-mono text-xs tracking-wider ${
                    r.hero ? "text-command-gold" : "text-signal-blue"
                  }`}
                >
                  {r.code}
                </span>
                <span
                  className={`font-serif text-sm ${
                    r.hero ? "text-white" : "text-gray-1"
                  }`}
                >
                  {r.desc}
                </span>
                <span
                  className={`whitespace-nowrap text-right font-mono text-sm ${
                    r.hero ? "text-command-gold" : "text-gray-1"
                  }`}
                >
                  {r.price}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-panel-border pt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
            14-day money-back guarantee. Parts are separate: every build gives a
            one-click DigiKey cart, or an optional pre-pulled kit when offered.
          </p>
        </div>
      </DrawingFrame>

      {/* FAQ — answer-first, concrete. */}
      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-signal-blue">
          Notes
        </p>
        <h2 className="mt-2 font-display text-2xl tracking-wide text-white">
          Common questions
        </h2>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Is this a subscription?
            </dt>
            <dd className="mt-1 font-serif text-sm text-gray-2">
              No. Every purchase is one-time. A build you buy, and the All-Access
              Pass, stay yours with no recurring charge.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              What is free?
            </dt>
            <dd className="mt-1 font-serif text-sm text-gray-2">
              All of Level 1 is free, including the L2.01 battery power module. You
              can build those start to finish with a free account, no payment.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Can I get a refund?
            </dt>
            <dd className="mt-1 font-serif text-sm text-gray-2">
              Yes. Email us within 14 days of your purchase for a full refund.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              I already bought some builds. Do I pay full price for the Pass?
            </dt>
            <dd className="mt-1 font-serif text-sm text-gray-2">
              No. We credit what you already paid for individual builds toward the
              Pass, so you pay only the difference. If your purchases already cover
              it, the Pass is added to your account at no extra charge.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-sm uppercase tracking-wider text-command-gold">
              Do I need to buy parts from you?
            </dt>
            <dd className="mt-1 font-serif text-sm text-gray-2">
              No. Each build lists its parts and gives you a one-click DigiKey cart
              so you can order them yourself. An optional kit is offered beside
              that cart when one is available.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
