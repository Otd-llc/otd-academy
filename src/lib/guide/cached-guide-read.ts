// The USER-INDEPENDENT half of the public guide pages, cached.
//
// The guide hub + all 8 stage cards per PUBLIC project are sitemapped
// (src/app/sitemap.ts), so crawlers hit them continuously — and until this
// module they were fully dynamic: every Googlebot/Ahrefs request ran the whole
// project → revision → card → blocks → models → BOM read against Neon,
// defeating scale-to-zero (~0.25 CU held awake around the clock ≈ 182 CU-h/mo
// against a 100 CU-h budget). Same split as src/lib/skill-tree.ts: the shared
// content is cached for an hour; the session overlay (auth, entitlement,
// enrollment, author tooling) stays dynamic in the page on top of it.
//
// CACHE-KEY BOUNDING (repo caching law): `use cache` keys on arguments and a
// route param matches ANY string, so callers MUST bound `slug` against
// `knownProjectSlugs()` (already cached) and `labelLower` against
// `cachedRevLabelsLower()` BEFORE calling the entry functions here. Otherwise a
// crawler mints one cache entry + one DB read per garbage URL — the exact
// behaviour this file exists to eliminate.
//
// INVALIDATION: tagged TAG_PROJECTS (publish/price/tier flips already bust it
// via invalidateProjectGraph) + guideContentTag(slug) (card edits, reorders,
// materialize, capture media writes — see invalidateGuideContent). Part/BOM
// data inside the payload (DigiKey stock/price) refreshes nightly by cron and
// tolerates the extra ≤1h staleness by design.
//
// Everything returned crosses the cache boundary: plain JSON-safe values plus
// Date (Flight-serializable). No Set/Map/Decimal/class instances.
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { env } from "@/env";
import { ONE_HOUR, TAG_PROJECTS, guideContentTag } from "@/lib/cache-profile";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { partModelSrc } from "@/lib/part-model-url";
import { renderBoundsSchema } from "@/lib/schemas/part-asset";
import type { AccessTier, CurriculumLevel } from "@prisma/client";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";
import type { ContentBlock } from "@/lib/schemas/guide";
import type { BomRow, ResolvedModel } from "@/components/guide/GuideBlocks";

/** Lower-cased revision labels for a project — the bound for `labelLower`. */
export async function cachedRevLabelsLower(slug: string): Promise<string[]> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS, guideContentTag(slug));
  const rows = await db.revision.findMany({
    where: { project: { slug } },
    select: { label: true },
  });
  return rows.map((r) => r.label.toLowerCase());
}

export type CachedGuideProject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  level: CurriculumLevel | null;
  accessTier: AccessTier;
  stripePriceId: string | null;
  priceCents: number | null;
  hasExam: boolean;
  publishedLabel: string | null;
};

export type CachedGuideRevision = {
  id: string;
  label: string;
  currentStage: string;
  frozenAt: Date | null;
  guideId: string | null;
};

export type CachedGuideCard = {
  id: string;
  stage: GuideStage;
  ordinal: number;
  eyebrow: string;
  title: string;
  lead: string | null;
  /** Raw completionRef JSON — page parses with completionRefSchema. */
  completionRef: unknown;
  blocks: ContentBlock[];
  storageIndices: number[];
  dropped: number[];
};

export type CachedGuideStage = {
  project: CachedGuideProject;
  revision: CachedGuideRevision;
  /** null = revision has a guide but no card for this stage (page 404s). */
  card: CachedGuideCard | null;
  models: Record<string, ResolvedModel>;
  bomRows: BomRow[] | undefined;
};

const PROJECT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  level: true,
  accessTier: true,
  stripePriceId: true,
  priceCents: true,
  exam: { select: { id: true } },
  publishedRevision: { select: { label: true } },
} as const;

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  level: CurriculumLevel | null;
  accessTier: AccessTier;
  stripePriceId: string | null;
  priceCents: number | null;
  exam: { id: string } | null;
  publishedRevision: { label: string } | null;
};

function toProject(p: ProjectRow): CachedGuideProject {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    level: p.level,
    accessTier: p.accessTier,
    stripePriceId: p.stripePriceId,
    priceCents: p.priceCents,
    hasExam: p.exam !== null,
    publishedLabel: p.publishedRevision?.label ?? null,
  };
}

/**
 * One stage card's full anonymous render data. Returns null when the project or
 * revision doesn't exist (callers bound the args, so this is belt-and-braces,
 * not the crawler-garbage path).
 */
export async function cachedGuideStage(
  slug: string,
  labelLower: string,
  stage: GuideStage,
): Promise<CachedGuideStage | null> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS, guideContentTag(slug));

  const project = await db.project.findUnique({
    where: { slug },
    select: PROJECT_SELECT,
  });
  if (!project) return null;

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: labelLower, mode: "insensitive" },
    },
    select: {
      id: true,
      label: true,
      currentStage: true,
      frozenAt: true,
      guide: { select: { id: true } },
    },
  });
  if (!revision) return null;

  const base = {
    project: toProject(project),
    revision: {
      id: revision.id,
      label: revision.label,
      currentStage: revision.currentStage,
      frozenAt: revision.frozenAt,
      guideId: revision.guide?.id ?? null,
    },
  };
  if (!revision.guide) return { ...base, card: null, models: {}, bomRows: undefined };

  const card = await db.guideCard.findFirst({
    where: { guideId: revision.guide.id, stage },
    select: {
      id: true,
      stage: true,
      ordinal: true,
      eyebrow: true,
      title: true,
      lead: true,
      contentBlocks: true,
      completionRef: true,
    },
  });
  if (!card) return { ...base, card: null, models: {}, bomRows: undefined };

  const { blocks, storageIndices, dropped } = parseGuideBlocks(card.contentBlocks);

  // partModel blocks → proxy render URL + camera bounds, keyed by MPN. Two
  // queries total regardless of block count (moved verbatim from the page).
  const modelMpns = Array.from(
    new Set(blocks.flatMap((b) => (b.type === "partModel" && b.mpn ? [b.mpn] : []))),
  );
  const models: Record<string, ResolvedModel> = {};
  if (modelMpns.length > 0 && env.R2_ENABLED && env.R2_BUCKET) {
    const parts = await db.part.findMany({
      where: { mpn: { in: modelMpns } },
      select: { id: true, mpn: true },
    });
    const assets = await db.partAsset.findMany({
      where: {
        partId: { in: parts.map((p) => p.id) },
        kind: "MODEL_3D",
        renderKey: { not: null },
      },
      select: { partId: true, id: true, updatedAt: true, renderBounds: true, renderKey: true },
    });
    const assetByPart = new Map(assets.map((a) => [a.partId, a]));
    for (const part of parts) {
      const asset = assetByPart.get(part.id);
      if (!asset) continue;
      models[part.mpn] = {
        // renderKey enables the direct-R2 URL when NEXT_PUBLIC_R2_PUBLIC_BASE_URL
        // is set (Phase 9); else partModelSrc falls back to the proxy.
        src: partModelSrc(asset.id, asset.updatedAt, asset.renderKey),
        bounds: renderBoundsSchema.safeParse(asset.renderBounds).data ?? null,
      };
    }
  }

  // bomTable block → the revision's BOM rows (moved verbatim from the page).
  let bomRows: BomRow[] | undefined;
  if (blocks.some((b) => b.type === "bomTable")) {
    const lines = await db.bomLine.findMany({
      where: { revisionId: revision.id },
      select: {
        refDes: true,
        quantity: true,
        part: {
          select: {
            id: true,
            mpn: true,
            manufacturer: true,
            description: true,
            datasheetUrl: true,
            lifecycle: true,
            datasheet: { select: { id: true } },
            dkInStock: true,
            dkLifecycle: true,
            dkCheckedAt: true,
            dkUnitPriceCents: true,
            dkPartNumber: true,
          },
        },
      },
      orderBy: { refDes: "asc" },
    });
    const partIds = lines.map((l) => l.part.id);
    const assets =
      env.R2_ENABLED && env.R2_BUCKET
        ? await db.partAsset.findMany({
            where: { partId: { in: partIds }, kind: "MODEL_3D", renderKey: { not: null } },
            select: { id: true, partId: true, updatedAt: true, renderBounds: true, renderKey: true },
          })
        : [];
    const modelByPart = new Map(
      assets.map(
        (a) =>
          [
            a.partId,
            {
              src: partModelSrc(a.id, a.updatedAt, a.renderKey),
              bounds: renderBoundsSchema.safeParse(a.renderBounds).data ?? null,
            },
          ] as const,
      ),
    );
    bomRows = lines.map((l) => {
      const m = modelByPart.get(l.part.id);
      return {
        partId: l.part.id,
        refDes: l.refDes,
        qty: l.quantity,
        mpn: l.part.mpn,
        manufacturer: l.part.manufacturer,
        description: l.part.description,
        datasheetUrl: l.part.datasheetUrl,
        lifecycle: l.part.lifecycle,
        hasDatasheet: !!l.part.datasheetUrl || l.part.datasheet !== null,
        dkInStock: l.part.dkInStock,
        dkLifecycle: l.part.dkLifecycle,
        dkCheckedAt: l.part.dkCheckedAt,
        dkUnitPriceCents: l.part.dkUnitPriceCents,
        dkPartNumber: l.part.dkPartNumber,
        modelSrc: m?.src ?? null,
        modelBounds: m?.bounds ?? null,
      };
    });
  }

  return {
    ...base,
    card: {
      id: card.id,
      stage: card.stage as GuideStage,
      ordinal: card.ordinal,
      eyebrow: card.eyebrow,
      title: card.title,
      lead: card.lead,
      completionRef: card.completionRef,
      blocks,
      storageIndices,
      dropped,
    },
    models,
    bomRows,
  };
}

export type CachedGuideHubCard = {
  id: string;
  stage: GuideStage;
  ordinal: number;
  eyebrow: string;
  title: string;
  lead: string | null;
  completionRef: unknown;
};

export type CachedGuideHub = {
  project: CachedGuideProject;
  revision: CachedGuideRevision;
  /** Ordinal-ordered guide cards; empty when the revision has no guide. */
  cards: CachedGuideHubCard[];
};

/** The hub's anonymous render data (no builds/boards — author-only, dynamic). */
export async function cachedGuideHub(
  slug: string,
  labelLower: string,
): Promise<CachedGuideHub | null> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PROJECTS, guideContentTag(slug));

  const project = await db.project.findUnique({
    where: { slug },
    select: PROJECT_SELECT,
  });
  if (!project) return null;

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: labelLower, mode: "insensitive" },
    },
    select: {
      id: true,
      label: true,
      currentStage: true,
      frozenAt: true,
      guide: {
        select: {
          id: true,
          cards: {
            orderBy: { ordinal: "asc" },
            select: {
              id: true,
              stage: true,
              ordinal: true,
              eyebrow: true,
              title: true,
              lead: true,
              completionRef: true,
            },
          },
        },
      },
    },
  });
  if (!revision) return null;

  return {
    project: toProject(project),
    revision: {
      id: revision.id,
      label: revision.label,
      currentStage: revision.currentStage,
      frozenAt: revision.frozenAt,
      guideId: revision.guide?.id ?? null,
    },
    cards: (revision.guide?.cards ?? []).map((c) => ({
      id: c.id,
      stage: c.stage as GuideStage,
      ordinal: c.ordinal,
      eyebrow: c.eyebrow,
      title: c.title,
      lead: c.lead,
      completionRef: c.completionRef,
    })),
  };
}
