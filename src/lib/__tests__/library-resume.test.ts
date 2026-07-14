// Tests for getLibraryResume — where a signed-in learner is sent next in the Library
// (start / continue / next / restart), by the page's canonical lesson order. DB-backed
// with a throwaway user + synthetic completions/events; real pool DB, no mocks.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getLibraryResume } from "@/lib/logbook/load";

const EMAIL = "library-resume-test@example.com";
const ORDERED = ["lr-a", "lr-b", "lr-c"]; // synthetic canonical order

let userId = "";

async function complete(slug: string) {
  await db.lessonCompletion.create({ data: { userId, lessonSlug: slug } });
}
async function touch(
  slug: string,
  source: "QUIZ_CORRECT" | "LESSON_COMPLETE" = "LESSON_COMPLETE",
  createdAt?: Date,
) {
  await db.xpEvent.create({
    data: {
      userId,
      source,
      amount: 1,
      refId: source === "QUIZ_CORRECT" ? `${slug}#q1` : slug,
      earnedOn: new Date("2026-07-14T00:00:00Z"),
      dedupeKey: `lr:${randomUUID()}`,
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

beforeEach(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } }); // cascades completions/events
  const u = await db.user.create({ data: { email: EMAIL, name: "Resume Test" } });
  userId = u.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
});

describe("getLibraryResume", () => {
  test("no activity → start at the first lesson", async () => {
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "start", slug: "lr-a" });
  });

  test("a touched-but-uncompleted lesson → continue it (even past a completed one)", async () => {
    await complete("lr-a");
    await touch("lr-b", "QUIZ_CORRECT");
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "continue", slug: "lr-b" });
  });

  test("completed with nothing in progress → the next uncompleted lesson", async () => {
    await complete("lr-a");
    await touch("lr-a"); // touched AND completed → not in progress
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "next", slug: "lr-b" });
  });

  test("every lesson completed → restart at the first lesson", async () => {
    for (const s of ORDERED) await complete(s);
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "restart", slug: "lr-a" });
  });

  test("continue picks the most-recently-touched lesson", async () => {
    await touch("lr-a", "QUIZ_CORRECT", new Date("2026-07-14T10:00:00Z"));
    await touch("lr-c", "QUIZ_CORRECT", new Date("2026-07-14T11:00:00Z"));
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "continue", slug: "lr-c" });
  });

  test("events for non-library slugs are ignored", async () => {
    await touch("not-a-library-lesson", "QUIZ_CORRECT");
    expect(await getLibraryResume(userId, ORDERED)).toEqual({ mode: "start", slug: "lr-a" });
  });

  test("an empty ordered list returns null", async () => {
    expect(await getLibraryResume(userId, [])).toBeNull();
  });
});
