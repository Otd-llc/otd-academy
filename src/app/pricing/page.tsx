// Public pricing storefront (GTM monetization).
//
// /pricing — the top of the purchase funnel. Anonymous-readable (admitted by
// `isPublicPath`, listed in the sitemap). Good-better-best: one build on its own
// vs the All-Access Pass (the hero), then the full catalog price list.
//
// Design: quiet precision. Stark deep-space, hairline structure, oversized
// confident display type, mono for every number, generous whitespace, a single
// gold accent to guide the eye. No decorative chrome.
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
import { JsonLd } from "@/components/seo/JsonLd";
import { SignUpCta } from "@/components/SignUpCta";
import { BuyPassButton, UpgradePassButton } from "@/components/learn/PassButtons";
import { PassWaitlistForm } from "@/components/learn/PassWaitlistForm";
import { formatUsdShort } from "@/lib/format-money";
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

// The premium project price RANGE (lowest to highest), for the "one build" card.
// A range, not a single number, so it never reads as "every board is $49".
// Resolved from the catalog so it stays honest if a price changes.
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

// A quiet metadata dot-separated row (the hero's spec line).
function SpecLine({ items }: { items: string[] }) {
  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
      {items.map((it, i) => (
        <span key={it} className="flex items-center gap-x-3">
          {i > 0 ? (
            <span aria-hidden="true" className="h-3 w-px bg-panel-border" />
          ) : null}
          {it}
        </span>
      ))}
    </p>
  );
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

  // Resolve the signed-in viewer's state for the CTA.
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

  const passUnit =
    passCents !== null
      ? launchOpen && standardCents !== null && standardCents > passCents
        ? `${formatUsdShort(passCents)} / ${formatUsdShort(standardCents)}`
        : formatUsdShort(passCents)
      : "Soon";

  // Catalog price rows. The level code is the real curriculum level, a quiet
  // structural label.
  const catalog: { code: string; desc: string; price: string; hero?: boolean }[] =
    [
      {
        code: "L1",
        desc: "Level 1, full track (includes the L2.01 battery module)",
        price: "Free",
      },
      { code: "L2", desc: "Level 2 builds (L2.02 to L2.05)", price: "$49" },
      { code: "L3", desc: "Level 3 builds", price: "$89" },
      {
        code: "CAP",
        desc: "Capstone builds (EEG front-end, fleet hub)",
        price: "$149",
      },
      { code: "BN", desc: "Bench-tool builds", price: "$89" },
      {
        code: "PASS",
        desc: "All-Access Pass, every premium build and bench tool",
        price: passUnit,
        hero: true,
      },
    ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      {passOfferLd ? <JsonLd data={passOfferLd} /> : null}
      {singleOfferLd ? <JsonLd data={singleOfferLd} /> : null}

      {/* Hero */}
      <header className="border-b border-panel-border pb-14 sm:pb-20">
        <div className="title-rule" aria-hidden="true" />
        <h1 className="bench-hero">
          <span className="ord">Pricing</span>
          <span className="hero-line">
            <span>
              Pay <span className="accent">once</span>
              <span className="tdot">.</span>
            </span>
          </span>
          <span className="hero-line hero-line-2">
            <span>
              Yours <span className="accent">forever</span>
              <span className="tdot">.</span>
            </span>
          </span>
        </h1>
        <p className="subhead">
          All of Level 1 is free. Buy a single premium build, or take the
          All-Access Pass for every premium board and bench tool. One-time
          purchase, no subscription.
        </p>
        <SpecLine
          items={["One-time purchase", "No subscription", "14-day refund"]}
        />
      </header>

      {/* Good-better-best: one build (quiet) vs the Pass (hero). */}
      <section className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Single build */}
        <div className="flex flex-col gap-6 rounded-2xl border border-panel-border bg-bg-2/30 p-7 sm:p-8 lg:col-span-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              One build
            </p>
            <p className="mt-2 title-card">
              A single premium board
            </p>
          </div>
          {singleProjectCents !== null ? (
            <p className="font-display text-5xl leading-none tracking-wide text-white">
              {formatUsdShort(singleProjectCents)}
              {maxProjectCents !== null &&
              maxProjectCents > singleProjectCents ? (
                <span className="text-3xl text-muted">
                  {" "}
                  to {formatUsdShort(maxProjectCents)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Price shown on each course
            </p>
          )}
          <ul className="space-y-2.5 text-sm leading-relaxed text-text">
            <li>The full guide: schematic, layout, DRC, and fab-ready gerbers</li>
            <li>Lifetime access to that build, no subscription</li>
            <li>Your purchase counts toward the Pass later</li>
          </ul>
          <Link
            href="/courses"
            className="mt-auto inline-flex w-fit items-center gap-1.5 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
          >
            Browse the builds
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* All-Access Pass (the hero) */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-command-gold/70 bg-bg-2/50 p-7 shadow-[0_0_60px_-20px_rgba(200,150,62,0.7)] sm:p-9 lg:col-span-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-command-gold/10 blur-3xl"
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-command-gold">
                All-Access Pass
              </p>
              <p className="mt-2 title-section">
                Every premium build and bench tool
              </p>
            </div>
            {launchOpen ? (
              <span className="shrink-0 rounded-full border border-command-gold/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                Launch price
              </span>
            ) : null}
          </div>
          {passCents !== null ? (
            <p className="font-display text-7xl leading-none tracking-wide text-command-gold">
              {formatUsdShort(passCents)}
              {launchOpen &&
              standardCents !== null &&
              standardCents > passCents ? (
                <span className="ml-3 align-baseline text-3xl text-muted line-through">
                  {formatUsdShort(standardCents)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wider text-muted">
              Coming soon
            </p>
          )}
          <ul className="grid grid-cols-1 gap-2.5 text-sm leading-relaxed text-text sm:grid-cols-2">
            <li>Every premium board and all six bench tools</li>
            <li>Lifetime access, no subscription</li>
            <li>Pay only the difference to upgrade</li>
            <li>New premium builds included as they ship</li>
          </ul>
          <div className="mt-auto border-t border-panel-border pt-6">
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

      {/* Full catalog price list. */}
      <section className="mt-20 border-t border-panel-border pt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          Full catalog
        </p>
        <h2 className="mt-3 title-section">
          What everything costs
        </h2>
        <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-text">
          Every line is a one-time purchase with lifetime access. Paid tracks
          open with the Level 1 launch. Join the Pass waitlist above and we&apos;ll
          tell you first.
        </p>

        <div className="mt-9">
          <div className="grid grid-cols-[2.75rem_1fr_auto] gap-x-4 border-b border-panel-border pb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted sm:grid-cols-[4rem_1fr_auto] sm:gap-x-8">
            <span>Tier</span>
            <span>Includes</span>
            <span className="text-right">Price</span>
          </div>
          <div className="divide-y divide-panel-border">
            {catalog.map((r) => (
              <div
                key={r.code}
                className="grid grid-cols-[2.75rem_1fr_auto] items-baseline gap-x-4 py-4 sm:grid-cols-[4rem_1fr_auto] sm:gap-x-8"
              >
                <span
                  className={`font-mono text-xs tracking-wider ${
                    r.hero ? "text-command-gold" : "text-muted"
                  }`}
                >
                  {r.code}
                </span>
                <span
                  className={`text-sm leading-snug ${
                    r.hero ? "font-medium text-white" : "text-text"
                  }`}
                >
                  {r.desc}
                </span>
                <span
                  className={`whitespace-nowrap text-right font-mono tabular-nums ${
                    r.hero
                      ? "text-base text-command-gold"
                      : "text-base text-text"
                  }`}
                >
                  {r.price}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            14-day money-back guarantee. Parts are separate: one-click DigiKey
            cart, or an optional pre-pulled kit when offered.
          </p>
        </div>
      </section>

      {/* FAQ. */}
      <section className="mt-20 border-t border-panel-border pt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          Questions
        </p>
        <dl className="mt-7 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {[
            [
              "Is this a subscription?",
              "No. Every purchase is one-time. A build you buy, and the All-Access Pass, stay yours with no recurring charge.",
            ],
            [
              "What is free?",
              "All of Level 1 is free, including the L2.01 battery power module. You can build those start to finish with a free account, no payment.",
            ],
            [
              "Can I get a refund?",
              "Yes. Email us within 14 days of your purchase for a full refund.",
            ],
            [
              "I already bought builds. Do I pay full price for the Pass?",
              "No. We credit what you already paid for individual builds toward the Pass, so you pay only the difference. If your purchases already cover it, the Pass is added at no extra charge.",
            ],
            [
              "Do I have to buy parts from you?",
              "No. Each build lists its parts and gives you a one-click DigiKey cart so you can order them yourself. An optional kit is offered beside that cart when one is available.",
            ],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="title-card">
                {q}
              </dt>
              <dd className="mt-2 font-serif text-sm leading-relaxed text-text">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
