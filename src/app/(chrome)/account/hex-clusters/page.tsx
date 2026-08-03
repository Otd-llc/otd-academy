import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { HexClusterRow } from "@/components/hex/HexClusterRow";
import {
  MAX_ACTIVE_CLUSTERS,
  MAX_TOTAL_CLUSTERS,
  formatDrawingLabel,
  formatRevLabel,
} from "@/lib/hex-cluster";
import type { StoredSummary } from "@/lib/hex-cluster";

// Your saved hex-cluster drawings.
//
// "Open in the configurator" is the RECALL action, and it is not optional
// garnish: without it the saved regime is unreachable from here at all, and a
// drawing number could only ever be recovered by finding the printed sheet.
//
// Archived rows are hidden behind a filter rather than dropped, because
// unarchive needs a surface — without one, archiving is a one-way trip.

export const metadata: Metadata = {
  title: "Saved builds",
  robots: { index: false, follow: false },
};

const CONFIGURATOR = "https://demo.onethousanddrones.com/hex";

export default async function HexClustersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showArchived = show === "archived";

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/sign-in?callbackUrl=%2Faccount%2Fhex-clusters");
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) redirect("/sign-in");

  const clusters = await db.hexCluster.findMany({
    where: { userId: user.id, archivedAt: showArchived ? { not: null } : null },
    // updatedAt, which a revision save touches EXPLICITLY — @updatedAt alone
    // would order by created-or-last-renamed.
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      drawingNo: true,
      name: true,
      archivedAt: true,
      revisions: {
        orderBy: { revNo: "desc" },
        select: {
          revNo: true,
          shareCode: true,
          createdAt: true,
          summary: true,
          payload: true,
          payloadHash: true,
        },
      },
    },
  });

  const [activeCount, totalCount] = await Promise.all([
    db.hexCluster.count({ where: { userId: user.id, archivedAt: null } }),
    db.hexCluster.count({ where: { userId: user.id } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="SAVED BUILDS"
        title="Your drawing register."
        lead="Every build you have saved, and every revision of it."
        meta={[
          // BOTH figures, not one: the active cap and the total cap bind
          // independently, and a user at 50 active with 190 total needs to know
          // which wall they are near.
          { label: "Active", value: `${activeCount} / ${MAX_ACTIVE_CLUSTERS}` },
          { label: "Total", value: `${totalCount} / ${MAX_TOTAL_CLUSTERS}` },
        ]}
      />

      <nav className="mt-6 flex gap-4 font-mono text-[11px] uppercase tracking-[0.16em]">
        <Link
          href="/account/hex-clusters"
          className={showArchived ? "text-muted" : "text-command-gold"}
        >
          Active
        </Link>
        <Link
          href="/account/hex-clusters?show=archived"
          className={showArchived ? "text-command-gold" : "text-muted"}
        >
          Archived
        </Link>
      </nav>

      {clusters.length === 0 ? (
        <section className="mt-8 border-t border-panel-border/60 pt-6">
          <p className="font-serif text-sm text-muted">
            {showArchived ? (
              "Nothing archived."
            ) : (
              <>
                No saved builds yet. Build a cluster in the{" "}
                <a
                  href={CONFIGURATOR}
                  className="text-command-gold underline underline-offset-4"
                >
                  hex configurator
                </a>
                , press Export, then Save.
              </>
            )}
          </p>
        </section>
      ) : (
        <ul className="mt-8">
          {clusters.map((cluster) => {
            const latest = cluster.revisions[0];
            const summary = latest?.summary as unknown as
              StoredSummary | undefined;
            return (
              <HexClusterRow
                key={cluster.id}
                id={cluster.id}
                drawingLabel={formatDrawingLabel(cluster.drawingNo)}
                name={cluster.name}
                archived={cluster.archivedAt !== null}
                latestRevLabel={latest ? formatRevLabel(latest.revNo) : "·"}
                // The list's "saved" date is the latest REVISION's createdAt,
                // not the parent's — the parent moves on a rename too.
                savedAt={
                  latest ? latest.createdAt.toISOString().slice(0, 10) : "·"
                }
                cells={summary?.cells ?? 0}
                pieces={summary?.pieces ?? 0}
                // The SHARE CODE, not the build. `/hex` resolves it on the
                // client and hands the payload plus all six identity
                // parameters straight to the frame, so the configurator opens
                // INSIDE the academy instead of navigating away from it.
                //
                // This URL used to carry the whole payload in its fragment.
                // Routing that through an academy page would have put a build
                // into PostHog, which captures `location.href` for a pageview
                // with the fragment attached.
                openHref={
                  latest ? `/hex?open=1&build=${latest.shareCode}` : null
                }
                revisions={cluster.revisions.map((r) => ({
                  revLabel: formatRevLabel(r.revNo),
                  shareCode: r.shareCode,
                  savedAt: r.createdAt.toISOString().slice(0, 10),
                }))}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}
