// `/license` — the proprietary, all-rights-reserved license, rendered as a
// legal instrument of record.
//
// Server component. The license body is imported from the shared
// `@/lib/license-text` constant (kept in sync with the repo-root LICENSE file)
// rather than read from disk, so there's no `fs` access at render time.
//
// Presented as an official document: the same honeycomb + corner-bracket frame
// as the certificate and capability briefs (CommandFrame), a registration strip
// binding the terms to the SAM-registered entity behind them, and the body set
// as numbered § clauses (citable, the way terms are referenced).
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { CommandFrame } from "@/components/CommandFrame";
import {
  LICENSE_BODY,
  LICENSE_COPYRIGHT,
  LICENSE_TITLE,
} from "@/lib/license-text";

export const metadata: Metadata = {
  title: "License · One Thousand Drones Academy",
  description: "Proprietary software license — One Thousand Drones.",
};

// The registered-entity identifiers (mirrors the site footer). They turn the
// license from anonymous boilerplate into terms from a verifiable legal entity.
const REGISTRATION: { label: string; value: string }[] = [
  { label: "SAM.gov", value: "Registered" },
  { label: "CAGE", value: "1ZYS4" },
  { label: "UEI", value: "WDQXD9L9UFH3" },
];

export default function LicensePage() {
  return (
    <main className="relative isolate overflow-hidden">
      <CommandFrame />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <PageHeader
          backHref="/"
          backLabel="All projects"
          eyebrow="LEGAL"
          title="LICENSE"
          lead={LICENSE_TITLE}
        />

        <article className="glass-card p-6 sm:p-8">
          {/* Masthead: copyright of record + the registration strip. */}
          <header className="flex flex-col gap-4 border-b border-command-gold/25 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                {LICENSE_COPYRIGHT}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-3">
                License of record · all rights reserved
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

          {/* Body as numbered clauses. */}
          <ol className="mt-7 space-y-5">
            {LICENSE_BODY.map((paragraph, i) => (
              <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-x-3">
                <span
                  aria-hidden="true"
                  className="select-none pt-1 font-mono text-xs font-bold tracking-wider text-command-gold/70"
                >
                  §{i + 1}
                </span>
                <p className="font-serif text-base leading-relaxed text-text">
                  {paragraph}
                </p>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </main>
  );
}
