// Tests for the `saveGuideCard` structured server wrapper (guides-form.ts).
//
// `saveGuideCard` wraps the canonical `editGuideCard` action, translating its
// resolution into a `GuideFormState`: a ZodError becomes per-field `errors`, a
// success becomes `{ ok: true, createdId }`, and any other rejection becomes a
// single `message`.
//
// Exercises the real Neon DB; mocks `next/cache` and `@/auth` exactly as
// `guides-actions.test.ts` does — `requireUser()` resolves the mocked session
// email to the seeded User row.
//
// Isolation: a single DEDICATED throwaway revision is created on a foundry
// project (NOT the live curriculum v1 revision), a guide is materialized on it,
// and its first card id is grabbed for the edits. The throwaway revision is
// deleted in afterAll (cascading its guide + cards), so the real curriculum
// data is never touched. afterAll also asserts 0 leftover rows.
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

// A foundry project distinct from the slugs used by guides-actions.test.ts so
// the two suites never contend for the same project's revisions.
const SAVE_SLUG = "bn-06-tec-thermal-chamber";

let throwawayRevisionId: string;
let throwawayGuideId: string;
let firstCardId: string;

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  // Create a dedicated throwaway revision on a foundry project, materialize a
  // guide onto it, and grab its first card id.
  const project = await db.project.findFirstOrThrow({
    where: { slug: SAVE_SLUG },
    select: { id: true },
  });
  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label: `guide-save-card-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    select: { id: true },
  });
  throwawayRevisionId = rev.id;

  const guide = await materializeGuide({ revisionId: throwawayRevisionId });
  throwawayGuideId = guide.id;

  const card = await db.guideCard.findFirstOrThrow({
    where: { guideId: guide.id },
    orderBy: { ordinal: "asc" },
    select: { id: true },
  });
  firstCardId = card.id;
});

afterAll(async () => {
  // Deleting the throwaway revision cascades its guide + cards. The real
  // curriculum revisions and their backfilled guides are never touched.
  if (throwawayRevisionId) {
    await db.revision
      .deleteMany({ where: { id: throwawayRevisionId } })
      .catch(() => {});
  }
  // Verify zero leftover rows: the guide (cascade) and the revision are gone.
  const leftoverGuides = throwawayGuideId
    ? await db.guide.count({ where: { id: throwawayGuideId } })
    : 0;
  const leftoverCards = throwawayGuideId
    ? await db.guideCard.count({ where: { guideId: throwawayGuideId } })
    : 0;
  const leftoverRevisions = throwawayRevisionId
    ? await db.revision.count({ where: { id: throwawayRevisionId } })
    : 0;
  expect(leftoverGuides).toBe(0);
  expect(leftoverCards).toBe(0);
  expect(leftoverRevisions).toBe(0);
});

describe("saveGuideCard", () => {
  test("saves edited header + blocks and returns ok", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");
    const r = await saveGuideCard({
      id: firstCardId,
      title: "EDITED TITLE",
      contentBlocks: [{ type: "prose", md: "edited body" }],
    });
    expect(r.ok).toBe(true);
    expect(r.createdId).toBe(firstCardId);

    // The patch actually landed.
    const card = await db.guideCard.findUniqueOrThrow({
      where: { id: firstCardId },
      select: { title: true, contentBlocks: true },
    });
    expect(card.title).toBe("EDITED TITLE");
    const blocks = card.contentBlocks as Array<{ type: string; md?: string }>;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("prose");
    expect(blocks[0]!.md).toBe("edited body");
  });

  test("returns field errors for an invalid block (bad sourceRef href)", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");
    const r = await saveGuideCard({
      id: firstCardId,
      contentBlocks: [{ type: "sourceRef", label: "x", href: "javascript:alert(1)" }],
    });
    expect(r.ok).toBeUndefined();
    expect(r.errors).toBeTruthy();
  });

  // ─── authoritative-done invariant: gate-wiring fields are LOCKED ─────────
  //
  // `isGate` / `completionRef` drive the authoritative-done mapping and must
  // NEVER be mutable through the inline editor's `saveGuideCard` network door.

  test("editing teaching content leaves the gate-wiring fields (isGate/completionRef) untouched", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");

    // Seed a KNOWN non-default gate wiring on the card via direct Prisma
    // (mirroring how materializeGuide seeds it — NOT through editGuideCard).
    const knownCompletionRef = {
      kind: "revisionChecklist",
      subkind: "REQUIREMENTS_REVIEW",
    } as const;
    await db.guideCard.update({
      where: { id: firstCardId },
      data: {
        isGate: true,
        completionRef: knownCompletionRef,
      },
    });

    // Edit ONLY teaching content.
    const r = await saveGuideCard({
      id: firstCardId,
      title: "TEACHING ONLY EDIT",
      contentBlocks: [{ type: "prose", md: "fresh teaching prose" }],
    });
    expect(r.ok).toBe(true);
    expect(r.createdId).toBe(firstCardId);

    // Read the row back: teaching content updated, gate wiring UNCHANGED.
    const card = await db.guideCard.findUniqueOrThrow({
      where: { id: firstCardId },
      select: {
        title: true,
        contentBlocks: true,
        isGate: true,
        completionRef: true,
      },
    });
    expect(card.title).toBe("TEACHING ONLY EDIT");
    const blocks = card.contentBlocks as Array<{ type: string; md?: string }>;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.md).toBe("fresh teaching prose");

    // The locked fields kept their seeded values.
    expect(card.isGate).toBe(true);
    expect(card.completionRef).toEqual(knownCompletionRef);
  });

  test("rejects an injected isGate/completionRef and never writes the gate-wiring columns", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");

    // Establish a KNOWN gate wiring + title baseline.
    const knownCompletionRef = {
      kind: "buildChecklist",
      subkind: "ASSEMBLY_STEPS",
    } as const;
    await db.guideCard.update({
      where: { id: firstCardId },
      data: {
        isGate: false,
        completionRef: knownCompletionRef,
        title: "BASELINE TITLE",
      },
    });

    // Adversarial payload: a hand-crafted POST that injects the LOCKED
    // gate-wiring fields alongside a legit teaching edit.
    const r = await saveGuideCard({
      id: firstCardId,
      title: "ATTACKER TITLE",
      isGate: true,
      completionRef: { kind: "none" },
    } as unknown);

    // The strict boundary rejects it (unrecognized_keys → ZodError → errors).
    expect(r.ok).toBeUndefined();
    expect(r.errors).toBeTruthy();

    // Nothing was written — neither the gate-wiring columns NOR the title
    // (the whole payload was rejected at the boundary, before editGuideCard).
    const card = await db.guideCard.findUniqueOrThrow({
      where: { id: firstCardId },
      select: { title: true, isGate: true, completionRef: true },
    });
    expect(card.title).toBe("BASELINE TITLE");
    expect(card.isGate).toBe(false);
    expect(card.completionRef).toEqual(knownCompletionRef);
  });
});
