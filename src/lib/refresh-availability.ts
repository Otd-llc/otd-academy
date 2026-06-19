import type { PrismaClient } from "@prisma/client";
import type { DkClient } from "@/lib/digikey";
import { assessPartAvailability } from "@/lib/part-availability";

export interface RefreshArgs {
  db: PrismaClient;
  client: DkClient;
  limit: number;
  now: Date;
  // Optional scope: restrict the run to these part ids (targeted re-check / safe
  // tests). Omitted by the cron → it sweeps the whole library oldest-first.
  partIds?: string[];
}

export interface RefreshResult {
  checked: number;
  changed: number;
}

interface PriorPart {
  id: string;
  mpn: string;
  dkInStock: boolean | null;
  dkLifecycle: string | null;
  dkCheckedAt: Date | null;
}

// V1: concurrent batches of 5 — keeps ~200 parts well under the Vercel Hobby
// 60 s function cap while staying under DigiKey's per-second burst. Batch size
// IS the throttle.
const BATCH = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Decide whether this refresh is a *material* change worth an append-only event.
// `kind` vocabulary is fixed (no enum mirror): WENT_OBSOLETE | WENT_OOS |
// BACK_IN_STOCK | LIFECYCLE_CHANGED | NO_MATCH.
function classifyChange(
  part: PriorPart,
  snap: { matched: boolean; inStock: boolean | null; lifecycle: string | null },
  now: Date,
): { kind: string; fromValue: string | null; toValue: string | null } | null {
  const fromLc = part.dkLifecycle ?? null;
  const toLc = snap.lifecycle ?? null;

  if (!snap.matched) {
    // Only noteworthy if we'd previously seen this part (avoid spamming a
    // never-matchable part on every run).
    return fromLc != null || part.dkCheckedAt != null
      ? { kind: "NO_MATCH", fromValue: fromLc, toValue: null }
      : null;
  }

  const prior = assessPartAvailability(
    { dkInStock: part.dkInStock, dkLifecycle: part.dkLifecycle, dkCheckedAt: part.dkCheckedAt },
    now,
  );
  const next = assessPartAvailability(
    { dkInStock: snap.inStock, dkLifecycle: snap.lifecycle, dkCheckedAt: now },
    now,
  );

  if (!prior.buildable && next.buildable) {
    return { kind: "BACK_IN_STOCK", fromValue: fromLc, toValue: toLc };
  }
  if (prior.buildable && !next.buildable) {
    if (next.status === "OBSOLETE" || next.status === "EOL") {
      return { kind: "WENT_OBSOLETE", fromValue: fromLc, toValue: toLc };
    }
    if (next.status === "OUT_OF_STOCK") {
      return { kind: "WENT_OOS", fromValue: "in stock", toValue: "out of stock" };
    }
  }
  // A lifecycle string change without a buildable flip (e.g. Active → NRND).
  // Suppressed on first-ever observation (fromLc null) to avoid backfill noise.
  if (fromLc != null && fromLc !== toLc) {
    return { kind: "LIFECYCLE_CHANGED", fromValue: fromLc, toValue: toLc };
  }
  return null;
}

export async function refreshAvailability(args: RefreshArgs): Promise<RefreshResult> {
  const { db, client, limit, now, partIds } = args;

  // V5: never-checked parts first (nulls), then oldest-checked.
  const parts = (await db.part.findMany({
    where: partIds ? { id: { in: partIds } } : undefined,
    take: limit,
    orderBy: { dkCheckedAt: { sort: "asc", nulls: "first" } },
    select: { id: true, mpn: true, dkInStock: true, dkLifecycle: true, dkCheckedAt: true },
  })) as PriorPart[];

  let checked = 0;
  let changed = 0;

  for (const group of chunk(parts, BATCH)) {
    await Promise.all(
      group.map(async (part) => {
        const snap = await client.searchByMpn(part.mpn);
        const event = classifyChange(part, snap, now);

        await db.part.update({
          where: { id: part.id },
          data: {
            dkStockQty: snap.stockQty,
            dkUnitPriceCents: snap.unitPriceCents,
            dkInStock: snap.inStock,
            dkLifecycle: snap.lifecycle,
            dkProductUrl: snap.productUrl,
            dkCheckedAt: now,
          },
        });
        checked++;

        if (event) {
          await db.partAvailabilityEvent.create({
            data: {
              partId: part.id,
              kind: event.kind,
              fromValue: event.fromValue,
              toValue: event.toValue,
            },
          });
          changed++;
        }
      }),
    );
  }

  return { checked, changed };
}
