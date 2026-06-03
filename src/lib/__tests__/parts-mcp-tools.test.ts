// Integration tests for the MCP tool handlers (`mcp/parts-server/tools.ts`).
//
// These prove the thin handlers compose `query.ts` (grounding + hard guards)
// with `format.ts` (answer contract + untrusted-data envelope) end-to-end —
// against the REAL Neon DB, with the app `db` injected (which structurally
// satisfies `PartsQueryClient`). No stdio transport is stood up; we call the
// handlers directly, the same way `server.ts` will.
//
// The hard guards themselves are already proven in `parts-query.test.ts`; here
// we assert they survive the formatter wrapping: a miss abstains with
// `structuredContent.found === false`; a hit surfaces ONLY the verified
// PARAMETRICS group with its citation in `structuredContent` AND the rendered
// text; `unverified` is absent by default; `includeUnverified` isolates the
// UNVERIFIED PINOUT under the separate key and never surfaces the FLAGGED POWER;
// and `lookup_bom` resolves a project slug to its BOM-frozen revision's lines.
//
// Isolation mirrors `parts-query.test.ts`: one throwaway Part (+ its three
// PartFacts) and one throwaway Project with a BOM-frozen Revision + a BomLine,
// created in `beforeAll` and torn down in `afterAll` (which asserts zero leftover
// rows). DISTINCT constants keep this file from colliding with
// `parts-query.test.ts`. The real curriculum / seed data is never touched.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";
import { handleLookupBom, handleLookupPart } from "../../../mcp/parts-server/tools";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "MCPTools-TestCo";
const TEST_MPN = `MCPT-${Date.now()}`;
const PROJECT_SLUG = `parts-mcp-tools-test-${Date.now()}`;

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
      description: "parts MCP tool-handler test part",
      category: "MLCC_CAPACITOR",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;

  // ── Three facts: VERIFIED, UNVERIFIED, FLAGGED ──────────────────────────
  // VERIFIED PARAMETRICS: row-level sourcePage = 4, but the FIRST entry carries
  // an element-level sourcePage = 7. The group citation falls back to the row
  // page (4); the per-element citation uses the element page (7).
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

  // UNVERIFIED PINOUT — only under the separate `unverified` key, only with the flag.
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

  // FLAGGED POWER — must NEVER be returned (not even with includeUnverified).
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
      name: "parts MCP tools test project",
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

  // Reference the bookkeeping id so the un-frozen revision is part of the fixture.
  expect(secondRevisionId).toBeTruthy();
  expect(secondRevisionId).not.toBe(frozenRevisionId);
});

describe("handleLookupPart", () => {
  test("a miss abstains with structuredContent.found=false", async () => {
    const out = await handleLookupPart(db, { mpn: "no-such-mpn-zzz" });
    expect((out.structuredContent as { found: boolean }).found).toBe(false);
    expect(out.content[0]!.text).toMatch(/abstain/i);
  });

  test("a hit returns ONLY the verified fact with its citation; unverified+flagged absent by default", async () => {
    const out = await handleLookupPart(db, { manufacturer: TEST_MFR, mpn: TEST_MPN });
    const sc = out.structuredContent as {
      found: true;
      facts: { group: string; citation: string }[];
      unverified?: unknown;
    };
    expect(sc.facts.map((f) => f.group)).toEqual(["PARAMETRICS"]);
    expect(sc.facts[0]!.citation).toBe(`${TEST_MPN} datasheet p.4`);
    expect(sc.unverified).toBeUndefined();
    expect(out.content[0]!.text).toContain(`${TEST_MPN} datasheet p.4`);
  });

  test("includeUnverified isolates UNVERIFIED under the separate key; FLAGGED still absent", async () => {
    const out = await handleLookupPart(db, {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      includeUnverified: true,
    });
    const sc = out.structuredContent as {
      unverified: { group: string }[];
      facts: { group: string }[];
    };
    expect(sc.unverified.map((f) => f.group)).toEqual(["PINOUT"]);
    expect(sc.facts.map((f) => f.group)).not.toContain("POWER");
    expect(sc.unverified.map((f) => f.group)).not.toContain("POWER");
  });
});

describe("handleLookupBom", () => {
  test("resolves a project slug to its frozen revision's lines with verified facts", async () => {
    const out = await handleLookupBom(db, { projectSlug: PROJECT_SLUG });
    const sc = out.structuredContent as { found: true; revisionId: string; lines: { refDes: string }[] };
    expect(sc.found).toBe(true);
    expect(sc.revisionId).toBe(frozenRevisionId);
    expect(sc.lines.map((l) => l.refDes)).toContain("C1");
  });
});
