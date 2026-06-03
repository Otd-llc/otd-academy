// Tests for the parts-knowledge read layer (`query.ts` + `citation.ts`).
//
// These are the HARD output guards from design §5, enforced model-independently
// in the query layer:
//   - `lookupPart` returns ONLY VERIFIED fact-groups by default, each with a
//     required non-null `citation`;
//   - UNVERIFIED facts surface ONLY under a separate `unverified` key (each with
//     an explicit `trust` field) and ONLY when `includeUnverified: true` — never
//     mixed into the verified `facts` array;
//   - FLAGGED facts are NEVER returned (not even with `includeUnverified`);
//   - a miss returns the structured `{ found: false, reason: "not_in_library" }`;
//   - citation prefers the element-level anchor over the row-level anchor;
//   - `lookupBom` resolves a project slug to its most-recent `bomFrozenAt`
//     revision (and honors a `revisionId` override) and returns each BomLine's
//     Part with the same trust-filtered verified facts.
//
// Exercises the real Neon DB directly via Prisma (no server-action layer, so no
// `@/auth` / `next/cache` mocks needed). The query functions take an INJECTED
// client (Stage B passes a read-only Prisma client); here we pass the app `db`.
//
// Isolation: one throwaway Part (+ its three PartFacts), one throwaway Project
// with a BOM-frozen Revision + a BomLine, all created in `beforeAll` and torn
// down in `afterAll`, which asserts zero leftover rows. The real
// curriculum / seed data is never touched.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";
import { lookupBom, lookupPart } from "@/lib/parts-knowledge/query";
import { citationFor } from "@/lib/parts-knowledge/citation";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "PartsQuery-TestCo";
const TEST_MPN = `PQ-${Date.now()}`;
const PROJECT_SLUG = `parts-query-test-${Date.now()}`;

let seedUserId: string;
let throwawayPartId: string;
let throwawayProjectId: string;
let frozenRevisionId: string;
let secondRevisionId: string;

beforeAll(async () => {
  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = seedUser.id;

  // ── The part under test ─────────────────────────────────────────────────
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      description: "parts-knowledge query-layer test part",
      category: "MLCC_CAPACITOR",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;

  // ── Three facts: VERIFIED, UNVERIFIED, FLAGGED ──────────────────────────
  // VERIFIED PARAMETRICS: row-level sourcePage = 4, but the FIRST entry carries
  // an element-level sourcePage = 7. The element anchor must win in the
  // per-element citation. The group citation falls back to the row page.
  await db.partFact.create({
    data: {
      partId: throwawayPartId,
      group: "PARAMETRICS",
      trust: "VERIFIED",
      sourceKind: "DATASHEET",
      sourcePage: 4,
      verifiedById: seedUserId,
      verifiedAt: new Date(),
      createdById: seedUserId,
      data: {
        entries: [
          { label: "capacitance", value: "10uF", sourcePage: 7, sourceNote: "Table 1" },
          { label: "voltage", value: "10V" },
        ],
      },
    },
  });

  // UNVERIFIED PINOUT.
  await db.partFact.create({
    data: {
      partId: throwawayPartId,
      group: "PINOUT",
      trust: "UNVERIFIED",
      sourceKind: "DATASHEET",
      sourcePage: 3,
      createdById: seedUserId,
      data: { pins: [{ number: "1", name: "VIN", function: "power" }] },
    },
  });

  // FLAGGED POWER — must NEVER be returned.
  await db.partFact.create({
    data: {
      partId: throwawayPartId,
      group: "POWER",
      trust: "FLAGGED",
      sourceKind: "DATASHEET",
      sourcePage: 5,
      createdById: seedUserId,
      data: { bypass: [{ value: "100nF", placement: "near VIN" }] },
    },
  });

  // ── A throwaway Project + a BOM-frozen Revision + a BomLine ─────────────
  const project = await db.project.create({
    data: {
      slug: PROJECT_SLUG,
      name: "parts-query test project",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayProjectId = project.id;

  // Older, un-frozen revision — lookupBom must NOT pick this one.
  const older = await db.revision.create({
    data: {
      projectId: throwawayProjectId,
      label: "older-unfrozen",
    },
    select: { id: true },
  });
  secondRevisionId = older.id;

  // The BOM-frozen revision (the one lookupBom should resolve to by slug).
  const frozen = await db.revision.create({
    data: {
      projectId: throwawayProjectId,
      label: "frozen-rev",
      bomFrozenAt: new Date(),
    },
    select: { id: true },
  });
  frozenRevisionId = frozen.id;

  await db.bomLine.create({
    data: {
      revisionId: frozenRevisionId,
      partId: throwawayPartId,
      refDes: "C1",
      quantity: 1,
      createdById: seedUserId,
    },
  });
});

afterAll(async () => {
  // Project delete cascades its Revisions → BomLines. Part delete cascades its
  // PartFacts. Sweep by id and by the test-manufacturer / slug prefix.
  if (throwawayProjectId) {
    await db.project.deleteMany({ where: { id: throwawayProjectId } }).catch(() => {});
  }
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});
  await db.project.deleteMany({ where: { slug: PROJECT_SLUG } }).catch(() => {});

  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  const leftoverFacts = throwawayPartId
    ? await db.partFact.count({ where: { partId: throwawayPartId } })
    : 0;
  const leftoverProjects = throwawayProjectId
    ? await db.project.count({ where: { id: throwawayProjectId } })
    : 0;
  expect(leftoverParts).toBe(0);
  expect(leftoverFacts).toBe(0);
  expect(leftoverProjects).toBe(0);
});

describe("citationFor (pure)", () => {
  test("prefers the element anchor over the row anchor", () => {
    const part = { mpn: "AP2112" };
    const fact = { sourcePage: 4, sourceNote: undefined as string | undefined };
    const element = { sourcePage: 7, sourceNote: "Table 1" };
    const cite = citationFor(part, fact, element);
    // Element page (7) wins over the row page (4), and the element note is appended.
    expect(cite).toBe("AP2112 datasheet p.7, Table 1");
  });

  test("falls back to the row anchor when no element is given", () => {
    const part = { mpn: "AP2112" };
    const fact = { sourcePage: 4 };
    expect(citationFor(part, fact)).toBe("AP2112 datasheet p.4");
  });

  test("degrades to a non-null string when neither has a page", () => {
    const part = { mpn: "AP2112" };
    const fact = {};
    const cite = citationFor(part, fact);
    expect(cite).toBeTruthy();
    expect(cite).toBe("AP2112 datasheet");
  });
});

describe("lookupPart — hard output guards", () => {
  test("a miss returns { found: false, reason: 'not_in_library' }", async () => {
    const r = await lookupPart(db, { mpn: "definitely-no-such-mpn-xyz" });
    expect(r).toEqual({ found: false, reason: "not_in_library" });
  });

  test("default returns ONLY the VERIFIED fact, each with a non-null citation; unverified+flagged absent", async () => {
    const r = await lookupPart(db, { manufacturer: TEST_MFR, mpn: TEST_MPN });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");

    // Exactly one fact-group (PARAMETRICS); PINOUT (unverified) + POWER (flagged) excluded.
    expect(r.facts).toHaveLength(1);
    const groups = r.facts.map((f) => f.group);
    expect(groups).toEqual(["PARAMETRICS"]);
    expect(groups).not.toContain("PINOUT");
    expect(groups).not.toContain("POWER");

    // Every returned VERIFIED fact carries trust VERIFIED and a non-null citation.
    for (const f of r.facts) {
      expect(f.trust).toBe("VERIFIED");
      expect(f.citation).toBeTruthy();
      expect(typeof f.citation).toBe("string");
    }

    // The group-level citation falls back to the ROW page (4); the per-element
    // citation for the first entry uses the ELEMENT page (7).
    const param = r.facts[0]!;
    expect(param.citation).toBe(`${TEST_MPN} datasheet p.4`);
    expect(param.citations?.[0]).toBe(`${TEST_MPN} datasheet p.7, Table 1`);

    // No `unverified` key by default.
    expect(r.unverified).toBeUndefined();
  });

  test("includeUnverified:true surfaces UNVERIFIED under a separate key (with trust), still excludes FLAGGED, never mixes into facts", async () => {
    const r = await lookupPart(db, {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      includeUnverified: true,
    });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");

    // Verified facts unchanged — UNVERIFIED is NEVER mixed in here.
    expect(r.facts.map((f) => f.group)).toEqual(["PARAMETRICS"]);
    for (const f of r.facts) expect(f.trust).toBe("VERIFIED");

    // The separate `unverified` key carries the PINOUT fact with an explicit trust.
    expect(r.unverified).toBeTruthy();
    expect(r.unverified!.map((f) => f.group)).toEqual(["PINOUT"]);
    for (const f of r.unverified!) expect(f.trust).toBe("UNVERIFIED");

    // FLAGGED (POWER) is absent from BOTH arrays even with the flag on.
    expect(r.facts.map((f) => f.group)).not.toContain("POWER");
    expect(r.unverified!.map((f) => f.group)).not.toContain("POWER");
  });

  test("resolves by partId", async () => {
    const r = await lookupPart(db, { partId: throwawayPartId });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.part.id).toBe(throwawayPartId);
    expect(r.part.mpn).toBe(TEST_MPN);
  });

  test("resolves by mpn alone", async () => {
    const r = await lookupPart(db, { mpn: TEST_MPN });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.part.mpn).toBe(TEST_MPN);
  });
});

describe("lookupBom — revision resolution + verified facts", () => {
  test("resolves a project slug to its most-recent bomFrozenAt revision and returns the part's verified facts", async () => {
    const r = await lookupBom(db, { projectSlug: PROJECT_SLUG });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");

    // Resolved to the FROZEN revision, not the older un-frozen one.
    expect(r.revisionId).toBe(frozenRevisionId);
    expect(r.revisionId).not.toBe(secondRevisionId);

    expect(r.lines).toHaveLength(1);
    const line = r.lines[0]!;
    expect(line.refDes).toBe("C1");
    expect(line.part.found).toBe(true);
    if (!line.part.found) throw new Error("expected part found");
    // Same trust-filtered verified-only facts as lookupPart.
    expect(line.part.facts.map((f) => f.group)).toEqual(["PARAMETRICS"]);
    for (const f of line.part.facts) {
      expect(f.trust).toBe("VERIFIED");
      expect(f.citation).toBeTruthy();
    }
  });

  test("honors a revisionId override", async () => {
    const r = await lookupBom(db, { revisionId: frozenRevisionId });
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.revisionId).toBe(frozenRevisionId);
    expect(r.lines).toHaveLength(1);
  });

  test("a missing project returns a structured empty result", async () => {
    const r = await lookupBom(db, { projectSlug: "no-such-project-slug-xyz" });
    expect(r.found).toBe(false);
    if (r.found) throw new Error("expected miss");
    expect(r.reason).toBe("not_in_library");
  });
});
