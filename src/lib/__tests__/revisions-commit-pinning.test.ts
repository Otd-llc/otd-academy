// Tests for setSchematicCommit / setLayoutCommit (Task 5.3).
//
// Each test creates a throwaway revision under the seeded project, sets one
// of the commit fields, then asserts the persisted value. Frozen-revision
// rejection is exercised by setting `frozenAt` directly on the test row
// (we don't have a freeze action yet — that lands in Phase 7).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import {
  createRevision,
  setLayoutCommit,
  setSchematicCommit,
} from "@/lib/actions/revisions";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdRevisionIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
});

async function makeRevision(label: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await createRevision({ projectId: project.id, label });
  createdRevisionIds.push(rev.id);
  return rev;
}

describe("setSchematicCommit", () => {
  test("accepts a valid git SHA", async () => {
    const rev = await makeRevision(`t5.3-sch-ok-${Date.now()}`);
    await setSchematicCommit({ revisionId: rev.id, value: "g1ebc1cc" });
    const fresh = await db.revision.findUniqueOrThrow({ where: { id: rev.id } });
    expect(fresh.schematicCommit).toBe("g1ebc1cc");
  });

  test("accepts an empty string and clears the field", async () => {
    const rev = await makeRevision(`t5.3-sch-clr-${Date.now()}`);
    await setSchematicCommit({ revisionId: rev.id, value: "abcd1234" });
    await setSchematicCommit({ revisionId: rev.id, value: "" });
    const fresh = await db.revision.findUniqueOrThrow({ where: { id: rev.id } });
    expect(fresh.schematicCommit).toBeNull();
  });

  test("rejects a malformed value", async () => {
    const rev = await makeRevision(`t5.3-sch-bad-${Date.now()}`);
    await expect(
      setSchematicCommit({ revisionId: rev.id, value: "not a sha!" }),
    ).rejects.toThrow();
  });

  test("rejects on a frozen revision", async () => {
    const rev = await makeRevision(`t5.3-sch-frz-${Date.now()}`);
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: seedUser.id },
    });
    await expect(
      setSchematicCommit({ revisionId: rev.id, value: "deadbee" }),
    ).rejects.toThrow(/frozen/i);
  });
});

describe("setLayoutCommit", () => {
  test("accepts a valid git SHA", async () => {
    const rev = await makeRevision(`t5.3-lay-ok-${Date.now()}`);
    await setLayoutCommit({ revisionId: rev.id, value: "gb170ddb" });
    const fresh = await db.revision.findUniqueOrThrow({ where: { id: rev.id } });
    expect(fresh.layoutCommit).toBe("gb170ddb");
  });

  test("rejects a value that's too short (< 7 chars)", async () => {
    const rev = await makeRevision(`t5.3-lay-short-${Date.now()}`);
    await expect(
      setLayoutCommit({ revisionId: rev.id, value: "abc12" }),
    ).rejects.toThrow();
  });

  test("rejects on a frozen revision", async () => {
    const rev = await makeRevision(`t5.3-lay-frz-${Date.now()}`);
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: seedUser.id },
    });
    await expect(
      setLayoutCommit({ revisionId: rev.id, value: "deadbee" }),
    ).rejects.toThrow(/frozen/i);
  });
});
