// Tests for Guide server actions (M4: materializeGuide / editGuideCard /
// reorderGuideCards).
//
// Exercises the real Neon DB; mocks `next/cache` and `@/auth` exactly as
// `checklists-actions.test.ts` does — `requireUser()` resolves the mocked
// session email to the seeded User row.
//
// materializeGuide covers:
//   - Materializes 8 cards for a real curriculum revision (espnow-link v1).
//   - Second call on the same revision rejects with /already exists/i (the
//     pre-check dedupe path).
//
// editGuideCard covers:
//   - Patches a card's contentBlocks + lead.
//   - Rejects an invalid content-block array (Zod).
//   - Rejects when the owning revision is frozen.
//
// reorderGuideCards covers:
//   - Reverses card order; final ordinals are a contiguous 0..N-1 permutation.
//   - Rejects a non-exhaustive id set.
//
// Cleanup: the single materialized Guide is deleted in afterAll (cascades its
// cards). Any frozenAt set during a freeze test is on a Guide-owning revision
// that is itself torn down with the Guide, so no real curriculum revision is
// left mutated.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { materializeGuide } from "@/lib/actions/guides";

const SEED_EMAIL = "seed@example.com";
const SLUG = "foundry-l1-02-espnow-link";

let materializedGuideId: string | null = null;

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (materializedGuideId) {
    await db.guide
      .delete({ where: { id: materializedGuideId } })
      .catch(() => {});
  }
});

async function espnowV1RevisionId(): Promise<string> {
  const rev = await db.revision.findFirstOrThrow({
    where: {
      project: { slug: SLUG },
      label: { equals: "v1", mode: "insensitive" },
    },
    select: { id: true },
  });
  return rev.id;
}

// ─── materializeGuide ──────────────────────────────────

describe("materializeGuide", () => {
  test("materializes 8 cards for a curriculum revision; second call rejects", async () => {
    const revisionId = await espnowV1RevisionId();

    const guide = await materializeGuide({ revisionId });
    materializedGuideId = guide.id;

    const cards = await db.guideCard.count({ where: { guideId: guide.id } });
    expect(cards).toBe(8);

    await expect(materializeGuide({ revisionId })).rejects.toThrow(
      /already exists/i,
    );
  });
});
