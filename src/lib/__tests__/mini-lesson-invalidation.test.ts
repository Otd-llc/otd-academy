// Cache invalidation for Library mini-lesson writes.
//
// WHY THIS EXISTS: the public read path (src/lib/library/load.ts) caches for an hour.
// If a write path forgets to invalidate, nothing errors — an admin edits a lesson,
// sees the admin page update, and the public page keeps serving the old copy for up
// to an hour. There is no stack trace and nothing to grep for. These tests are the
// only thing standing between that and production.
//
// Nothing else in the suite imports src/lib/actions/mini-lesson.ts, so before this
// file the tag logic (including the rename branch) had zero coverage.
//
// The DB and auth are mocked: the subject under test is WHICH TAGS FIRE, not Prisma.
import { beforeEach, describe, expect, test, vi } from "vitest";

const { updateTag, revalidatePath, miniLessonUpdate, miniLessonCreate, miniLessonFindUnique } =
  vi.hoisted(() => ({
    updateTag: vi.fn(),
    revalidatePath: vi.fn(),
    miniLessonUpdate: vi.fn(),
    miniLessonCreate: vi.fn(),
    miniLessonFindUnique: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  updateTag: (...a: unknown[]) => updateTag(...a),
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin1", role: "ADMIN" })),
}));

// withTxRetry runs its callback against a transaction client; hand it a stub whose
// miniLesson methods are the spies above.
vi.mock("@/lib/tx-retry", () => ({
  withTxRetry: (fn: (tx: unknown) => unknown) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: {
    miniLesson: {
      update: (...a: unknown[]) => miniLessonUpdate(...a),
      create: (...a: unknown[]) => miniLessonCreate(...a),
      findUnique: (...a: unknown[]) => miniLessonFindUnique(...a),
    },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        miniLesson: {
          update: (...a: unknown[]) => miniLessonUpdate(...a),
          create: (...a: unknown[]) => miniLessonCreate(...a),
          findUnique: (...a: unknown[]) => miniLessonFindUnique(...a),
        },
        projectMiniLesson: { deleteMany: vi.fn(), create: vi.fn() },
      }),
  },
}));

import { publishMiniLesson, unpublishMiniLesson } from "@/lib/actions/mini-lesson";

beforeEach(() => {
  vi.clearAllMocks();
  miniLessonUpdate.mockResolvedValue({ id: "ml1", slug: "ohms-law", published: true });
});

describe("publish/unpublish invalidate the public cache", () => {
  // Publishing a lesson that stays invisible for an hour is the failure this whole
  // migration's tag plumbing exists to prevent.
  test("publishMiniLesson clears both the index tag and the lesson's own tag", async () => {
    await publishMiniLesson("ml1");

    expect(updateTag).toHaveBeenCalledWith("mini-lessons");
    expect(updateTag).toHaveBeenCalledWith("mini-lesson-ohms-law");
  });

  // The dangerous direction: an UNPUBLISHED lesson still being served from cache is
  // unpublished content on a public URL, not merely stale content.
  test("unpublishMiniLesson clears the cache so the lesson stops being served", async () => {
    miniLessonUpdate.mockResolvedValue({ id: "ml1", slug: "ohms-law", published: false });

    await unpublishMiniLesson("ml1");

    expect(updateTag).toHaveBeenCalledWith("mini-lessons");
    expect(updateTag).toHaveBeenCalledWith("mini-lesson-ohms-law");
  });

  // updateTag, not revalidateTag: revalidateTag takes a grace window and is
  // stale-while-revalidate, so the edit would land a request later than expected.
  // If someone "simplifies" this back to revalidateTag, this fails.
  test("the sitemap tag fires — no revalidatePath below reaches /sitemap.xml", async () => {
    await publishMiniLesson("ml1");

    expect(updateTag).toHaveBeenCalledWith("mini-lessons");
    expect(revalidatePath).not.toHaveBeenCalledWith("/sitemap.xml");
  });
});
