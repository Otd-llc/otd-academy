// `/privacy` — the site privacy policy, rendered as a legal instrument of record
// to match `/license` (same PageHeader + document frame + registration strip +
// numbered sections). Server component, fully static.
//
// The Cloudflare Turnstile + Upstash disclosure (§3) is the load-bearing reason
// this page exists: Turnstile is a pre-consent third party (it receives IP/UA/
// device signals when the widget loads, before the user submits), so Art. 13
// requires disclosure. Managed mode is cookieless, so this is DISCLOSURE, not a
// consent banner. Do not add a consent banner or enable Turnstile Pre-Clearance.
// See docs/plans/2026-07-16-signup-abuse-defense-design.md §11.
//
// DRAFT: the effective date, the exact retention periods, the transfer
// mechanism, the sub-processor DPA confirmations, and the GDPR EU-representative
// question are owner/counsel items (implementation plan Task 11). Every practice
// described is drawn from the codebase; verify before relying on it legally.
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Privacy · One Thousand Drones Academy",
  description:
    "How One Thousand Drones Academy collects, uses, and protects your data, including the Cloudflare Turnstile and Upstash abuse-prevention controls.",
};

// Registered-entity identifiers, mirroring the site footer and the license page.
const REGISTRATION: { label: string; value: string }[] = [
  { label: "SAM.gov", value: "Registered" },
  { label: "CAGE", value: "1ZYS4" },
  { label: "UEI", value: "WDQXD9L9UFH3" },
];

const EFFECTIVE = "18 July 2026";

// Registered-agent postal address (the mailable address of record).
const CONTROLLER_ADDRESS = "9905 S Pennsylvania Ave, Ste A, Oklahoma City, OK 73159, USA";

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2.25rem_1fr] gap-x-3">
      <span
        aria-hidden="true"
        className="select-none pt-1 font-mono text-xs font-bold tracking-wider text-command-gold/70"
      >
        §{n}
      </span>
      <div>
        <h2 className="font-display text-lg tracking-wide text-title">{title}</h2>
        <div className="mt-2 space-y-3 font-serif text-base leading-relaxed text-text">
          {children}
        </div>
      </div>
    </section>
  );
}

// A leading mono label for a data-category paragraph.
function Cat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
      {children}
    </span>
  );
}

const linkClass =
  "text-command-gold underline-offset-2 hover:text-gold-light hover:underline";

// Contact channels, reused across sections.
function PrivacyEmail() {
  return (
    <a href="mailto:privacy@onethousanddrones.com" className={linkClass}>
      privacy@onethousanddrones.com
    </a>
  );
}
function ContactForm() {
  return (
    <a href="https://onethousanddrones.com/contact" rel="noopener" className={linkClass}>
      onethousanddrones.com/contact
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <PageHeader
          backHref="/"
          backLabel="Home"
          eyebrow="LEGAL"
          title="PRIVACY"
          lead="How One Thousand Drones Academy collects, uses, and protects your data."
        />

        <article className="glass-card p-6 sm:p-8">
          {/* Masthead: controller of record + effective date + registration strip. */}
          <header className="flex flex-col gap-4 border-b border-command-gold/25 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                One Thousand Drones, LLC
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-3">
                Data controller · effective {EFFECTIVE}
              </p>
            </div>
            <dl className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:items-end">
              {REGISTRATION.map((r) => (
                <div key={r.label} className="flex gap-2">
                  <dt className="text-command-gold">{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="mt-7 space-y-6">
            <Section n={1} title="Who we are">
              <p>
                One Thousand Drones, LLC runs One Thousand Drones Academy at
                academy.onethousanddrones.com. We are the controller for the personal data
                described here. Our registered address is {CONTROLLER_ADDRESS}. To reach us about
                privacy, email <PrivacyEmail /> or use <ContactForm />.
              </p>
              <p>
                We collect only what a specific feature needs, and we name the legal basis for
                each use below.
              </p>
            </Section>

            <Section n={2} title="What we collect, and the basis for it">
              <p>
                <Cat>Sign-in.</Cat> To create and secure your account we use your email address.
                You sign in with a one-time magic link, or with Google or GitHub, in which case
                we receive your verified email and basic profile (name and avatar). Basis:
                performance of our agreement with you, and our legitimate interest in keeping
                accounts secure.
              </p>
              <p>
                <Cat>Learning content and progress.</Cat> Your enrollments, lesson progress, exam
                results, certificates, and any files you upload are stored so the product works
                for you. Basis: performance of our agreement with you.
              </p>
              <p>
                <Cat>Payments.</Cat> If you buy something, our payment processor collects your
                payment details directly. We receive a confirmation and the amount, never your
                full card number. Basis: performance of our agreement with you.
              </p>
              <p>
                <Cat>Product analytics.</Cat> We record how the site is used (pages viewed,
                features used) to improve it. Basis: our legitimate interest in understanding and
                improving the product.
              </p>
              <p>
                <Cat>Email.</Cat> We send transactional email you asked for, such as sign-in links
                and receipts. We send course and marketing email only if you opt in, and you can
                unsubscribe from those at any time from the link in every message.
              </p>
            </Section>

            <Section n={3} title="Abuse and spam prevention">
              <p>
                When you use a form on the site, such as signing in or requesting a field guide,
                we run <strong className="font-semibold text-title">Cloudflare Turnstile</strong>{" "}
                to tell real visitors apart from automated abuse. Turnstile receives your IP
                address and signals about your browser and device when the widget loads, before
                you submit the form. In the managed mode we use, it sets no cookies.
              </p>
              <p>
                We also run a rate limiter (<strong className="font-semibold text-title">Upstash
                Redis</strong>) that counts sign-in and form attempts. The counters are keyed by a
                one-way HMAC hash of your email address and IP, so the store holds no readable list
                of addresses, and every counter expires on its own within minutes to a day.
              </p>
              <p>
                The basis for both is our legitimate interest in preventing the email bombing and
                spam that would harm you and our ability to deliver real mail. Both are strictly
                necessary to run the service safely, so they are always on.
              </p>
            </Section>

            <Section n={4} title="Who we share data with">
              <p>
                We do not sell your data. We share it only with the service providers that run the
                product on our behalf, each bound to use it only for that purpose:
              </p>
              <ul className="space-y-2 border-t border-panel-border/60 pt-3">
                {[
                  ["Cloudflare", "bot detection (Turnstile), file storage, and content delivery"],
                  ["Upstash", "rate-limit counters"],
                  ["Resend", "email delivery"],
                  ["Neon", "our application database"],
                  ["Vercel", "hosting and delivery of the site"],
                  ["Stripe", "payment processing"],
                  ["PostHog", "product analytics"],
                  ["Google and GitHub", "sign-in, when you choose them"],
                ].map(([name, role]) => (
                  <li
                    key={name}
                    className="flex flex-col gap-0.5 border-b border-panel-border/60 pb-2 sm:flex-row sm:items-baseline sm:gap-3"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold sm:w-40 sm:shrink-0">
                      {name}
                    </span>
                    <span className="font-serif text-sm text-muted">{role}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section n={5} title="How long we keep it">
              <p>
                The abuse-prevention counters expire automatically, within minutes to a day. We
                keep your account and learning data for as long as your account is active, and for
                a reasonable period afterward to meet legal, accounting, and security obligations.
                You can ask us to delete your account at any time.
              </p>
            </Section>

            <Section n={6} title="Where your data is processed">
              <p>
                Our providers process data in the United States. Where your data is transferred
                from another region, we rely on the appropriate safeguards for that transfer, such
                as standard contractual clauses.
              </p>
            </Section>

            <Section n={7} title="Security and breach notice">
              <p>
                We protect your data with access controls and encryption in transit, and we work
                only with providers that do the same. No system is perfectly secure. If a breach
                affects your personal data, we will notify you and the relevant authorities as
                required by law.
              </p>
            </Section>

            <Section n={8} title="Cookies">
              <p>
                We use a small number of essential cookies: one to keep you signed in, and one to
                remember your light or dark theme. Turnstile, in the managed mode we use, sets no
                cookie. Our analytics may set a cookie to measure usage. We do not use advertising
                cookies.
              </p>
              <p>
                We do not track you across other websites, and we do not sell your data, so a
                browser Do Not Track or Global Privacy Control signal has nothing to opt out of on
                our site. We treat it as already honored.
              </p>
            </Section>

            <Section n={9} title="Children's privacy">
              <p>
                One Thousand Drones Academy is meant for adults and older students. It is not
                directed at children under 13, or under 16 in the European Union. We do not
                knowingly collect personal data from children below those ages. If you believe a
                child has given us their data, email <PrivacyEmail /> and we will delete it.
              </p>
            </Section>

            <Section n={10} title="Your rights">
              <p>
                Depending on where you live, you can ask to see the data we hold about you, correct
                it, delete it, export it, or object to a particular use. If you are in the European
                Union or United Kingdom, the GDPR (and UK GDPR) gives you these rights; if you are
                in California, the CCPA, as amended by the CPRA, does.
              </p>
              <p>
                To make a request, email <PrivacyEmail /> or use <ContactForm />. We will respond
                within the time the law allows.
              </p>
            </Section>

            <Section n={11} title="Changes to this policy">
              <p>
                We will update this page when our practices change, and we will move the effective
                date at the top. Significant changes will be called out on the site.
              </p>
            </Section>

            <Section n={12} title="Contact">
              <p>
                Questions about this policy or your data go to <PrivacyEmail /> or <ContactForm />,
                or by mail to One Thousand Drones, LLC, {CONTROLLER_ADDRESS}.
              </p>
            </Section>
          </div>
        </article>
      </div>
    </main>
  );
}
