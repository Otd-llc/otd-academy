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
//   - The race-safe P2002 catch (guides.ts ~120-130): with a guide already
//     present, the in-tx pre-check is stubbed to null so the action proceeds
//     to `tx.guide.create`, hits the real Guide.revisionId unique constraint
//     (P2002), and surfaces the same friendly /already exists/i error.
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
import {
  editGuideCard,
  materializeGuide,
  reorderGuideCards,
} from "@/lib/actions/guides";

const SEED_EMAIL = "seed@example.com";

// Distinct foundry v1 revisions per describe block so the tests don't collide
// on the one-guide-per-revision constraint. Each materialized guide is
// tracked below and deleted in afterAll (cascades its cards).
const ESPNOW_SLUG = "foundry-l1-02-espnow-link"; // materializeGuide
const EDIT_SLUG = "foundry-bn-04-curve-tracer"; // editGuideCard
const REORDER_SLUG = "foundry-bn-05-spot-welder-controller"; // reorderGuideCards
const P2002_SLUG = "foundry-l2-04-power-led-driver"; // materializeGuide P2002 race

const createdGuideIds: string[] = [];
const frozenRevisionIds: string[] = []; // restore frozenAt -> null in afterAll

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  // Restore any frozenAt we set on a Guide-owning revision before deleting
  // the guides (a frozen revision is otherwise harmless, but we leave no
  // mutation behind on the real curriculum revisions).
  if (frozenRevisionIds.length > 0) {
    await db.revision
      .updateMany({
        where: { id: { in: frozenRevisionIds } },
        data: { frozenAt: null, frozenById: null },
      })
      .catch(() => {});
  }
  if (createdGuideIds.length > 0) {
    await db.guide
      .deleteMany({ where: { id: { in: createdGuideIds } } })
      .catch(() => {});
  }
});

async function v1RevisionId(slug: string): Promise<string> {
  const rev = await db.revision.findFirstOrThrow({
    where: {
      project: { slug },
      label: { equals: "v1", mode: "insensitive" },
    },
    select: { id: true },
  });
  return rev.id;
}

// ─── materializeGuide ──────────────────────────────────

describe("materializeGuide", () => {
  test("materializes 8 cards for a curriculum revision; second call rejects", async () => {
    const revisionId = await v1RevisionId(ESPNOW_SLUG);

    const guide = await materializeGuide({ revisionId });
    createdGuideIds.push(guide.id);

    const cards = await db.guideCard.count({ where: { guideId: guide.id } });
    expect(cards).toBe(8);

    await expect(materializeGuide({ revisionId })).rejects.toThrow(
      /already exists/i,
    );
  });

  test("race-safe P2002 catch surfaces the friendly error", async () => {
    // A guide already exists for this revision (created out-of-band below),
    // so `tx.guide.create` will violate the Guide.revisionId unique index and
    // throw P2002. We force execution PAST the in-tx pre-check by stubbing
    // `tx.guide.findUnique` to return null exactly once — that's the only way
    // to reach the `create` → P2002 path, because spying the top-level
    // `db.guide` delegate does NOT intercept the separate Prisma transaction
    // client (`tx`). So we wrap `db.$transaction`, grab the real `tx` it hands
    // the callback, and patch that proxy's `guide.findUnique` for one call.
    const revisionId = await v1RevisionId(P2002_SLUG);

    const guide = await materializeGuide({ revisionId });
    createdGuideIds.push(guide.id);

    // Minimal shape of the tx-client surface we touch — just enough to stub
    // `guide.findUnique`. The real Prisma transaction client is far wider; we
    // only patch this one method on the actual proxy and pass it through.
    type TxLike = { guide: { findUnique: (...a: unknown[]) => unknown } };
    type TxCallback = (tx: TxLike) => unknown;
    type RawTransaction = (arg: unknown, opts?: unknown) => unknown;

    const realTransaction = db.$transaction.bind(db) as unknown as RawTransaction;
    const txSpy = vi
      .spyOn(db, "$transaction")
      .mockImplementation(((arg: unknown, opts?: unknown) => {
        // Only the interactive (function) form needs the pre-check stubbed;
        // the batch-array form is passed straight through.
        if (typeof arg !== "function") {
          return realTransaction(arg, opts);
        }
        const callback = arg as TxCallback;
        return realTransaction((tx: TxLike) => {
          const originalFindUnique = tx.guide.findUnique.bind(tx.guide);
          let bypassed = false;
          tx.guide.findUnique = (...callArgs: unknown[]) => {
            if (!bypassed) {
              bypassed = true; // pre-check sees no guide → execution reaches create
              return Promise.resolve(null);
            }
            return originalFindUnique(...callArgs);
          };
          return callback(tx);
        }, opts);
      }) as typeof db.$transaction);

    try {
      await expect(materializeGuide({ revisionId })).rejects.toThrow(
        /already exists/i,
      );
    } finally {
      txSpy.mockRestore();
    }
  });
});

// ─── editGuideCard ─────────────────────────────────────

describe("editGuideCard", () => {
  test("patches contentBlocks + lead on a card", async () => {
    const revisionId = await v1RevisionId(EDIT_SLUG);
    const guide = await materializeGuide({ revisionId });
    createdGuideIds.push(guide.id);

    const card = await db.guideCard.findFirstOrThrow({
      where: { guideId: guide.id, stage: "SCHEMATIC" },
      select: { id: true },
    });

    const updated = await editGuideCard({
      id: card.id,
      lead: "Edited lead text.",
      contentBlocks: [
        { type: "prose", md: "Replacement prose block." },
        { type: "callout", severity: "info", label: "Note", body: "Body." },
      ],
    });

    expect(updated.lead).toBe("Edited lead text.");
    const blocks = updated.contentBlocks as Array<{ type: string }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.type).toBe("prose");
    expect(blocks[1]!.type).toBe("callout");
  });

  test("rejects an invalid content-block array", async () => {
    const revisionId = await v1RevisionId(EDIT_SLUG);
    // Guide already materialized by the prior test in this block; reuse it.
    const guide = await db.guide.findUniqueOrThrow({
      where: { revisionId },
      select: { id: true },
    });
    const card = await db.guideCard.findFirstOrThrow({
      where: { guideId: guide.id, stage: "LAYOUT" },
      select: { id: true },
    });

    await expect(
      editGuideCard({
        id: card.id,
        // `callout` requires a non-empty `severity`/`label`/`body` — a bare
        // unknown block type must be rejected by the Zod schema.
        contentBlocks: [{ type: "nope" } as unknown as { type: "prose"; md: string }],
      }),
    ).rejects.toThrow();
  });

  test("rejects when the owning revision is frozen", async () => {
    const revisionId = await v1RevisionId(EDIT_SLUG);
    const guide = await db.guide.findUniqueOrThrow({
      where: { revisionId },
      select: { id: true },
    });
    const card = await db.guideCard.findFirstOrThrow({
      where: { guideId: guide.id, stage: "BRINGUP" },
      select: { id: true },
    });

    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });
    await db.revision.update({
      where: { id: revisionId },
      data: { frozenAt: new Date(), frozenById: user.id },
    });
    frozenRevisionIds.push(revisionId);

    await expect(
      editGuideCard({ id: card.id, lead: "should fail" }),
    ).rejects.toThrow(/frozen/i);
  });
});

// ─── reorderGuideCards ─────────────────────────────────

describe("reorderGuideCards", () => {
  test("reverses card order; ordinals end up 0..N-1 in the supplied order", async () => {
    const revisionId = await v1RevisionId(REORDER_SLUG);
    const guide = await materializeGuide({ revisionId });
    createdGuideIds.push(guide.id);

    const before = await db.guideCard.findMany({
      where: { guideId: guide.id },
      orderBy: { ordinal: "asc" },
      select: { id: true },
    });
    const orderedIds = before.map((c) => c.id).reverse();

    const reordered = await reorderGuideCards({
      guideId: guide.id,
      orderedIds,
    });

    // Ordinals are a contiguous 0..N-1 sequence.
    expect(reordered.map((c) => c.ordinal)).toEqual(
      orderedIds.map((_, i) => i),
    );
    // Each card landed at its supplied index.
    const byId = new Map(reordered.map((c) => [c.id, c.ordinal]));
    orderedIds.forEach((id, i) => expect(byId.get(id)).toBe(i));
  });

  test("rejects a non-exhaustive id set", async () => {
    const revisionId = await v1RevisionId(REORDER_SLUG);
    const guide = await db.guide.findUniqueOrThrow({
      where: { revisionId },
      select: { id: true },
    });
    const cards = await db.guideCard.findMany({
      where: { guideId: guide.id },
      select: { id: true },
    });

    await expect(
      reorderGuideCards({
        guideId: guide.id,
        orderedIds: cards.slice(0, cards.length - 1).map((c) => c.id),
      }),
    ).rejects.toThrow(/must include every/i);
  });
});
