// Admin sourcing-health dashboard — the weekly substitution workspace. One screen:
// every part on a board's frozen BOM that can't be ordered right now, grouped by board,
// each with its DigiKey status, a jump to DigiKey substitutes, the part page, and the
// Re-check button. Admin-only; noindex.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { ExternalLinkIcon } from "@/components/icons";
import { RecheckAvailabilityButton } from "@/components/parts/RecheckAvailabilityButton";
import { activeBomUnorderable, digikeySubstitutesUrl } from "@/lib/active-bom-sourcing";
import { availabilityBadge } from "@/lib/part-availability";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SourcingDashboardPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") notFound();

  const issues = await activeBomUnorderable(db, new Date());
  const partCount = issues.reduce((n, b) => n + b.lines.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="SOURCING"
        title="Needs a substitute"
        accentWord="substitute"
        lead="Parts on a board's frozen BOM that can't be ordered right now. Pick an in-stock equivalent (match footprint + voltage + dielectric), swap the part, then re-check the line."
        meta={[
          { label: "Boards", value: issues.length },
          { label: "Parts", value: partCount },
        ]}
      />

      {issues.length === 0 ? (
        <div className="glass-card p-6 font-mono text-sm uppercase tracking-wider text-status-green">
          ✓ Every active BOM is fully orderable.
        </div>
      ) : (
        <div className="space-y-6">
          {issues.map((b) => (
            <section key={b.projectSlug} className="glass-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-panel-border pb-3">
                <h2 className="font-display text-xl tracking-wider text-white">
                  {b.projectName}{" "}
                  <span className="font-mono text-xs uppercase tracking-wider text-gold-dim">
                    rev {b.revisionLabel}
                  </span>
                </h2>
                <Link
                  href={`/projects/${b.projectSlug}/${encodeURIComponent(b.revisionLabel)}/guide`}
                  className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-command-gold"
                >
                  open guide →
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {b.lines.map((l) => {
                  const badge = availabilityBadge(l.status);
                  return (
                    <li
                      key={l.partId + l.refDes}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2"
                    >
                      <span className="font-mono text-sm font-bold text-white">{l.refDes}</span>
                      <span className="min-w-0 font-mono text-xs text-link-muted">
                        {l.mpn} <span className="text-muted">· {l.manufacturer}</span>
                      </span>
                      <span
                        className={`badge ${badge.tone === "red" ? "critical" : "dim"}`}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                      <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                        <a
                          href={digikeySubstitutesUrl(l)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-signal-blue hover:underline"
                        >
                          DigiKey substitutes
                          <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                        </a>
                        <Link
                          href={`/parts/${l.partId}`}
                          className="font-mono text-xs text-command-gold hover:underline"
                        >
                          open part
                        </Link>
                        <RecheckAvailabilityButton partId={l.partId} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
