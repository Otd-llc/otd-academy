"use server";

// Project CRUD server actions. Every entry point validates input via Zod
// (per design §3), resolves the calling User via `requireUser`, and
// revalidates the affected routes so server-rendered lists/detail pages
// pick up the change without a full reload.
//
// Phase 4 scope: create / edit / archive / unarchive. Revisions, Builds, etc.
// land in later phases.

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import {
  createProjectSchema,
  editProjectSchema,
} from "@/lib/schemas/project";
import { revalidatePath } from "next/cache";

export async function createProject(input: unknown) {
  const data = createProjectSchema.parse(input);
  const user = await requireUser();
  const project = await db.project.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      repoUrl: data.repoUrl ?? null,
      targetCost: data.targetCost ?? null,
      createdById: user.id,
    },
  });
  revalidatePath("/");
  return project;
}

export async function editProject(input: unknown) {
  const { id, ...rest } = editProjectSchema.parse(input);
  await requireUser();

  // Drop undefined fields so Prisma only updates what the caller supplied.
  // (Zod .partial() makes everything optional; we mustn't write `null` over
  // a field the user didn't touch.)
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }

  const updated = await db.project.update({ where: { id }, data });

  revalidatePath("/");
  // Use the post-update slug as the source of truth — covers both the
  // slug-unchanged case and a slug rename (both old and new path are valid
  // targets to invalidate; the old path won't 404 because the row still
  // exists under its new slug, but the cache entry is stale either way).
  revalidatePath(`/projects/${updated.slug}`);
  return updated;
}

export async function archiveProject(id: string) {
  await requireUser();
  await db.project.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/");
}

export async function unarchiveProject(id: string) {
  await requireUser();
  await db.project.update({
    where: { id },
    data: { archivedAt: null },
  });
  revalidatePath("/");
}
