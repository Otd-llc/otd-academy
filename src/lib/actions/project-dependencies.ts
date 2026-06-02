"use server";

// ProjectDependency server actions (m12 §3.2).
//
// `createProjectDependency` is the load-bearing entry point. Per design:
//   1. Zod-validate input.
//   2. `requireUser()` — the action layer asserts a session and resolves the
//      acting User row for the audit field.
//   3. Open a Serializable transaction wrapped by `withTxRetry` so SSI
//      conflicts are auto-retried.
//   4. Take a Postgres advisory xact lock keyed on the *sorted* endpoint
//      pair. Sorting collapses A→B and B→A onto the same lock, so two
//      concurrent inserts forming a 2-cycle serialize against each other
//      regardless of who reaches the cycle CTE first.
//   5. Run a recursive CTE asking: would inserting (dep, dependsOn) form a
//      cycle? Equivalent to "does dependsOn already transitively depend on
//      dep?" — if yes, refuse.
//   6. Otherwise insert the row tagged with `createdById = user.id`.
//
// Regress side does NOT consult the DAG (lazy catch policy); see m12 §3.2.
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import {
  createProjectDependencySchema,
  editProjectDependencySchema,
} from "@/lib/schemas/project-dependency";
import { withTxRetry } from "@/lib/tx-retry";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

export async function createProjectDependency(input: unknown) {
  const data = createProjectDependencySchema.parse(input);
  const user = await requireUser();

  return withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        // Sorted pair → same advisory lock for A→B as for B→A. The lock
        // orders execution but does NOT advance the loser's snapshot, so the
        // CTE below still won't see the winner's edge on the first try.
        // Cycle safety actually comes from the full chain:
        //   1. advisory lock serializes the two transactions,
        //   2. SSI raises 40001 at commit when the loser's read/write set
        //      conflicts with the winner's,
        //   3. withTxRetry re-runs with a fresh snapshot, and
        //   4. the CTE now sees the winner's edge and rejects.
        const [low, high] = [
          data.dependentProjectId,
          data.dependsOnProjectId,
        ].sort();
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
          low,
          high,
        );

        // Cycle detection: if `dependsOnProjectId` already transitively
        // depends on `dependentProjectId`, then adding (dep, dependsOn) would
        // close the loop. The recursive CTE walks descendants of
        // `dependsOnProjectId` (i.e. things it depends on, and what they
        // depend on, etc.) and checks for `dependentProjectId` in the set.
        const cycle = await tx.$queryRawUnsafe<Array<{ exists: boolean }>>(
          `WITH RECURSIVE descendants AS (
            SELECT "dependsOnProjectId" AS pid FROM "ProjectDependency"
              WHERE "dependentProjectId" = $1
            UNION
            SELECT pd."dependsOnProjectId" FROM "ProjectDependency" pd
              INNER JOIN descendants d ON pd."dependentProjectId" = d.pid
          )
          SELECT EXISTS (SELECT 1 FROM descendants WHERE pid = $2) AS exists`,
          data.dependsOnProjectId,
          data.dependentProjectId,
        );
        if (cycle[0]?.exists) {
          throw new Error("Edge would create a cycle in the dependency graph.");
        }

        return tx.projectDependency.create({
          data: {
            dependentProjectId: data.dependentProjectId,
            dependsOnProjectId: data.dependsOnProjectId,
            kind: data.kind,
            dependentStageGated: data.dependentStageGated,
            dependsOnStageRequired: data.dependsOnStageRequired,
            notes: data.notes ?? null,
            createdById: user.id,
          },
        });
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

export async function editProjectDependency(input: unknown) {
  const { id, ...rest } = editProjectDependencySchema.parse(input);
  await requireUser();

  // Drop undefined fields so Prisma only updates what the caller supplied.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }

  return db.projectDependency.update({ where: { id }, data });
}

export async function deleteProjectDependency(id: string) {
  await requireUser();
  await db.projectDependency.delete({ where: { id } });
}

// ─── Form action wrappers (useActionState-compatible) ──────────────────
// React 19 / Next 16 form actions receive (prevState, formData) and return
// the next state. These adapt the typed actions above for `<form action>` —
// mirrors the m11 pattern in `src/lib/actions/projects.ts`.
//
// `revalidatePath` of `/projects/[slug]` is best-effort: the form sits on the
// dependent project's detail page, so we look up that slug from the row we
// just touched so a slug rename of the surrounding project (which we don't
// support here) wouldn't strand a stale cache entry. `/curriculum` is the
// other server-rendered consumer of edges, so we bust it unconditionally.

export type ProjectDependencyFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

async function revalidateEdgeRoutes(rowId: string): Promise<void> {
  // Look up the dependent project's slug so we revalidate the page the form
  // lives on. If the row was just deleted the caller passes the slug it
  // already knows (see deleteProjectDependencyAction); for edits we re-read
  // post-mutation so a future kind/stage swap reflects on reload.
  const row = await db.projectDependency.findUnique({
    where: { id: rowId },
    select: { dependentProject: { select: { slug: true } } },
  });
  if (row) revalidatePath(`/projects/${row.dependentProject.slug}`);
  revalidatePath("/curriculum");
}

export async function createProjectDependencyAction(
  _prev: ProjectDependencyFormState,
  formData: FormData,
): Promise<ProjectDependencyFormState> {
  // Empty-string → undefined so the Zod cuid check fires the right message
  // (rather than "Invalid cuid" with a literal empty value). `kind` falls
  // back to schema default (DE_RISK) when the select isn't touched.
  const raw = {
    dependentProjectId: pickString(formData, "dependentProjectId"),
    dependsOnProjectId: pickString(formData, "dependsOnProjectId"),
    kind: pickString(formData, "kind"),
    dependentStageGated: pickString(formData, "dependentStageGated"),
    dependsOnStageRequired: pickString(formData, "dependsOnStageRequired"),
    notes: pickString(formData, "notes"),
  };
  // `projectSlug` is a hidden form field carrying the dependent project's
  // slug — the action layer otherwise only sees ids, and we need a slug to
  // build the redirect target without an extra round-trip to the DB.
  const projectSlug = pickString(formData, "projectSlug");

  try {
    await createProjectDependency(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_root";
        (errors[key] ??= []).push(issue.message);
      }
      return { errors };
    }
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }

  // Outside the try so Next.js's redirect-throw isn't swallowed by the catch.
  if (projectSlug) revalidatePath(`/projects/${projectSlug}`);
  revalidatePath("/curriculum");
  if (projectSlug) redirect(`/projects/${projectSlug}`);
  return { ok: true };
}

export async function editProjectDependencyNotesAction(
  _prev: ProjectDependencyFormState,
  formData: FormData,
): Promise<ProjectDependencyFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { message: "Missing dependency id" };
  }
  // Empty string clears the notes (notes is nullable in the schema).
  const raw = pickString(formData, "notes");
  const notes = raw === undefined ? null : raw;

  try {
    await editProjectDependency({ id, notes });
    await revalidateEdgeRoutes(id);
    return {};
  } catch (err) {
    if (err instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_root";
        (errors[key] ??= []).push(issue.message);
      }
      return { errors };
    }
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteProjectDependencyAction(
  formData: FormData,
): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing dependency id");
  }
  // Capture the dependent slug BEFORE the delete — once the row is gone we
  // can't recover it for revalidation.
  const row = await db.projectDependency.findUnique({
    where: { id },
    select: { dependentProject: { select: { slug: true } } },
  });
  await deleteProjectDependency(id);
  if (row) revalidatePath(`/projects/${row.dependentProject.slug}`);
  revalidatePath("/curriculum");
}
