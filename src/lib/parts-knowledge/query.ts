// Parts-knowledge read layer (design §5) — the A/B seam.
//
// Pure read functions over an INJECTED Prisma client. Stage A and the tests pass
// the app `db`; Stage B's MCP server passes a read-only client (a dedicated
// read-only Neon role). The client is typed as a structural subset
// (`PartsQueryClient`) of `PrismaClient` — only the model delegates these
// functions touch — so the read-only seam stays explicit and either client
// satisfies it.
//
// HARD OUTPUT GUARDS (enforced here, model-independent — design §5):
//   - VERIFIED-only by default; each VERIFIED fact carries a REQUIRED non-null
//     `citation` (un-citable ⇒ not emittable).
//   - UNVERIFIED facts appear ONLY when `includeUnverified === true`, ONLY under
//     a SEPARATE `unverified` key, each carrying an explicit `trust` field —
//     NEVER mixed into the verified `facts` array.
//   - FLAGGED facts are NEVER returned (not even with `includeUnverified`) —
//     they are curation-only.
//   - A miss returns the structured `{ found: false, reason: "not_in_library" }`.
//
// `citationFor` (citation.ts) pins the citation-string shape; per-element
// anchors inside `data` win over the row-level `PartFact` anchor.
import type { FactTrust, PartFactGroup, PrismaClient } from "@prisma/client";

import { citationFor, type CitableElement } from "./citation";

// ─── Injected-client type ─────────────────────────────────────────────────
// The structural subset of PrismaClient this module uses. The full app `db`
// and a read-only Prisma client both satisfy it. Read-only by construction:
// only `findFirst` / `findMany` delegates appear here.
export type PartsQueryClient = Pick<
  PrismaClient,
  "part" | "partFact" | "project" | "revision" | "bomLine"
>;

// ─── Public result shapes ─────────────────────────────────────────────────

/** A part's identity as returned to callers (no audit columns). */
export interface PartIdentity {
  id: string;
  mpn: string;
  manufacturer: string;
  category: string | null;
}

/**
 * A VERIFIED fact-group. `citation` is the REQUIRED non-null group-level
 * citation; `citations` (when present) is the per-element citation list, in
 * `data`-element order, each preferring the element anchor over the row anchor.
 */
export interface VerifiedFact {
  group: PartFactGroup;
  trust: "VERIFIED";
  data: unknown;
  citation: string;
  citations?: string[];
}

/**
 * An UNVERIFIED fact-group — only ever returned under the separate `unverified`
 * key, and only when `includeUnverified` is set. Carries an explicit `trust`.
 */
export interface UnverifiedFact {
  group: PartFactGroup;
  trust: "UNVERIFIED";
  data: unknown;
}

/** A miss — the structured abstain envelope. */
export interface NotFound {
  found: false;
  reason: "not_in_library";
}

/** A `lookupPart` hit. `unverified` is present only when requested + non-empty. */
export interface PartHit {
  found: true;
  part: PartIdentity;
  facts: VerifiedFact[];
  unverified?: UnverifiedFact[];
}

export type LookupPartResult = PartHit | NotFound;

export interface LookupPartArgs {
  partId?: string;
  mpn?: string;
  manufacturer?: string;
  refdes?: string;
  includeUnverified?: boolean;
}

/** One resolved BOM line: the line's refDes/quantity + its part lookup. */
export interface BomLineResult {
  refDes: string;
  quantity: number;
  part: LookupPartResult;
}

/** A `lookupBom` hit — the resolved revision + its lines. */
export interface BomHit {
  found: true;
  revisionId: string;
  projectSlug: string | null;
  lines: BomLineResult[];
}

export type LookupBomResult = BomHit | NotFound;

export interface LookupBomArgs {
  projectSlug?: string;
  revisionId?: string;
}

// ─── Internal: the columns we read off a PartFact ─────────────────────────
interface FactRow {
  group: PartFactGroup;
  data: unknown;
  trust: FactTrust;
  sourcePage: number | null;
  sourceNote: string | null;
}

const FACT_SELECT = {
  group: true,
  data: true,
  trust: true,
  sourcePage: true,
  sourceNote: true,
} as const;

// ─── lookupPart ───────────────────────────────────────────────────────────
/**
 * Resolve a part (by `partId`, or `manufacturer`+`mpn`, or `mpn` alone, or via a
 * BomLine `refdes`) and return its trust-filtered facts under the hard guards.
 *
 * v1 resolution order: partId → manufacturer+mpn (the `@@unique`) → mpn alone
 * (first match) → refdes via a BomLine (best-effort; see note). A no-match
 * returns `{ found: false, reason: "not_in_library" }`.
 *
 * refDes note: a bare refDes is revision-scoped (the same `R1` lives on many
 * BOMs), so without a revision/project it is ambiguous. v1 resolves it to the
 * most-recent matching BomLine's part if one exists, else abstains. Callers
 * with a revision should use `lookupBom`.
 */
export async function lookupPart(
  client: PartsQueryClient,
  args: LookupPartArgs,
): Promise<LookupPartResult> {
  const { includeUnverified = false } = args;

  const part = await resolvePart(client, args);
  if (!part) return { found: false, reason: "not_in_library" };

  const factRows = (await client.partFact.findMany({
    where: { partId: part.id },
    select: FACT_SELECT,
    orderBy: { group: "asc" },
  })) as FactRow[];

  return buildPartHit(part, factRows, includeUnverified);
}

async function resolvePart(
  client: PartsQueryClient,
  args: LookupPartArgs,
): Promise<PartIdentity | null> {
  const select = { id: true, mpn: true, manufacturer: true, category: true } as const;

  // 1. partId — the most specific.
  if (args.partId) {
    return client.part.findFirst({ where: { id: args.partId }, select });
  }

  // 2. manufacturer + mpn — the `@@unique([manufacturer, mpn])`.
  if (args.manufacturer && args.mpn) {
    return client.part.findFirst({
      where: { manufacturer: args.manufacturer, mpn: args.mpn },
      select,
    });
  }

  // 3. mpn alone — first match (mpn is indexed but not unique across mfrs).
  if (args.mpn) {
    return client.part.findFirst({ where: { mpn: args.mpn }, select });
  }

  // 4. refdes — best-effort via the most-recent matching BomLine (ambiguous
  //    without a revision; callers with one should use lookupBom).
  if (args.refdes) {
    const line = await client.bomLine.findFirst({
      where: { refDes: args.refdes },
      orderBy: { createdAt: "desc" },
      select: { part: { select } },
    });
    return line?.part ?? null;
  }

  return null;
}

/**
 * Apply the hard guards to a part's fact rows. VERIFIED → `facts` (each with a
 * required citation); UNVERIFIED → the separate `unverified` key (only when
 * requested); FLAGGED → dropped entirely.
 */
function buildPartHit(
  part: PartIdentity,
  factRows: FactRow[],
  includeUnverified: boolean,
): PartHit {
  const facts: VerifiedFact[] = [];
  const unverified: UnverifiedFact[] = [];

  for (const row of factRows) {
    // FLAGGED is curation-only — never emitted, regardless of includeUnverified.
    if (row.trust === "FLAGGED") continue;

    if (row.trust === "VERIFIED") {
      facts.push(toVerifiedFact(part, row));
    } else if (row.trust === "UNVERIFIED" && includeUnverified) {
      unverified.push({ group: row.group, trust: "UNVERIFIED", data: row.data });
    }
  }

  const hit: PartHit = { found: true, part, facts };
  // Surface the separate key only when requested AND non-empty.
  if (includeUnverified && unverified.length > 0) hit.unverified = unverified;
  return hit;
}

/** Build a VERIFIED fact with its required group citation + per-element citations. */
function toVerifiedFact(part: PartIdentity, row: FactRow): VerifiedFact {
  const fact = { sourcePage: row.sourcePage, sourceNote: row.sourceNote };

  // Group-level citation (falls back to the row anchor when no element is given).
  const citation = citationFor(part, fact);

  const fact_: VerifiedFact = { group: row.group, trust: "VERIFIED", data: row.data, citation };

  // Per-element citations: one per leaf element that may carry an anchor.
  const elements = elementsOf(row.group, row.data);
  if (elements.length > 0) {
    fact_.citations = elements.map((el) => citationFor(part, fact, el));
  }
  return fact_;
}

/**
 * Extract the anchor-bearing leaf elements from a group's `data`, in order. The
 * element anchor (`sourcePage`/`sourceNote`) wins over the row anchor in each
 * element's citation. Mirrors the per-group `data` shapes in
 * `src/lib/schemas/part-fact.ts`:
 *   PARAMETRICS / MECHANICAL → `entries[]`
 *   PINOUT                   → `pins[]`
 *   DERATING                 → `curves[]`
 *   POWER                    → `bypass[]`
 *   NOTES                    → (none; narrative blocks carry no page anchor)
 */
function elementsOf(group: PartFactGroup, data: unknown): CitableElement[] {
  if (data == null || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  let arr: unknown;
  switch (group) {
    case "PARAMETRICS":
    case "MECHANICAL":
      arr = d.entries;
      break;
    case "PINOUT":
      arr = d.pins;
      break;
    case "DERATING":
      arr = d.curves;
      break;
    case "POWER":
      arr = d.bypass;
      break;
    default:
      arr = undefined;
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((el): CitableElement => {
    if (el != null && typeof el === "object") {
      const e = el as Record<string, unknown>;
      return {
        sourcePage: typeof e.sourcePage === "number" ? e.sourcePage : undefined,
        sourceNote: typeof e.sourceNote === "string" ? e.sourceNote : undefined,
      };
    }
    return {};
  });
}

// ─── lookupBom ──────────────────────────────────────────────────────────────
/**
 * Resolve a revision and return each BomLine's Part with its verified facts.
 *
 * Resolution: if `revisionId` is given, use it. Else `projectSlug` → the
 * project's most-recent `bomFrozenAt` revision; if none is BOM-frozen, fall back
 * to the latest-updated revision. A missing project/revision/BOM returns the
 * structured `{ found: false, reason: "not_in_library" }`.
 */
export async function lookupBom(
  client: PartsQueryClient,
  args: LookupBomArgs,
): Promise<LookupBomResult> {
  const revision = await resolveRevision(client, args);
  if (!revision) return { found: false, reason: "not_in_library" };

  const lines = await client.bomLine.findMany({
    where: { revisionId: revision.id },
    orderBy: { refDes: "asc" },
    select: { refDes: true, quantity: true, partId: true },
  });

  const lineResults: BomLineResult[] = [];
  for (const line of lines) {
    lineResults.push({
      refDes: line.refDes,
      quantity: line.quantity,
      // Reuse the same trust-filtered guard logic. Verified-only by default,
      // matching lookupPart (no `includeUnverified` for the BOM contract).
      part: await lookupPart(client, { partId: line.partId }),
    });
  }

  return {
    found: true,
    revisionId: revision.id,
    projectSlug: revision.projectSlug,
    lines: lineResults,
  };
}

interface ResolvedRevision {
  id: string;
  projectSlug: string | null;
}

async function resolveRevision(
  client: PartsQueryClient,
  args: LookupBomArgs,
): Promise<ResolvedRevision | null> {
  // 1. Explicit revisionId wins.
  if (args.revisionId) {
    const rev = await client.revision.findFirst({
      where: { id: args.revisionId },
      select: { id: true, project: { select: { slug: true } } },
    });
    return rev ? { id: rev.id, projectSlug: rev.project.slug } : null;
  }

  // 2. projectSlug → most-recent bomFrozenAt revision (fallback: latest-updated).
  if (args.projectSlug) {
    const project = await client.project.findFirst({
      where: { slug: args.projectSlug },
      select: { id: true, slug: true },
    });
    if (!project) return null;

    // Prefer the most-recently BOM-frozen revision.
    const frozen = await client.revision.findFirst({
      where: { projectId: project.id, bomFrozenAt: { not: null } },
      orderBy: { bomFrozenAt: "desc" },
      select: { id: true },
    });
    if (frozen) return { id: frozen.id, projectSlug: project.slug };

    // Fallback: the latest-updated revision (none is BOM-frozen).
    const latest = await client.revision.findFirst({
      where: { projectId: project.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    return latest ? { id: latest.id, projectSlug: project.slug } : null;
  }

  return null;
}
