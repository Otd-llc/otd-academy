// /about — the public trust surface (E-E-A-T). Answers "who runs this and how do
// we know the work is real": the mission, the methodology that makes a completion
// mean something (DRC gate, validated designs, cited claims, verifiable certs),
// and the organization behind it (One Thousand Drones LLC, with its verifiable
// federal identifiers). Anonymous-readable and crawlable; no DB reads.
//
// Voice: quiet precision, answer-first, no em-dashes, no fabricated metrics.

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { aboutPageJsonLd, organizationJsonLd, siteUrl, ORG_IDENTIFIERS } from "@/lib/seo/jsonld";

const title = "About | One Thousand Drones Academy";
const description =
  "One Thousand Drones Academy teaches PCB engineering through real ESP32-S3 boards in KiCad. Progress is gated on a clean design-rule check, every design is validated before you build, and each completion earns a certificate anyone can verify.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description, type: "website", url: "/about" },
  twitter: { card: "summary_large_image", title, description },
};

// The methodology points — why a completion here means something. Each is a
// concrete, checkable practice, not a marketing adjective.
const METHOD: { lead: string; body: string }[] = [
  {
    lead: "You ship boards, not quizzes.",
    body: "Progress is gated on a clean design-rule check and valid, fab-ready gerbers, the same bar a working hardware team passes. Not points, not streaks.",
  },
  {
    lead: "The full engineering arc, every project.",
    body: "Eight stages on every board: requirements, bill of materials, schematic capture, electrical-rules check, layout, design-rule check, gerber export, and bring-up.",
  },
  {
    lead: "Designs are validated before you build.",
    body: "Each board passes a recursive design-validation protocol of ten or more audit passes before any part is committed, so you are not soldering someone's first draft.",
  },
  {
    lead: "Parts are real and current.",
    body: "Every board's bill of materials is priced against live DigiKey stock and re-checked nightly, and is one click to a cart you can order.",
  },
  {
    lead: "Claims are cited.",
    body: "Empirical and comparative statements are sourced to primary references (datasheets, standards, papers), not asserted.",
  },
  {
    lead: "Certificates you can check.",
    body: "Every finished project issues a sealed certificate that anyone can independently verify.",
  },
];

export default function AboutPage() {
  const base = siteUrl();
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={aboutPageJsonLd({ url: `${base}/about` })} />

      {/* Hero */}
      <header className="border-b border-panel-border pb-12 sm:pb-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          About
        </p>
        <h1 className="mt-4 title-hero text-title">
          Design real boards. Prove it.
        </h1>
        <p className="subhead mt-6">
          One Thousand Drones Academy teaches printed-circuit-board engineering
          through real projects on the Espressif ESP32-S3, designed in KiCad. You
          take a board from requirements to fab-ready gerbers, and you advance only
          when the design passes a clean design-rule check.
        </p>
      </header>

      {/* What it is */}
      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          What it is
        </p>
        <div className="mt-4 space-y-4 font-serif text-base leading-relaxed text-text">
          <p>
            Most hardware courses stop at theory, so the skill stays unproven. Here
            you design a manufacturable board end to end and walk away able to
            fabricate it. The catalog runs twenty-two boards across four tracks and
            three levels, wired as one skill tree, converging on two capstones: an
            eight-channel EEG brain-computer-interface front-end and an ESP-NOW
            wireless fleet hub.
          </p>
          <p>
            The first board, L1.01, is free to build start to finish, no account
            required. It is the honest sample of the whole method. Every other build
            is a one-time purchase with lifetime access, no subscription.
          </p>
        </div>
      </section>

      {/* Methodology / trust */}
      <section className="mt-12 border-t border-panel-border pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          How we keep it honest
        </p>
        <h2 className="mt-3 title-section">What makes a completion real</h2>
        <dl className="mt-7 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
          {METHOD.map((m) => (
            <div key={m.lead}>
              <dt className="font-medium text-title">{m.lead}</dt>
              <dd className="mt-1.5 font-serif text-sm leading-relaxed text-text">
                {m.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Who builds it */}
      <section className="mt-12 border-t border-panel-border pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-command-gold">
          Who builds it
        </p>
        <div className="mt-4 space-y-4 font-serif text-base leading-relaxed text-text">
          <p>
            The Academy is built and maintained by One Thousand Drones LLC, a
            hardware company in Broken Arrow, Oklahoma. It is the talent and hardware
            pipeline beneath the company&apos;s Brain-to-Swarm program, so the boards
            you build are the same platform the company develops on, not toy
            exercises.
          </p>
          <p>
            One Thousand Drones LLC is a registered federal contractor. Its
            identifiers are public and verifiable:
          </p>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {ORG_IDENTIFIERS.map((id) => (
            <li key={id.name}>
              {id.name} <span className="text-title">{id.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTAs */}
      <section className="mt-14 flex flex-wrap items-center gap-4 border-t border-panel-border pt-10">
        <Link
          href="/projects/l1-01-wroom-breakout/v1/guide"
          className="glass-button glass-button-cta px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
        >
          Start free at L1.01 →
        </Link>
        <Link
          href="/courses"
          className="font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
        >
          See the courses
        </Link>
        <Link
          href="/verify"
          className="font-mono text-sm uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
        >
          Verify a certificate
        </Link>
      </section>
    </main>
  );
}
