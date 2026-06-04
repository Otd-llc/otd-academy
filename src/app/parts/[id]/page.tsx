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
import { env } from "@/env";
import { db } from "@/lib/db";
import { getPartDatasheetDownloadUrl } from "@/lib/actions/part-datasheet";
import {
  getPartAssetDownloadUrl,
  getPartAssetRenderUrl,
} from "@/lib/actions/part-assets";
import { PART_ASSET_KINDS, renderBoundsSchema } from "@/lib/schemas/part-asset";
import { PageHeader } from "@/components/PageHeader";
import { DocumentIcon } from "@/components/icons";
import {
  FactGroupCard,
  type SerializedFact,
} from "@/components/parts/FactGroupCard";
import { AssetRow, type SerializedAsset } from "@/components/parts/AssetRow";
import { DatasheetUpload } from "@/components/parts/DatasheetUpload";
import { DatasheetUrlEditor } from "@/components/parts/DatasheetUrlEditor";
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
      // CAD assets (SYMBOL / FOOTPRINT / MODEL_3D); verifier names resolved with
      // the fact verifiers below.
      assets: true,
    },
  });

  if (!part) notFound();

  const session = await auth();
  const canEdit = !!session?.user?.email;

  // Resolve verifier display names in one query (PartFact carries verifiedById
  // but no relation; map id → name/email for the badge).
  const verifierIds = Array.from(
    new Set(
      [...part.factGroups, ...part.assets]
        .map((row) => row.verifiedById)
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

  // Index the CAD assets by kind for O(1) lookup against PART_ASSET_KINDS.
  const assetByKind = new Map(part.assets.map((a) => [a.kind, a]));

  const datasheetOption: DatasheetOption | null = part.datasheet
    ? { id: part.datasheet.id, filename: part.datasheet.filename }
    : null;

  // R2 is gated: only expose the upload control + cached-PDF download link when
  // R2_ENABLED. We pass a plain boolean to the client (no R2 internals leak).
  // The presigned GET is minted server-side; it's `null` when R2 is off or no
  // PartDatasheet row exists, in which case provenance falls back to
  // `datasheetUrl` + page via ProvenanceFields.
  const r2Enabled = env.R2_ENABLED;
  const cachedDatasheetUrl =
    r2Enabled && canEdit && part.datasheet
      ? await getPartDatasheetDownloadUrl(part.id)
      : null;

  // Server-resolve a presigned GET per asset kind (mirrors cachedDatasheetUrl):
  // null when R2 is off, the viewer can't edit, or no row exists for the kind.
  const assetDownloadUrls = new Map(
    await Promise.all(
      PART_ASSET_KINDS.map(
        async (kind) =>
          [
            kind,
            r2Enabled && canEdit && assetByKind.has(kind)
              ? await getPartAssetDownloadUrl(part.id, kind)
              : null,
          ] as const,
      ),
    ),
  );

  // The inline render URL is minted whenever a MODEL_3D render exists — viewing
  // is open to ANYONE (NOT gated on `canEdit`), so the in-browser 3D preview
  // works for signed-out visitors too. `getPartAssetRenderUrl` uses an inline
  // presigned GET (no attachment disposition) so the browser can fetch the .glb.
  const model3d = assetByKind.get("MODEL_3D");
  const modelRenderUrl =
    r2Enabled && model3d?.renderKey
      ? await getPartAssetRenderUrl(part.id)
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
        <DatasheetUrlEditor
          partId={part.id}
          url={part.datasheetUrl}
          canEdit={canEdit}
        />
        {part.datasheet ? (
          cachedDatasheetUrl ? (
            <a
              href={cachedDatasheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-command-gold underline"
            >
              <DocumentIcon className="h-4 w-4" />
              Datasheet (cached): {part.datasheet.filename}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-command-gold">
              <DocumentIcon className="h-4 w-4" />
              Cached PDF: {part.datasheet.filename}
            </span>
          )
        ) : null}
        {/* Editors get the "Add datasheet URL" affordance from the editor
            island instead; this fallback is for read-only viewers only. */}
        {!part.datasheetUrl && !part.datasheet && !canEdit ? (
          <span className="text-muted">No datasheet on file.</span>
        ) : null}
        {/* Upload control: only when R2 is on AND the user can edit. When R2 is
            off this renders nothing and provenance relies on datasheetUrl. */}
        {r2Enabled && canEdit ? (
          <DatasheetUpload partId={part.id} hasDatasheet={!!part.datasheet} />
        ) : null}
      </section>

      {/* ─── CAD assets (symbol / footprint / 3D model) ─── */}
      <section className="mb-10 space-y-4">
        <h2 className="font-display text-2xl tracking-wider text-white">
          Assets
        </h2>
        <div className="space-y-4">
          {PART_ASSET_KINDS.map((kind) => {
            const a = assetByKind.get(kind) ?? null;
            const serialized: SerializedAsset | null = a
              ? {
                  id: a.id,
                  trust: a.trust,
                  ref: a.ref,
                  source: a.source,
                  license: a.license,
                  filename: a.filename,
                  verifiedAt: a.verifiedAt ? a.verifiedAt.toISOString() : null,
                  verifierName: a.verifiedById
                    ? verifierName.get(a.verifiedById) ?? null
                    : null,
                  updatedAt: a.updatedAt.toISOString(),
                }
              : null;
            return (
              // Key on the asset's updatedAt so the row REMOUNTS when an upload
              // creates it or an edit changes it — re-seeding AssetRow's
              // useState-backed ref/source/license inputs from the fresh server
              // data (otherwise the inputs keep their initial "" after refresh).
              <AssetRow
                key={`${kind}:${serialized?.updatedAt ?? "empty"}`}
                partId={part.id}
                kind={kind}
                asset={serialized}
                canEdit={canEdit}
                canUpload={r2Enabled && canEdit}
                downloadUrl={assetDownloadUrls.get(kind) ?? null}
                renderUrl={kind === "MODEL_3D" ? modelRenderUrl : null}
                renderBounds={
                  // Validate the untrusted JSON column rather than cast it: a
                  // malformed/legacy row degrades to null (the viewer's clean
                  // default frame) instead of NaN camera coords.
                  kind === "MODEL_3D"
                    ? (renderBoundsSchema.safeParse(a?.renderBounds).data ?? null)
                    : null
                }
              />
            );
          })}
        </div>
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
