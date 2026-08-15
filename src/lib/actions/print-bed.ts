"use server";

// The signed-in user's print bed size, as set from the account "Printing" group.
//
// The value lives in two stores (see the design doc, "Bed size: one resolver, two
// stores"): this account column, and the configurator's localStorage. The account
// copy is the one that crosses devices, so it is the one that has to be right --
// a browser can always be told again, an account cannot.
//
// VALIDATED AGAINST THE ENDPOINT'S OWN NUMBERS. `normalizeBed` closes over
// BED_MIN/BED_MAX from `src/lib/hex-pack.ts`, the same constants `resolvePack`
// range-checks `?plate=WxH` with. A second copy of those bounds here would drift,
// and the symptom would be a bed the settings page saves and every download then
// refuses with a 400 that names no cause.
//
// This module exports ONLY async functions. The types and the validator live in
// the plain `@/lib/print-bed`, because a "use server" file's non-function exports
// become server references and crash when something reads them.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizeBed, type StoredBed } from "@/lib/print-bed";

/**
 * Store a print bed, or clear it.
 *
 * `null` CLEARS, and that is a first-class path rather than a convenience: null
 * means "no stored choice", which is what lets the configurator fall back to this
 * browser and then to the default. Without a way back to it, picking a size once
 * would be permanent across every device the account touches.
 *
 * An invalid bed THROWS rather than returning a result the caller might ignore.
 * The picker validates with the same function before it ever calls, so a throw
 * here means a hostile or broken caller, and the loud failure is the correct one:
 * silently clamping would write a number the user never chose, and silently
 * returning would report success for a value that was never stored.
 */
export async function setPrintBed(bed: StoredBed): Promise<{ bed: StoredBed }> {
  const user = await requireUser();

  // Explicit null check before validating: `normalizeBed(undefined, undefined)`
  // and a genuine clear both produce null, and conflating them would let a
  // malformed argument erase a stored bed instead of being refused.
  if (bed === null) {
    await db.user.update({
      where: { id: user.id },
      data: { printBedXMm: null, printBedYMm: null },
    });
    revalidatePath("/account");
    return { bed: null };
  }

  // Read the fields off an UNKNOWN, not off the declared type. The declared type
  // is a compile-time claim about a value that arrived over the wire.
  const raw = bed as { x?: unknown; y?: unknown } | null | undefined;
  const next = normalizeBed(raw?.x, raw?.y);
  if (!next) throw new Error("That is not a bed size we can lay out for.");

  await db.user.update({
    where: { id: user.id },
    data: { printBedXMm: next.x, printBedYMm: next.y },
  });
  revalidatePath("/account");
  return { bed: next };
}

/** The stored bed for the signed-in user, or null. Refuses when signed out for
 *  the same reason the setter does: this is account state, and an anonymous read
 *  has no account to read from. */
export async function getPrintBed(): Promise<{ bed: StoredBed }> {
  const user = await requireUser();
  const { printBedXMm: x, printBedYMm: y } = user;
  if (x == null || y == null) return { bed: null };
  // Normalised on the way OUT as well as in. A row predating this validator, or
  // written by a script, must not hand the packer a bed it would reject.
  return { bed: normalizeBed(x, y) };
}
