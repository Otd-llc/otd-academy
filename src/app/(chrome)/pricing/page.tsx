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
// fabricated metrics or testimonials.
//
// CACHING: the product data (the Pass row + the premium price range) is
// user-independent and this page is crawled, so both reads are `use cache` + tagged
// `projects`. The per-viewer CTA branch below stays uncached, and `now` stays at
// request time so the Pass launch window can never flip late.

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ONE_HOUR, TAG_PROJECTS } from "@/lib/cache-profile";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignUpCta } from "@/components/SignUpCta";
import { BuyPassButton, UpgradePassButton } from "@/components/learn/PassButtons";
import { PassWaitlistForm } from "@/components/learn/PassWaitlistForm";
import { formatUsdShort } from "@/lib/format-money";
import { productOfferJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { currentPassPriceId, isLaunchActive, passSellable } from "@/lib/pass-pricing";
import { countPublishedPremiumProjects } from "@/lib/premium-catalog";
import { quoteUpgrade } from "@/lib/pass-upgrade";
import { PricingViewedPing } from "@/components/learn/PricingViewedPing";

// The visible FAQ AND the FAQPage structured data render from this one array so
// they can never drift apart.
const PRICING_FAQS: [string, string][] = [
  [
    "Is this a subscription?",
    "No. Every purchase is one-time. A build you buy, and the All-Access Pass, stay yours with no recurring charge.",
  ],
  [
    "What is free?",
    "The first board, L1.01, is free to build start to finish, no account required. The rest of the catalog is still being built. Each of those boards is a one-time purchase, and its price appears here the day it opens.",
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
];

// Render a price string with its currency+digit run in the display-numeral face
// (Saira), leaving words like "to" / "Free" in the surrounding font.
function priceNumerals(text: string): React.ReactNode {
  return text.split(/(\$?[\d.,]+)/).map((part, i) =>
    /\d/.test(part) ? (
      <span key={i} className="font-numeral">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const title = "Pricing | One Thousand Drones Academy";
// Front-loads the claim that survives truncation: L1.01 is free and complete.
// Google cuts around 160 characters, so the honest catalog state trails it.
const description =
  "The first board, L1.01, is free to build start to finish, no account required. The rest of the catalog is still being built, and each price appears the day that board opens.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, type: "website", url: "/pricing" },
  twitter: { card: "summary_large_image", title, description },
};


// The all-access Pass row. User-independent product data on a public, crawled page,
// so it is cached. `now` stays at request time in the page body — the launch-window
// checks read it, and a cached clock would let the window flip up to an hour late.
//
// Tagged `projects` rather than a bundle-specific tag: the Pass price is provisioned
// by scripts/set-pass-price.ts, which (like every seed script) runs outside a request
// context and cannot invalidate anything. The hour is the real bound there — see the
// seeding note in CLAUDE.md.
async function loadAllAccessBundle() {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS);
  return db.bundle.findUnique({ where: { key: "all-access" } });
}

// The premium project price RANGE (lowest to highest), for the "one build" card.
// A range, not a single number, so it never reads as "every board is $49".
// Resolved from the catalog so it stays honest if a price changes.
//
// Cached: /pricing is public and in the sitemap, and this is user-independent catalog
// data. Tagged `projects` so a price change (setProjectPrice) invalidates it rather
// than waiting out the hour.
async function premiumPriceRange(): Promise<{
  minCents: number | null;
  maxCents: number | null;
}> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS);
  // publishedRevisionId is load-bearing: 16 premium projects carry a price and
  // none is published, so without it this advertised "$49 to $149" (and emitted
  // a Product offer) for a cohort nobody can buy.
  const where = {
    accessTier: "PREMIUM" as const,
    priceCents: { not: null, gt: 0 },
    archivedAt: null,
    publishedRevisionId: { not: null },
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
  const session = await auth();
  const email = session?.user?.email ?? null;

  // AFTER auth(), deliberately. Under cacheComponents, reading the current time in a
  // Server Component before touching Request data or uncached data is a build error:
  // the prerenderer cannot tell whether "now" means build time or request time.
  // auth() reads the session cookie, which settles that — this is request time.
  // The Pass launch-window checks below need a live clock, so it must stay here
  // rather than move into a cached function.
  const now = new Date();

  const [bundle, priceRange] = await Promise.all([
    loadAllAccessBundle(),
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
  // The Pass unlocks EVERY project (@/lib/entitlements), so it is sellable only
  // once at least one premium project is actually published — the same predicate
  // loadSellablePass enforces server-side. Read at REQUEST time, deliberately not
  // inside the `use cache` block above: a stale count would render a buy button
  // for an empty catalog for up to an hour.
  const publishedPremium = await countPublishedPremiumProjects();
  const passOnSale = passSellable(bundle, publishedPremium, now);

  // Nothing that is not for sale may show a price. The CTA and the price display
  // are separate code paths; gating only the CTA renders "$299 / $399 · Launch
  // price" directly above a waitlist form.
  const passDisplayCents = passOnSale ? passCents : null;
  const showLaunchBadge = passOnSale && launchOpen;

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
  // Advertising an `offers` price for something that cannot be bought is a
  // Merchant-listing mismatch. Both conjuncts are needed: passOnSale is a plain
  // boolean and does not narrow `passCents` to a number.
  const passOfferLd =
    passOnSale && passCents !== null
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

  // passDisplayCents, not passCents: an unsellable Pass reads "Soon" in the
  // catalog rather than quoting a price nobody can pay.
  const passUnit =
    passDisplayCents !== null
      ? launchOpen && standardCents !== null && standardCents > passDisplayCents
        ? `${formatUsdShort(passDisplayCents)} / ${formatUsdShort(standardCents)}`
        : formatUsdShort(passDisplayCents)
      : "Soon";

  // Catalog price rows. The level code is the real curriculum level, a quiet
  // structural label.
  const catalog: { code: string; desc: string; price: string; hero?: boolean }[] =
    [
      {
        code: "L1.01",
        desc: "The flagship board, free start to finish",
        price: "Free",
      },
      {
        code: "L1",
        desc: "Level 1 premium builds (L1.02 to L1.05)",
        price: "Soon",
      },
      // Every tier below is unpublished, so none of it is buyable. Quoting a
      // firm figure for it is the same defect the Pass hero just shed: it
      // advertises a price the checkout will refuse, and commits us to a number
      // before the build is finished. They read "Soon" until they publish.
      { code: "L2", desc: "Level 2 builds (L2.01 to L2.05)", price: "Soon" },
      { code: "L3", desc: "Level 3 builds", price: "Soon" },
      {
        code: "CAP",
        desc: "Capstone builds (EEG front-end, fleet hub)",
        price: "Soon",
      },
      { code: "BN", desc: "Bench-tool builds", price: "Soon" },
      {
        code: "PASS",
        desc: "All-Access Pass, every premium build and bench tool",
        price: passUnit,
        hero: true,
      },
    ];

  // FAQPage structured data from the same array the visible FAQ renders (the
  // pattern courses/[slug] already ships) — free SERP rich-result eligibility
  // on the most commercially important page.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQS.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      {passOfferLd ? <JsonLd data={passOfferLd} /> : null}
      {singleOfferLd ? <JsonLd data={singleOfferLd} /> : null}
      <JsonLd data={faqLd} />
      <PricingViewedPing />

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
          The first board is free to build start to finish, no account
          required. The rest of the catalog is still being built, and each
          board&apos;s price appears here the day it opens.
        </p>
        <SpecLine
          items={["One-time purchase", "No subscription", "14-day refund"]}
        />
      </header>

      {/* Good-better-best: one build (quiet) vs the Pass (hero). */}
      <section className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Single build */}
        <div className="flex flex-col gap-6 rounded-[14px] border border-panel-border bg-bg-2/30 p-7 sm:p-8 lg:col-span-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              One build
            </p>
            <p className="mt-2 title-card">
              A single premium board
            </p>
          </div>
          {singleProjectCents !== null ? (
            <p className="font-display text-5xl leading-none tracking-wide text-title">
              {priceNumerals(formatUsdShort(singleProjectCents))}
              {maxProjectCents !== null &&
              maxProjectCents > singleProjectCents ? (
                <span className="text-3xl text-muted">
                  {" "}
                  to {priceNumerals(formatUsdShort(maxProjectCents))}
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
        <div className="relative flex flex-col gap-6 rounded-[14px] border border-command-gold/70 bg-bg-2/50 p-7 shadow-[0_0_60px_-20px_color-mix(in_srgb,var(--color-command-gold)_70%,transparent)] sm:p-9 lg:col-span-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-command-gold">
                All-Access Pass
              </p>
              <p className="mt-2 title-section">
                Every premium build and bench tool
              </p>
            </div>
            {showLaunchBadge ? (
              <span className="shrink-0 border border-command-gold/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                Launch price
              </span>
            ) : null}
          </div>
          {passDisplayCents !== null ? (
            <p className="font-display text-7xl leading-none tracking-wide text-command-gold">
              {priceNumerals(formatUsdShort(passDisplayCents))}
              {launchOpen &&
              standardCents !== null &&
              standardCents > passDisplayCents ? (
                <span className="ml-3 align-baseline text-3xl text-muted line-through">
                  {priceNumerals(formatUsdShort(standardCents))}
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
                  The Pass opens with the premium launch.
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
          open with the premium launch. Join the Pass waitlist above and we&apos;ll
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
                    r.hero ? "font-medium text-title" : "text-text"
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
                  {priceNumerals(r.price)}
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
          {PRICING_FAQS.map(([q, a]) => (
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
