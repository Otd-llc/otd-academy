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
import { categoryAncestry } from "@/lib/categories";

// `Part.category` is now a `PartCategory` enum (migration parts_knowledge_stage_a).
// The create form still posts free text (the constrained <select> lands in
// Task 5); narrow any non-canonical value to NULL at the write boundary,
// mirroring the migration's `USING (CASE … ELSE NULL)` cast.
function toPartCategory(value: string | null | undefined): PartCategory | null {
  if (value && Object.prototype.hasOwnProperty.call(PartCategory, value))
    return value as PartCategory;
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

  // Resolve the category. A picker-supplied `categoryId` wins: look it up
  // (validating it exists) and dual-write the legacy enum when its leaf slug is
  // an enum token, so old enum readers stay consistent during the transition;
  // a non-enum-token leaf leaves `category` NULL. With no categoryId, fall back
  // to the directly-supplied enum (seed scripts / back-compat / tests).
  let categoryId: string | null = null;
  let category = toPartCategory(data.category);
  if (data.categoryId) {
    const cat = await db.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true, slug: true },
    });
    if (!cat) throw new Error("Unknown category.");
    categoryId = cat.id;
    category = toPartCategory(cat.slug);
  }

  // Validate the picker-supplied KiCad lib-ids exist in the index before linking.
  if (data.kicadSymbol) {
    const s = await db.kicadLibSymbol.findUnique({
      where: { libId: data.kicadSymbol },
      select: { libId: true },
    });
    if (!s) throw new Error("Unknown KiCad symbol.");
  }
  if (data.kicadFootprint) {
    const f = await db.kicadLibFootprint.findUnique({
      where: { libId: data.kicadFootprint },
      select: { libId: true },
    });
    if (!f) throw new Error("Unknown KiCad footprint.");
  }

  try {
    const part = await db.part.create({
      data: {
        mpn: data.mpn,
        manufacturer: data.manufacturer,
        description: data.description,
        category,
        categoryId,
        footprint: data.footprint ?? null,
        kicadSymbol: data.kicadSymbol ?? null,
        kicadFootprint: data.kicadFootprint ?? null,
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

// Update (or clear) a part's canonical datasheet URL from the detail page.
//
// `datasheetUrl` is the R2-off provenance fallback — it's rendered as an
// `<a href>`, so an empty value clears it to NULL while a non-empty value MUST
// be an http(s) URL. This is a security check, not cosmetics: rejecting
// `javascript:` / `data:` / relative / "see page 4" prevents a stored
// dangerous-href from ever reaching the anchor.
export async function updatePartDatasheetUrl(input: {
  partId: string;
  datasheetUrl: string;
}) {
  await requireUser();

  const trimmed = input.datasheetUrl.trim();
  const next = trimmed === "" ? null : trimmed;

  if (next !== null && !/^https?:\/\//i.test(next)) {
    throw new Error("Datasheet URL must start with http:// or https://");
  }

  await db.part.update({
    where: { id: input.partId },
    data: { datasheetUrl: next },
  });

  revalidatePath(`/parts/${input.partId}`);
  revalidatePath("/parts");
  return { ok: true as const, datasheetUrl: next };
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

// List the SELECTABLE categories for the create-form picker — LEAF nodes only.
// A part belongs to a specific leaf type; an interior node has no enum-token
// slug, so categorizing there would skip the per-category required-parametrics
// and leave the legacy enum NULL. Each leaf carries a breadcrumb `label` of
// NAMES ("Passives › Capacitors › MLCC Capacitors") and its `path`, ordered by
// path. Read-only; called from the CategoryCombobox client island on mount.
export async function listCategoriesForPicker(): Promise<
  { id: string; label: string; path: string }[]
> {
  const cats = await db.category.findMany({
    orderBy: { path: "asc" },
    select: { id: true, name: true, path: true, parentId: true },
  });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const parentIds = new Set(
    cats.map((c) => c.parentId).filter((p): p is string => p !== null),
  );
  return cats
    .filter((c) => !parentIds.has(c.id)) // leaves: never referenced as a parent
    .map((c) => ({
      id: c.id,
      label: categoryAncestry(c, byId)
        .map((n) => n.name)
        .join(" › "),
      path: c.path,
    }));
}

// A category's KiCad defaults, for the create-form auto-suggest (Phase C): on
// category select, prefill the symbol picker and constrain the footprint picker.
export async function getCategoryDefaults(
  categoryId: string,
): Promise<{ defaultKicadSymbol: string | null; defaultKicadFootprintLib: string | null } | null> {
  if (!categoryId) return null;
  return db.category.findUnique({
    where: { id: categoryId },
    select: { defaultKicadSymbol: true, defaultKicadFootprintLib: true },
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
    categoryId: pickString(formData, "categoryId"),
    footprint: pickString(formData, "footprint"),
    kicadSymbol: pickString(formData, "kicadSymbol"),
    kicadFootprint: pickString(formData, "kicadFootprint"),
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
