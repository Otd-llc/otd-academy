// Public glossary index — /glossary (plan B2).
//
// A thin, crawlable reference list of every canonical glossary term + its
// definition (the same data the in-guide `[[term]]` popovers resolve against).
// Its job is twofold: a standalone reference page, and the resolve target for
// `DefinedTerm.inDefinedTermSet.url` (the EMI moat schema points here). Pure data
// (no DB), so it renders statically. Anonymous-readable (admitted by isPublicPath).
import type { Metadata } from "next";

import { PageHeader } from "@/components/PageHeader";
import { GLOSSARY } from "@/lib/glossary";

const title = "Glossary · One Thousand Drones Academy";
const description =
  "Plain-language definitions for the electronics, EEG, and BCI terms used across the One Thousand Drones Academy curriculum.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/glossary" },
  openGraph: { title, description, type: "website", url: "/glossary" },
  twitter: { card: "summary_large_image", title, description },
};

export default function GlossaryPage() {
  // Dedupe by display term (the map is keyed by normalized lookups; a few keys
  // can share a canonical entry) and sort alphabetically, case-insensitively.
  const entries = Array.from(
    new Map(Object.values(GLOSSARY).map((e) => [e.term, e])).values(),
  ).sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="LIBRARY"
        title="Glossary"
        lead="Plain-language definitions for the terms used across the curriculum."
      />

      <dl className="space-y-5">
        {entries.map((e) => (
          <div key={e.term} className="border-b border-panel-border pb-4">
            <dt className="font-mono text-sm font-bold uppercase tracking-wider text-command-gold">
              {e.term}
            </dt>
            <dd className="mt-1.5 font-serif text-base leading-relaxed text-gray-2">
              {e.def}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
