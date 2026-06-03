"use server";

// Part server actions (design §4.3).
//
// Phase 5a scope: createPart (returned as JSON so callers like the
// CreatePartDialog can append it to the dropdown without a full
// round-trip) and listPartsBySearch (typeahead support).
//
// Duplicate `(manufacturer, mpn)` is caught two ways:
//   1. Schema-level pre-check via an existence query — surfaces a clean
//      field-level Zod-style message before we ever try the insert.
//   2. `Prisma.PrismaClientKnownRequestError` with code P2002 from the
//      DB-side @@unique constraint — defense in depth for the race where
//      two concurrent submissions slip past the pre-check.

import { Prisma, PartCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import {
  createPartSchema,
  listPartsBySearchSchema,
} from "@/lib/schemas/part";

// `Part.category` is now a `PartCategory` enum (migration parts_knowledge_stage_a).
// The create form still posts free text (the constrained <select> lands in
// Task 5); narrow any non-canonical value to NULL at the write boundary,
// mirroring the migration's `USING (CASE … ELSE NULL)` cast.
function toPartCategory(value: string | null | undefined): PartCategory | null {
  if (value && value in PartCategory) return value as PartCategory;
  return null;
}

export async function createPart(input: unknown) {
  const data = createPartSchema.parse(input);
  const user = await requireUser();

  // Pre-check: clean error before the insert. The DB constraint is still
  // the authority; the race is handled by the catch below.
  const existing = await db.part.findUnique({
    where: {
      manufacturer_mpn: {
        manufacturer: data.manufacturer,
        mpn: data.mpn,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `Part with (${data.manufacturer}, ${data.mpn}) already exists.`,
    );
  }

  try {
    const part = await db.part.create({
      data: {
        mpn: data.mpn,
        manufacturer: data.manufacturer,
        description: data.description,
        category: toPartCategory(data.category),
        footprint: data.footprint ?? null,
        datasheetUrl: data.datasheetUrl ?? null,
        lifecycle: data.lifecycle,
        ...(data.isCertifiedModule !== undefined
          ? { isCertifiedModule: data.isCertifiedModule }
          : {}),
        notes: data.notes ?? null,
        createdById: user.id,
      },
    });

    revalidatePath("/parts");
    return part;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        `Part with (${data.manufacturer}, ${data.mpn}) already exists.`,
      );
    }
    throw err;
  }
}

export async function listPartsBySearch(input: unknown) {
  const { q, take } = listPartsBySearchSchema.parse(input);
  return db.part.findMany({
    where: q
      ? {
          OR: [
            { mpn: { contains: q, mode: "insensitive" } },
            { manufacturer: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ manufacturer: "asc" }, { mpn: "asc" }],
    take,
    select: { id: true, mpn: true, manufacturer: true, description: true },
  });
}

// ─── Form action wrappers (useActionState-compatible) ──────────────────

export type PartFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  created?: { id: string; mpn: string; manufacturer: string };
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createPartFormAction(
  _prev: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
  const raw = {
    mpn: pickString(formData, "mpn"),
    manufacturer: pickString(formData, "manufacturer"),
    description: pickString(formData, "description"),
    category: pickString(formData, "category"),
    footprint: pickString(formData, "footprint"),
    datasheetUrl: pickString(formData, "datasheetUrl"),
    lifecycle: pickString(formData, "lifecycle") ?? "ACTIVE",
    isCertifiedModule: formData.get("isCertifiedModule") === "on",
    notes: pickString(formData, "notes"),
  };
  try {
    const part = await createPart(raw);
    return {
      created: {
        id: part.id,
        mpn: part.mpn,
        manufacturer: part.manufacturer,
      },
    };
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
