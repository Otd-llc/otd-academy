"use server";

// useActionState-compatible form-action wrapper for createBoard and a
// single-field wrapper for editBoard (used by the Board detail page's
// inline-edit forms — design §9.3).
//
// Lives separately from boards.ts so the redirect-throw from createBoard
// isn't caught by the editBoard wrapper's generic ZodError catch block.

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import type { BoardStatus } from "@prisma/client";
import { createBoard, editBoard } from "@/lib/actions/boards";

export type CreateBoardFormState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

function pickRawString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  return v.trim();
}

export async function createBoardFormAction(
  _prev: CreateBoardFormState,
  formData: FormData,
): Promise<CreateBoardFormState> {
  const buildId = pickString(formData, "buildId");
  const serial = pickString(formData, "serial");
  // silkscreenHash is optional — empty string means "skip", not "clear", at
  // creation time. The Zod schema treats undefined as "no value".
  const silkscreenHash = pickString(formData, "silkscreenHash");

  let target: string;
  try {
    const board = await createBoard({ buildId, serial, silkscreenHash });
    const ctx = await db.board.findUniqueOrThrow({
      where: { id: board.id },
      select: {
        serial: true,
        build: {
          select: {
            label: true,
            revision: {
              select: {
                label: true,
                project: { select: { slug: true } },
              },
            },
          },
        },
      },
    });
    target =
      `/projects/${ctx.build.revision.project.slug}` +
      `/${encodeURIComponent(ctx.build.revision.label)}` +
      `/builds/${encodeURIComponent(ctx.build.label)}` +
      `/boards/${encodeURIComponent(ctx.serial)}`;
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

  redirect(target);
}

// ─── Single-field inline-edit wrappers (design §9.3) ───────────────────

export type EditBoardFormState = {
  errors?: Record<string, string[]>;
  message?: string;
};

async function editBoardSingleField(
  fieldName: "silkscreenHash" | "status" | "notes",
  formData: FormData,
): Promise<EditBoardFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { message: "Missing board id" };
  }
  const raw = pickRawString(formData, fieldName);
  const value = raw === null ? "" : raw;
  try {
    if (fieldName === "status") {
      // Status must be a known BoardStatus enum value. Zod will reject
      // anything else.
      await editBoard({ id, status: value as BoardStatus });
    } else if (fieldName === "silkscreenHash") {
      await editBoard({ id, silkscreenHash: value });
    } else {
      await editBoard({ id, notes: value });
    }
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

export async function editBoardSilkscreenHashAction(
  _prev: EditBoardFormState,
  formData: FormData,
): Promise<EditBoardFormState> {
  return editBoardSingleField("silkscreenHash", formData);
}

export async function editBoardStatusAction(
  _prev: EditBoardFormState,
  formData: FormData,
): Promise<EditBoardFormState> {
  return editBoardSingleField("status", formData);
}

export async function editBoardNotesAction(
  _prev: EditBoardFormState,
  formData: FormData,
): Promise<EditBoardFormState> {
  return editBoardSingleField("notes", formData);
}
