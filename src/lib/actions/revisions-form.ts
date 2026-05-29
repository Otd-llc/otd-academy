"use server";

// useActionState-compatible form-action wrappers for createRevision.
// Kept in a separate file from revisions.ts so the redirect-throw path
// (which Next.js implements as an Error) doesn't get swallowed by the
// generic catch block in the inline-edit wrappers there.
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createRevision } from "@/lib/actions/revisions";

export type CreateRevisionFormState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createRevisionFormAction(
  _prev: CreateRevisionFormState,
  formData: FormData,
): Promise<CreateRevisionFormState> {
  const projectId = pickString(formData, "projectId");
  const label = pickString(formData, "label");
  const copyForwardFromRevisionId = pickString(
    formData,
    "copyForwardFromRevisionId",
  );

  let newSlugPath: string;
  try {
    const rev = await createRevision({
      projectId,
      label,
      copyForwardFromRevisionId,
    });
    const project = await db.project.findUniqueOrThrow({
      where: { id: rev.projectId },
      select: { slug: true },
    });
    newSlugPath = `/projects/${project.slug}/${encodeURIComponent(rev.label)}`;
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

  // Outside the try so Next.js's redirect-throw isn't caught.
  redirect(newSlugPath);
}
