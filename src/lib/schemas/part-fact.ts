// Zod 4 schemas for the per-group `PartFact.data` JSON (design §3.3).
//
// One schema per `PartFactGroup`. Every leaf element (pin / curve / entry /
// bypass row) may carry an optional element-level provenance anchor
// `{ sourcePage?, sourceNote? }`; the row-level `PartFact` anchor is the
// fallback and is enforced elsewhere (the verify gate, Task 4).
//
// DRY with guide.ts: the `PartCategory` literal set is the Prisma enum object
// itself, fed to `z.enum(...)` — the same pattern guide.ts uses for
// `ChecklistSubkind` — so the required-keys dispatch stays in lockstep with
// `prisma/schema.prisma` with no hand-maintained array. NOTES reuses
// `guideContentBlocksSchema` verbatim rather than redefining the block union.
import { z } from "zod";
import { PartCategory, type PartFactGroup } from "@prisma/client";

import { guideContentBlocksSchema } from "./guide";

// ─── Element-level provenance anchor ──────────────────────────────────────
// Spread into every leaf object. `sourcePage` is a 1-based datasheet page;
// `sourceNote` is descriptive (and, per the gate, is NOT a demote trigger).
const anchor = {
  sourcePage: z.number().int().positive().optional(),
  sourceNote: z.string().trim().optional(),
};

// A label/value pair (with optional unit) shared by PARAMETRICS and MECHANICAL.
export const parametricEntry = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  unit: z.string().trim().optional(),
  ...anchor,
});
export type ParametricEntry = z.infer<typeof parametricEntry>;

// ─── PARAMETRICS ──────────────────────────────────────────────────────────
export const parametricsSchema = z.object({
  entries: z.array(parametricEntry),
});
export type Parametrics = z.infer<typeof parametricsSchema>;

// Per-category required parametric labels (case-insensitive match against
// `entries[].label`). Additive — pilot categories only; categories absent
// here (or `null`) impose no constraint.
const CATEGORY_REQUIRED: Partial<Record<PartCategory, readonly string[]>> = {
  [PartCategory.MLCC_CAPACITOR]: ["capacitance", "voltage", "dielectric"],
  [PartCategory.LDO_REGULATOR]: ["vout", "iout", "dropout"],
};

/**
 * The PARAMETRICS schema for a given category, with the per-category
 * required-label refinement applied. A missing required label (case-insensitive)
 * adds one custom issue per missing key.
 */
export function parametricsFor(category: PartCategory | null) {
  const required = (category && CATEGORY_REQUIRED[category]) ?? [];
  return parametricsSchema.superRefine((v, ctx) => {
    if (required.length === 0) return;
    const labels = new Set(v.entries.map((e) => e.label.toLowerCase()));
    for (const key of required) {
      if (!labels.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `missing required parametric: ${key}`,
          path: ["entries"],
        });
      }
    }
  });
}

// ─── PINOUT ───────────────────────────────────────────────────────────────
export const PIN_TYPES = ["power", "io", "gnd", "nc", "strapping", "analog", "clock"] as const;

export const pinSchema = z.object({
  number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  // A pin's function may be a single string or a list (multi-function pins).
  function: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  type: z.enum(PIN_TYPES).optional(),
  ...anchor,
});
export type Pin = z.infer<typeof pinSchema>;

export const pinoutSchema = z.object({
  pins: z.array(pinSchema).min(1),
});
export type Pinout = z.infer<typeof pinoutSchema>;

// ─── DERATING ─────────────────────────────────────────────────────────────
export const CURVE_KINDS = ["dc-bias", "temperature", "frequency", "ac-level"] as const;
export const CURVE_Y_KINDS = ["pct-delta-c", "effective-capacitance"] as const;

const conditionSchema = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  unit: z.string().trim().optional(),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const curveSchema = z
  .object({
    kind: z.enum(CURVE_KINDS),
    xUnit: z.string().trim().min(1),
    yUnit: z.string().trim().min(1),
    yKind: z.enum(CURVE_Y_KINDS),
    // At least one operating point (temperature / AC level / frequency) — a
    // curve is uninterpretable and uncitable without it (design §3.3, §5).
    conditions: z.array(conditionSchema).min(1),
    points: z.array(pointSchema).min(2),
    ...anchor,
  })
  .superRefine((c, ctx) => {
    // Strictly-increasing x so downstream interpolation is well-defined
    // (design §5: out-of-range queries clamp/abstain, never extrapolate).
    for (let i = 1; i < c.points.length; i++) {
      if (c.points[i].x <= c.points[i - 1].x) {
        ctx.addIssue({
          code: "custom",
          message: "points.x must be strictly increasing",
          path: ["points", i, "x"],
        });
      }
    }
  });
export type Curve = z.infer<typeof curveSchema>;

export const deratingSchema = z.object({
  curves: z.array(curveSchema).min(1),
});
export type Derating = z.infer<typeof deratingSchema>;

// ─── POWER ────────────────────────────────────────────────────────────────
const railSchema = z.object({
  name: z.string().trim().min(1),
  voltage: z.string().trim().min(1).optional(),
});

const bypassSchema = z.object({
  value: z.string().trim().min(1),
  qty: z.number().int().positive().optional(),
  placement: z.string().trim().min(1),
  ...anchor,
});

export const powerSchema = z.object({
  rails: z.array(railSchema).optional(),
  bypass: z.array(bypassSchema),
  notes: z.string().trim().optional(),
});
export type Power = z.infer<typeof powerSchema>;

// ─── MECHANICAL ───────────────────────────────────────────────────────────
export const mechanicalSchema = z.object({
  entries: z.array(parametricEntry),
  footprintRef: z.string().trim().optional(),
  mountingType: z.string().trim().optional(),
  shieldBonding: z.string().trim().optional(),
  keepOut: z.string().trim().optional(),
});
export type Mechanical = z.infer<typeof mechanicalSchema>;

// ─── NOTES ────────────────────────────────────────────────────────────────
// Reuse the guide content-block union verbatim — do NOT redefine block schemas.
export const notesSchema = z.object({
  blocks: guideContentBlocksSchema,
});
export type Notes = z.infer<typeof notesSchema>;

// ─── Dispatcher ───────────────────────────────────────────────────────────
/**
 * Returns the Zod schema for a fact group's `data`. PARAMETRICS folds in the
 * category required-keys; every other group ignores `category`.
 */
export function factDataSchema(group: PartFactGroup, category: PartCategory | null) {
  switch (group) {
    case "PARAMETRICS":
      return parametricsFor(category);
    case "PINOUT":
      return pinoutSchema;
    case "POWER":
      return powerSchema;
    case "DERATING":
      return deratingSchema;
    case "MECHANICAL":
      return mechanicalSchema;
    case "NOTES":
      return notesSchema;
    default: {
      // Exhaustiveness guard — a new PartFactGroup must be handled here.
      const _exhaustive: never = group;
      throw new Error(`unhandled PartFactGroup: ${String(_exhaustive)}`);
    }
  }
}
