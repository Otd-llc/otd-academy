import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { deriveLessonMeta } from "@/lib/library/derived";

// Throwaway rows only -- never real curriculum rows (see the guide-completion
// prod-coupled-test lesson). Each DB test file leases its own branch clone, so
// these creates/deletes are isolated.
const blocks = [
  { type: "prose", md: "word ".repeat(600).trim() },
  { type: "image", src: "/guide-diagrams/derived-test.svg", alt: "test diagram" },
  {
    type: "quiz",
    questions: [
      { q: "First?", options: ["a", "b"], answer: 0 },
      { q: "Second?", options: ["a", "b"], answer: 1 },
      { q: "Third?", options: ["a", "b"], answer: 0 },
    ],
  },
];

async function anyUserId() {
  const u = await db.user.findFirst({ select: { id: true } });
  if (!u) throw new Error("seed fixture is missing a User row");
  return u.id;
}

const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

describe("MiniLesson derived-column extension", () => {
  it("populates derived columns on create", async () => {
    const row = await db.miniLesson.create({
      data: {
        slug: uniq("derived-create"),
        title: "t",
        contentBlocks: blocks,
        createdById: await anyUserId(),
      },
      select: { id: true, readingMinutes: true, questionCount: true, diagramSrc: true },
    });
    try {
      expect(row).toMatchObject(deriveLessonMeta(blocks));
      // Guard against the derive silently degrading to placeholder values.
      expect(row.questionCount).toBe(3);
      expect(row.diagramSrc).toBe("/guide-diagrams/derived-test.svg");
      expect(row.readingMinutes).toBe(3);
    } finally {
      await db.miniLesson.delete({ where: { id: row.id } });
    }
  });

  it("recomputes derived columns when contentBlocks changes on update", async () => {
    const created = await db.miniLesson.create({
      data: {
        slug: uniq("derived-update"),
        title: "t",
        contentBlocks: [],
        createdById: await anyUserId(),
      },
      select: { id: true, questionCount: true },
    });
    try {
      expect(created.questionCount).toBe(0);
      const row = await db.miniLesson.update({
        where: { id: created.id },
        data: { contentBlocks: blocks },
        select: { readingMinutes: true, questionCount: true, diagramSrc: true },
      });
      expect(row).toMatchObject(deriveLessonMeta(blocks));
      expect(row.questionCount).toBe(3);
    } finally {
      await db.miniLesson.delete({ where: { id: created.id } });
    }
  });

  it("leaves derived columns alone on an update that does not touch contentBlocks", async () => {
    const created = await db.miniLesson.create({
      data: {
        slug: uniq("derived-untouched"),
        title: "t",
        contentBlocks: blocks,
        createdById: await anyUserId(),
      },
      select: { id: true, readingMinutes: true, questionCount: true, diagramSrc: true },
    });
    try {
      const row = await db.miniLesson.update({
        where: { id: created.id },
        data: { title: "renamed" },
        select: { readingMinutes: true, questionCount: true, diagramSrc: true },
      });
      // A title-only edit must not reset them to the placeholder defaults.
      expect(row).toEqual({
        readingMinutes: created.readingMinutes,
        questionCount: created.questionCount,
        diagramSrc: created.diagramSrc,
      });
    } finally {
      await db.miniLesson.delete({ where: { id: created.id } });
    }
  });

  it("populates derived columns through BOTH branches of upsert", async () => {
    const slug = uniq("derived-upsert");
    const createdById = await anyUserId();
    // create branch
    const made = await db.miniLesson.upsert({
      where: { slug },
      create: { slug, title: "t", contentBlocks: blocks, createdById },
      update: { contentBlocks: blocks },
      select: { id: true, questionCount: true, diagramSrc: true },
    });
    try {
      expect(made.questionCount).toBe(3);
      // update branch -- the seed scripts' actual code path
      const updated = await db.miniLesson.upsert({
        where: { slug },
        create: { slug, title: "t", contentBlocks: [], createdById },
        update: { contentBlocks: [blocks[0]] },
        select: { questionCount: true, diagramSrc: true },
      });
      expect(updated.questionCount).toBe(0);
      expect(updated.diagramSrc).toBeNull();
    } finally {
      await db.miniLesson.delete({ where: { slug } });
    }
  });
});
