// Part detail page (design §6 / Task 7a). Server component.
//
// Loads the Part (+ its `factGroups` ordered by group, + the cached
// `datasheet`), 404s via `notFound()` on a miss, and renders:
//   - a bench identity header (mpn / manufacturer / category / lifecycle),
//   - the datasheet link (canonical `datasheetUrl`) + the cached-PDF row when a
//     `PartDatasheet` exists,
//   - one FactGroupCard per group: the EXISTING fact for curated groups, or an
//     "Add <group>" affordance for the missing ones.
//
// `canEdit = !!session` (resolved from `auth()` like the rest of the app); the
// gate controls (Edit / Verify / Flag / Clear-flag) only render when signed in.

import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { LinkIcon, DocumentIcon } from "@/components/icons";
import {
  FactGroupCard,
  type SerializedFact,
} from "@/components/parts/FactGroupCard";
import { GROUP_ORDER } from "@/components/parts/fact-group-meta";
import type { DatasheetOption } from "@/components/parts/ProvenanceFields";

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const part = await db.part.findUnique({
    where: { id },
    include: {
      datasheet: true,
      // Ordered by group; the verifier display name is resolved separately
      // below (PartFact carries verifiedById but no verifiedBy relation).
      factGroups: { orderBy: { group: "asc" } },
    },
  });

  if (!part) notFound();

  const session = await auth();
  const canEdit = !!session?.user?.email;

  // Resolve verifier display names in one query (PartFact carries verifiedById
  // but no relation; map id → name/email for the badge).
  const verifierIds = Array.from(
    new Set(
      part.factGroups
        .map((f) => f.verifiedById)
        .filter((v): v is string => !!v),
    ),
  );
  const verifiers =
    verifierIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: verifierIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const verifierName = new Map(
    verifiers.map((u) => [u.id, u.name ?? u.email]),
  );

  // Index the curated facts by group for O(1) lookup against GROUP_ORDER.
  const factByGroup = new Map(part.factGroups.map((f) => [f.group, f]));

  const datasheetOption: DatasheetOption | null = part.datasheet
    ? { id: part.datasheet.id, filename: part.datasheet.filename }
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        backHref="/parts"
        backLabel="Parts library"
        eyebrow={part.manufacturer}
        title={part.mpn}
        meta={[
          { label: "Category", value: part.category ?? "—" },
          { label: "Lifecycle", value: part.lifecycle },
          ...(part.isCertifiedModule
            ? [{ label: "Flag", value: "CERTIFIED MODULE" }]
            : []),
        ]}
        lead={part.description}
      />

      {/* ─── datasheet links ─── */}
      <section className="mb-10 flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-wider">
        {part.datasheetUrl ? (
          <a
            href={part.datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-signal-blue underline"
          >
            <LinkIcon className="h-4 w-4" />
            Datasheet URL
          </a>
        ) : null}
        {part.datasheet ? (
          <span className="inline-flex items-center gap-1.5 text-command-gold">
            <DocumentIcon className="h-4 w-4" />
            Cached PDF: {part.datasheet.filename}
          </span>
        ) : null}
        {!part.datasheetUrl && !part.datasheet ? (
          <span className="text-muted">No datasheet on file.</span>
        ) : null}
      </section>

      {/* ─── fact-group cards ─── */}
      <div className="space-y-6">
        {GROUP_ORDER.map((group) => {
          const fact = factByGroup.get(group) ?? null;
          const serialized: SerializedFact | null = fact
            ? {
                id: fact.id,
                data: fact.data,
                trust: fact.trust,
                sourceKind: fact.sourceKind,
                partDatasheetId: fact.partDatasheetId,
                sourcePage: fact.sourcePage,
                sourceUrl: fact.sourceUrl,
                sourceNote: fact.sourceNote,
                verifiedAt: fact.verifiedAt
                  ? fact.verifiedAt.toISOString()
                  : null,
                verifierName: fact.verifiedById
                  ? verifierName.get(fact.verifiedById) ?? null
                  : null,
                updatedAt: fact.updatedAt.toISOString(),
              }
            : null;
          return (
            <FactGroupCard
              key={group}
              partId={part.id}
              category={part.category}
              group={group}
              fact={serialized}
              canEdit={canEdit}
              datasheet={datasheetOption}
            />
          );
        })}
      </div>
    </main>
  );
}
