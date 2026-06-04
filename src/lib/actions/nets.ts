"use server";

// Net server actions — first-class revision connectivity data (design §2, §4).
//
// Nets reuse the existing verify GATE (the `FactTrust` enum): a Net moves
// through `UNVERIFIED → VERIFIED → FLAGGED` ONLY via these deliberate server
// actions, each behind `requireUser` first; every MUTATING action on the Net
// row uses OPTIMISTIC CONCURRENCY (a conditional `updateMany({ where: { id,
// updatedAt } })` — the part-facts optimistic-lock pattern, with `Net.updatedAt`
// as the fence). A 0-row result means the row changed since the caller loaded
// it → we throw "reload" and never write.
//
// Create/CRUD parse a `.strict()` Zod envelope so a typo'd key is REJECTED, not
// silently dropped. `setNetTrust` is the single gate entrypoint (verify /
// unverify / flag), mirroring `verifyFact`/`unverifyFact`/`flagFact`.
//
// `deriveRails(revisionId)` is the meaty derivation (design §4 "Derive rails"):
// load the revision's BomLines → each part's PINOUT fact; expand the
// comma-joined `BomLine.refDes` into individual designators; for every `gnd`
// pin attach a NetNode to the (find-or-created) `GND` GROUND net; for every
// `power` pin attach a NetNode to a PROPOSED POWER net named from the pin name
// (3V3/VDD/VCC → +3V3; VBUS/5V/VIN → +5V; else the sanitized pin name). All
// created nets are UNVERIFIED. IDEMPOTENT: re-running reconciles against the
// unique constraints (find-or-create the net, skip-if-exists the node) and
// never duplicates nets/nodes nor clobbers a human's verify on an existing net.
//
// NB: a "use server" module may export ONLY async functions — not even a
// `export type { … }` re-export (Next's server-actions transform registers
// every export at runtime and crashes on the type-erased binding). Types +
// pure helpers (`powerNetNameFor`, the schemas) live in `@/lib/schemas/net`.

import { Prisma, type Net, type NetNode } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { pinoutSchema } from "@/lib/schemas/part-fact";
import {
  addNetNodeSchema,
  createNetSchema,
  deriveRailsSchema,
  idSchema,
  idWithLockSchema,
  netClassSchema,
  powerNetNameFor,
} from "@/lib/schemas/net";
import { z } from "zod";

// ─── Messages ───────────────────────────────────────────
const CONFLICT_MESSAGE =
  "This net changed since you opened it — reload and try again.";
const DUPLICATE_NET_MESSAGE =
  "A net with this name already exists on this revision.";

// ─── setNetTrust envelope ───────────────────────────────────────────────────
// The single gate entrypoint: { id, updatedAt, action } where action is one of
// verify | unverify | flag (mirrors the part-facts gate verbs). Strict so a
// typo'd action/key is rejected.
const setNetTrustSchema = idWithLockSchema.extend({
  action: z.enum(["verify", "unverify", "flag"]),
});

// ─── Revalidation ──────────────────────────────────────
// Refresh the owning revision's detail route on every mutation. We resolve the
// project slug + revision label from the net's revision (mirrors bom-lines.ts).
async function revalidateRevisionByNetId(netId: string): Promise<void> {
  const net = await db.net.findUnique({
    where: { id: netId },
    select: { revision: { select: { label: true, project: { select: { slug: true } } } } },
  });
  if (net?.revision) {
    revalidatePath(`/projects/${net.revision.project.slug}/${net.revision.label}`);
  }
}

async function revalidateRevisionById(revisionId: string): Promise<void> {
  const rev = await db.revision.findUnique({
    where: { id: revisionId },
    select: { label: true, project: { select: { slug: true } } },
  });
  if (rev) {
    revalidatePath(`/projects/${rev.project.slug}/${rev.label}`);
  }
}

// ─── createNet ──────────────────────────────────────────
/**
 * Validate the strict envelope (KiCad-safe `name`, `netClass`), then insert with
 * `trust: UNVERIFIED` + `createdById`. Respects `@@unique([revisionId, name])`
 * with a friendly duplicate error.
 */
export async function createNet(input: unknown): Promise<Net> {
  const env = createNetSchema.parse(input);
  const user = await requireUser();

  try {
    const net = await db.net.create({
      data: {
        revisionId: env.revisionId,
        name: env.name,
        netClass: env.netClass,
        trust: "UNVERIFIED",
        createdById: user.id,
      },
    });
    await revalidateRevisionById(env.revisionId);
    return net;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(DUPLICATE_NET_MESSAGE);
    }
    throw e;
  }
}

// ─── deleteNet ──────────────────────────────────────────
/**
 * Delete a net (cascading its NetNodes via the schema `onDelete: Cascade`). Any
 * signed-in user may delete; this strictly reduces data. No optimistic lock —
 * a delete is terminal and idempotent by id.
 */
export async function deleteNet(input: unknown): Promise<{ id: string }> {
  const { id } = idSchema.parse(input);
  await requireUser();

  const net = await db.net.findUnique({
    where: { id },
    select: { revisionId: true },
  });
  if (!net) return { id };

  await db.net.delete({ where: { id } });
  await revalidateRevisionById(net.revisionId);
  return { id };
}

// ─── addNetNode ─────────────────────────────────────────
/**
 * Attach a single designator+pin to a net. Respects
 * `@@unique([netId, refDes, pin])` — a duplicate throws (P2002).
 */
export async function addNetNode(input: unknown): Promise<NetNode> {
  const env = addNetNodeSchema.parse(input);
  await requireUser();

  const node = await db.netNode.create({
    data: { netId: env.netId, refDes: env.refDes, pin: env.pin },
  });
  await revalidateRevisionByNetId(env.netId);
  return node;
}

// ─── removeNetNode ──────────────────────────────────────
/**
 * Detach a node by id. Idempotent (a missing node is a no-op).
 */
export async function removeNetNode(input: unknown): Promise<{ id: string }> {
  const { id } = idSchema.parse(input);
  await requireUser();

  const node = await db.netNode.findUnique({
    where: { id },
    select: { netId: true },
  });
  if (!node) return { id };

  await db.netNode.delete({ where: { id } });
  await revalidateRevisionByNetId(node.netId);
  return { id };
}

// ─── setNetTrust — the verify gate ──────────────────────
/**
 * The single gate entrypoint (design §4). `action`:
 *   - "verify"   UNVERIFIED → VERIFIED, stamps `verifiedById`/`verifiedAt`.
 *   - "unverify" VERIFIED → UNVERIFIED, clears the verifier stamp.
 *   - "flag"     → FLAGGED.
 * Every transition runs on a conditional `updateMany({ where: { id, updatedAt }})`
 * (optimistic lock). A 0-row result → the row changed since the caller loaded
 * it → throw "reload" (no write). Self-verification is allowed (mirrors the
 * part-facts gate). A verify is pinned `trust: { not: "FLAGGED" }` so a flag
 * landing concurrently still blocks the verify; an unverify is pinned
 * `trust: "VERIFIED"` so it can never un-flag a FLAGGED row.
 */
export async function setNetTrust(input: unknown): Promise<Net> {
  const { id, updatedAt, action } = setNetTrustSchema.parse(input);
  const user = await requireUser();

  const row = await db.net.findUniqueOrThrow({
    where: { id },
    select: { revisionId: true, trust: true },
  });

  let where: Prisma.NetUpdateManyArgs["where"];
  let data: Prisma.NetUpdateManyMutationInput;

  switch (action) {
    case "verify": {
      // A FLAGGED net must be cleared (unverify) and re-reviewed before it can
      // be verified — a direct verify would silently erase the dispute.
      if (row.trust === "FLAGGED") {
        throw new Error(
          "A flagged net must be unflagged and re-reviewed before it can be verified.",
        );
      }
      where = { id, updatedAt, trust: { not: "FLAGGED" } };
      data = { trust: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() };
      break;
    }
    case "unverify": {
      // Pin trust: VERIFIED so unverify is idempotent + race-safe and can NEVER
      // un-flag a FLAGGED row.
      where = { id, updatedAt, trust: "VERIFIED" };
      data = { trust: "UNVERIFIED", verifiedById: null, verifiedAt: null };
      break;
    }
    case "flag": {
      where = { id, updatedAt };
      data = { trust: "FLAGGED", verifiedById: null, verifiedAt: null };
      break;
    }
  }

  const { count } = await db.net.updateMany({ where, data });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  await revalidateRevisionById(row.revisionId);
  return db.net.findUniqueOrThrow({ where: { id } });
}

// ─── deriveRails ────────────────────────────────────────
/**
 * Scan the revision's BOM → PINOUT facts and reconcile GROUND/POWER rails
 * (design §4). For each BomLine: load the part's PINOUT fact, expand the
 * comma-joined `refDes` into individual designators, and for every pin:
 *   - `type === "gnd"`  → attach to the `GND` (GROUND) net.
 *   - `type === "power"`→ attach to a PROPOSED POWER net named via
 *                          `powerNetNameFor(pin.name)`.
 * Other pin types (io / analog / clock / strapping / nc / untyped) are ignored.
 * The pin's `number` is the canonical NetNode `pin` value.
 *
 * Find-or-create per net (keyed `@@unique([revisionId, name])`) and
 * skip-if-exists per node (keyed `@@unique([netId, refDes, pin])`) make the
 * whole pass IDEMPOTENT: a re-run creates nothing new and never clobbers a
 * human's verify on an existing net. Created nets are UNVERIFIED.
 *
 * Returns a testable summary: how many nets + nodes this invocation created and
 * the set of proposed POWER net names (sorted, deduped).
 */
export async function deriveRails(input: unknown): Promise<{
  netsCreated: number;
  nodesCreated: number;
  proposedPowerNets: string[];
}> {
  const { revisionId } = deriveRailsSchema.parse(input);
  const user = await requireUser();

  // Confirm the revision exists (and is the revalidation target).
  await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { id: true },
  });

  const bomLines = await db.bomLine.findMany({
    where: { revisionId },
    select: {
      refDes: true,
      part: {
        select: {
          factGroups: {
            where: { group: "PINOUT" },
            select: { data: true },
          },
        },
      },
    },
  });

  // Plan the desired (netName, netClass) → set of (refDes, pin) nodes across the
  // whole BOM before touching the DB, so the find-or-create pass is a clean
  // reconcile. `netClassByName` records each planned net's class.
  const netClassByName = new Map<string, "GROUND" | "POWER">();
  // netName → Set("refDes pin")
  const plannedNodes = new Map<string, Set<string>>();
  const proposedPower = new Set<string>();

  const nodeKey = (refDes: string, pin: string) => `${refDes} ${pin}`;

  function plan(netName: string, netClass: "GROUND" | "POWER", refDes: string, pin: string) {
    netClassByName.set(netName, netClass);
    const set = plannedNodes.get(netName) ?? new Set<string>();
    set.add(nodeKey(refDes, pin));
    plannedNodes.set(netName, set);
  }

  for (const line of bomLines) {
    const factRow = line.part.factGroups[0];
    if (!factRow) continue; // no PINOUT fact for this part
    const parsed = pinoutSchema.safeParse(factRow.data);
    if (!parsed.success) continue; // malformed pinout — skip rather than crash

    const designators = line.refDes
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    for (const pin of parsed.data.pins) {
      if (pin.type === "gnd") {
        for (const refDes of designators) plan("GND", "GROUND", refDes, pin.number);
      } else if (pin.type === "power") {
        const netName = powerNetNameFor(pin.name);
        proposedPower.add(netName);
        for (const refDes of designators) plan(netName, "POWER", refDes, pin.number);
      }
      // every other pin type is intentionally ignored.
    }
  }

  // Reconcile against the DB. Find-or-create each planned net; skip-if-exists
  // each planned node. Count only what THIS invocation creates.
  let netsCreated = 0;
  let nodesCreated = 0;

  for (const [name, netClass] of netClassByName) {
    let net = await db.net.findUnique({
      where: { revisionId_name: { revisionId, name } },
      select: { id: true },
    });
    if (!net) {
      try {
        net = await db.net.create({
          data: {
            revisionId,
            name,
            netClass: netClassSchema.parse(netClass),
            trust: "UNVERIFIED",
            createdById: user.id,
          },
          select: { id: true },
        });
        netsCreated += 1;
      } catch (e) {
        // A concurrent derive may have created it between the find + create —
        // re-fetch rather than duplicate.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          net = await db.net.findUniqueOrThrow({
            where: { revisionId_name: { revisionId, name } },
            select: { id: true },
          });
        } else {
          throw e;
        }
      }
    }

    const wantNodes = plannedNodes.get(name) ?? new Set<string>();
    for (const key of wantNodes) {
      const [refDes, pin] = key.split(" ");
      try {
        await db.netNode.create({
          data: { netId: net.id, refDes, pin },
        });
        nodesCreated += 1;
      } catch (e) {
        // Node already present (idempotent re-run) — skip.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue;
        }
        throw e;
      }
    }
  }

  await revalidateRevisionById(revisionId);

  return {
    netsCreated,
    nodesCreated,
    proposedPowerNets: [...proposedPower].sort(),
  };
}
