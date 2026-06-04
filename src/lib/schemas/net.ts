// Zod 4 schemas for the `Net` / `NetNode` actions (design §2, §4).
//
// Nets are first-class revision connectivity data. This is a PLAIN module (NOT
// "use server"), so it MAY export types + pure helpers — the `"use server"`
// action module (`nets.ts`) re-uses these but exports only async functions.
//
// Net `name` must be a valid KiCad net name: KiCad treats parentheses, double
// quotes, and whitespace as S-expression structure, so a name carrying them
// would corrupt the emitted `.kicad_sch`/`.kicad_pro`. We trim then reject any
// name containing `(`, `)`, `"`, or whitespace. (Leading `+` as in `+3V3` is
// fine.) Net-class is the Prisma `NetClass` enum literal set. A node is a single
// physical designator + a pin identifier (the part's PINOUT pin number or name).
import { z } from "zod";
import { NetClass } from "@prisma/client";

// ─── Net name (KiCad-safe) ──────────────────────────────────────────────────
// Reject the S-expr structural characters (parens, double-quote) and any
// whitespace; a KiCad net label is a single bare token.
const KICAD_NET_NAME_FORBIDDEN = /[()"\s]/;

export const netNameSchema = z
  .string()
  .trim()
  .min(1, "Net name is required.")
  .refine((v) => !KICAD_NET_NAME_FORBIDDEN.test(v), {
    message:
      "Net name must not contain spaces, parentheses, or double quotes (KiCad net name).",
  });

// `NetClass` is the Prisma enum object itself, fed to `z.enum(...)` — the same
// pattern part-fact.ts uses for `PartCategory` — so this stays in lockstep with
// `prisma/schema.prisma` with no hand-maintained literal array.
export const netClassSchema = z.enum(NetClass);

// ─── Create / delete / node envelopes (strict) ──────────────────────────────
// `.strict()` rejects a typo'd key rather than silently dropping it (mirrors
// the part-facts envelope discipline).
export const createNetSchema = z
  .object({
    revisionId: z.string().min(1),
    name: netNameSchema,
    netClass: netClassSchema,
  })
  .strict();
export type CreateNetInput = z.infer<typeof createNetSchema>;

// A node identifier: a single designator + a pin. `refDes` is ONE physical
// designator ("U2", "C2") — never the comma-joined BomLine ref.
export const netNodeSchema = z
  .object({
    refDes: z.string().trim().min(1, "refDes is required."),
    pin: z.string().trim().min(1, "pin is required."),
  })
  .strict();
export type NetNodeInput = z.infer<typeof netNodeSchema>;

export const addNetNodeSchema = z
  .object({
    netId: z.string().min(1),
    refDes: z.string().trim().min(1, "refDes is required."),
    pin: z.string().trim().min(1, "pin is required."),
  })
  .strict();
export type AddNetNodeInput = z.infer<typeof addNetNodeSchema>;

// delete-net / remove-node / set-trust carry an id (+ optimistic-lock fence
// where the target is the mutable Net row).
export const idSchema = z.object({ id: z.string().min(1) }).strict();

// The optimistic-lock fence — the `updatedAt` the caller loaded (mirrors
// part-facts' `idWithLockSchema`).
export const idWithLockSchema = z
  .object({
    id: z.string().min(1),
    updatedAt: z.coerce.date(),
  })
  .strict();

export const deriveRailsSchema = z
  .object({ revisionId: z.string().min(1) })
  .strict();

// ─── Power-rail name mapping (pure; design §4 "Derive rails") ───────────────
// Map a PINOUT power pin's NAME to a proposed POWER net name. The first matching
// rule wins; an unmatched name falls back to the pin name itself (uppercased,
// trimmed) so every power pin lands on *some* proposed net for the human to
// resolve. Keep this pure + exported so deriveRails and its tests share it.
const POWER_NAME_RULES: ReadonlyArray<{ re: RegExp; net: string }> = [
  { re: /3v3|vdd|vcc/i, net: "+3V3" },
  { re: /vbus|5v|vin/i, net: "+5V" },
];

export function powerNetNameFor(pinName: string): string {
  const trimmed = pinName.trim();
  for (const rule of POWER_NAME_RULES) {
    if (rule.re.test(trimmed)) return rule.net;
  }
  // Fallback: the pin name itself as the net name (uppercased), with any KiCad
  // structural characters / whitespace collapsed to `_` so the result is always
  // a valid net name (it gets fed straight to `db.net.create`).
  const safe = trimmed.replace(/[()"\s]+/g, "_").toUpperCase();
  return safe.length > 0 ? safe : "POWER";
}
