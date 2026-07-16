"use server";

// Library mini-lesson server actions (Task A9). The admin authoring door for a
// public, gate-less Library article.
//
// Mirrors `editGuideCard` in `guides.ts`:
//   - `requireAdmin()` FIRST on every mutation (the authoritative server gate;
//     middleware also bounces a non-admin off /admin/*).
//   - Parse the raw `input` with a STRICT `miniLessonInputSchema` so a
//     hand-crafted POST that injects an unknown key (e.g. `published` /
//     `accessTier` / `lastVerifiedAt`) is REJECTED with an `unrecognized_keys`
//     ZodError rather than silently mutating a locked field. Publish state is
//     owned exclusively by `publishMiniLesson` / `unpublishMiniLesson`, never
//     the content schema.
//   - `revalidatePath` the affected `/library/[slug]` + `/library` + the admin
//     list after a write.
//
// REPO RULE: a "use server" file exports ONLY async functions. The schema +
// types live in `src/lib/schemas/mini-lesson.ts` (a plain module), imported
// here — nothing schema-shaped is re-exported from this file.
//
// Josh removed the byline / last-verified concept from the live page, so publish
// just flips `published: true` — it does NOT auto-stamp `byline` or
// `lastVerifiedAt` (those remain author-controlled content fields).

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { ONE_HOUR } from "@/lib/cache-profile";
import { requireAdmin } from "@/lib/auth-helpers";
import { withTxRetry } from "@/lib/tx-retry";
import { miniLessonInputSchema } from "@/lib/schemas/mini-lesson";

// The network-reachable boundary: strict so unknown keys are rejected (publish
// state can never ride in on the content payload).
const strictMiniLessonInputSchema = miniLessonInputSchema.strict();

// Revalidate every surface a mini-lesson edit can touch.
//
// The TAGS are what matter under cacheComponents: the public read path
// (src/lib/library/load.ts) caches for an hour, so without these an edit would not
// appear for up to an hour. With them the hour is only a fallback and an edit is
// live on the next request. `mini-lessons` also refreshes the sitemap, which is
// tagged with it (src/app/sitemap.ts) — a new lesson missing from the sitemap for
// an hour is a real SEO cost.
//
// revalidateTag (background, stale-while-revalidate) not updateTag: the admin is
// redirected after a write, so no single request has to see the fresh value.
//
// Next 16 requires a profile as the second argument — it must match the window the
// read side was cached under, which is why both sides import ONE_HOUR rather than
// repeat the literal.
function revalidateLibrary(slug: string): void {
  revalidateTag("mini-lessons", ONE_HOUR);
  revalidateTag(`mini-lesson-${slug}`, ONE_HOUR);
  revalidatePath(`/library/${slug}`);
  revalidatePath("/library");
  revalidatePath("/admin/library");
}

// Resolve each `projectSlug` → Project.id and REPLACE the join rows
// (deleteMany + create), mirroring the seed script's idempotent link logic. An
// unknown slug throws (the author fixes the slug) rather than silently dropping
// the intended link.
async function replaceRelatedProjects(
  tx: Prisma.TransactionClient,
  miniLessonId: string,
  links: { projectSlug: string; role: "SUPPORTING" | "DOWN_FUNNEL"; ordinal: number }[],
): Promise<void> {
  await tx.projectMiniLesson.deleteMany({ where: { miniLessonId } });
  for (const link of links) {
    const project = await tx.project.findUnique({
      where: { slug: link.projectSlug },
      select: { id: true },
    });
    if (!project) {
      throw new Error(`No project found for slug "${link.projectSlug}".`);
    }
    await tx.projectMiniLesson.create({
      data: {
        miniLessonId,
        projectId: project.id,
        role: link.role,
        ordinal: link.ordinal,
      },
    });
  }
}

// ─── createMiniLesson ──────────────────────────────────
//
// Creates a DRAFT (published defaults false). The `slug @unique` constraint
// makes the slug one-per-lesson; we catch P2002 for a friendly duplicate error.
export async function createMiniLesson(input: unknown) {
  // Authorize before touching the input — fail closed on auth (don't even surface
  // a schema-shape ZodError to an unauthenticated caller).
  const user = await requireAdmin();
  const data = strictMiniLessonInputSchema.parse(input);

  const lesson = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        let created;
        try {
          created = await tx.miniLesson.create({
            data: {
              slug: data.slug,
              title: data.title,
              summary: data.summary ?? null,
              seoTitle: data.seoTitle ?? null,
              seoDescription: data.seoDescription ?? null,
              byline: data.byline ?? null,
              contentBlocks: data.contentBlocks as unknown as Prisma.InputJsonValue,
              createdById: user.id,
            },
            select: { id: true, slug: true },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            throw new Error(`A mini-lesson already exists with slug "${data.slug}".`);
          }
          throw e;
        }

        await replaceRelatedProjects(tx, created.id, data.relatedProjects ?? []);
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidateLibrary(lesson.slug);
  return lesson;
}

// ─── saveMiniLesson ────────────────────────────────────
//
// Edits an existing lesson's content + links by id. Does NOT touch `published`
// (publish state is owned by publishMiniLesson). Revalidates BOTH the new and
// the prior slug so a slug rename clears the old URL's cache too.
export async function saveMiniLesson(input: unknown) {
  // Authorize first — fail closed on auth before validating/handling input.
  await requireAdmin();
  const { id, ...rest } = (input ?? {}) as { id?: unknown };
  if (typeof id !== "string" || id === "") {
    throw new Error("saveMiniLesson requires a mini-lesson id.");
  }
  const data = strictMiniLessonInputSchema.parse(rest);

  const result = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.miniLesson.findUniqueOrThrow({
          where: { id },
          select: { slug: true },
        });

        let updated;
        try {
          updated = await tx.miniLesson.update({
            where: { id },
            data: {
              slug: data.slug,
              title: data.title,
              summary: data.summary ?? null,
              seoTitle: data.seoTitle ?? null,
              seoDescription: data.seoDescription ?? null,
              byline: data.byline ?? null,
              contentBlocks: data.contentBlocks as unknown as Prisma.InputJsonValue,
            },
            select: { id: true, slug: true },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            throw new Error(`A mini-lesson already exists with slug "${data.slug}".`);
          }
          throw e;
        }

        await replaceRelatedProjects(tx, updated.id, data.relatedProjects ?? []);
        return { updated, priorSlug: existing.slug };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidateLibrary(result.updated.slug);
  // A rename leaves the OLD slug's cache entry behind, holding the pre-rename
  // lesson. Drop its tag as well as its path, or the stale copy keeps serving on
  // the old URL until the entry expires.
  if (result.priorSlug !== result.updated.slug) {
    revalidateTag(`mini-lesson-${result.priorSlug}`, ONE_HOUR);
    revalidatePath(`/library/${result.priorSlug}`);
  }
  return result.updated;
}

// ─── publishMiniLesson / unpublishMiniLesson ───────────
//
// The ONLY door that flips `published`. Publish does NOT auto-stamp byline or
// lastVerifiedAt (Josh removed that concept from the live page).
export async function publishMiniLesson(id: unknown) {
  if (typeof id !== "string" || id === "") {
    throw new Error("publishMiniLesson requires a mini-lesson id.");
  }
  await requireAdmin();

  const lesson = await db.miniLesson.update({
    where: { id },
    data: { published: true },
    select: { slug: true },
  });

  revalidateLibrary(lesson.slug);
  return { published: true };
}

export async function unpublishMiniLesson(id: unknown) {
  if (typeof id !== "string" || id === "") {
    throw new Error("unpublishMiniLesson requires a mini-lesson id.");
  }
  await requireAdmin();

  const lesson = await db.miniLesson.update({
    where: { id },
    data: { published: false },
    select: { slug: true },
  });

  revalidateLibrary(lesson.slug);
  return { published: false };
}
