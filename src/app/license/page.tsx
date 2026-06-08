// `/license` — the proprietary, all-rights-reserved license, rendered in the
// bench-console style.
//
// Server component. The license body is imported from the shared
// `@/lib/license-text` constant (kept in sync with the repo-root LICENSE file)
// rather than read from disk, so there's no `fs` access at render time. The
// `PageHeader` supplies the "LEGAL / LICENSE" hero; the body renders as
// readable serif prose inside a glass-card panel, with the copyright line in
// gold mono caps.
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import {
  LICENSE_BODY,
  LICENSE_COPYRIGHT,
  LICENSE_TITLE,
} from "@/lib/license-text";

export const metadata: Metadata = {
  title: "License · One Thousand Drones Academy",
  description: "Proprietary software license — One Thousand Drones.",
};

export default function LicensePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        backHref="/"
        backLabel="All projects"
        eyebrow="LEGAL"
        title="LICENSE"
        lead={LICENSE_TITLE}
      />

      <article className="glass-card p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
          {LICENSE_COPYRIGHT}
        </p>
        <div className="mt-6 space-y-5 font-serif text-base leading-relaxed text-gray-1">
          {LICENSE_BODY.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
