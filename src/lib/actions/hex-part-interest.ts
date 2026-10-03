"use server";

// Interest in the molded line, two signals (hex-v2 next plan 1.2.2 / 1.2.3).
//
// notifyOnHexPart: "tell me when one of these goes to the mold maker". One row
// per lowercase address, the chosen stems as an array. The stems are validated
// against the academy's concept allow-list BEFORE anything else: a stem the
// page does not show is a stranger's string. Same double opt-in as the other
// captures; the stems UNION only once the row is confirmed, otherwise a repeat
// submit REPLACES them, so nobody pads someone else's list through the form.
// Gate: the opener env AND a non-empty allow-list, read live.
//
// tapHexPartInterest: the counter under each design. The rate limiter runs
// CLOSED (one count per IP per stem per day): a tap it cannot vouch for, with
// no Redis, a degraded Redis or no client IP, is DROPPED and counted in
// degradedDrops, so the ranking says how many it did not count instead of
// hiding them inside the number it did. hexInterestEnabled in the HEX_FLAGS
// store is FEATURE-OFF only: it stops the button, it never bypasses the limiter.
import { z } from "zod";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { capture } from "@/lib/analytics";
import { enforce } from "@/lib/abuse-limit";
import { clientIp, interestCheck, ipCheckFor } from "@/lib/abuse-policy";
import { defenseEnabled } from "@/lib/abuse-defense-flag";
import { HEX_CONCEPT_STEMS } from "@/lib/hex-concepts";
import { hexFlag } from "@/lib/hex-flags";
import {
  doubleOptInEnabled,
  sendWaitlistConfirmation,
} from "@/lib/waitlist-confirm";

const stemSchema = z.string().min(1).max(64);
const notifySchema = z.object({
  email: z.email(),
  stems: z.array(stemSchema).min(1).max(20),
});
const tapSchema = z.object({ stem: stemSchema });

/** Open means: the env opener is "1" AND there is at least one concept to want. */
export async function hexPartWaitlistOpen(): Promise<boolean> {
  return (
    process.env.HEX_PART_WAITLIST_OPEN === "1" && HEX_CONCEPT_STEMS.size > 0
  );
}

export type NotifyOnHexPartResult =
  | { ok: true; state: "confirm-sent" | "confirmed" | "pending" }
  | { ok: false; error: string };

export async function notifyOnHexPart(
  input: unknown,
): Promise<NotifyOnHexPartResult> {
  if (!(await hexPartWaitlistOpen())) {
    return { ok: false, error: "The molded-parts list is closed for now." };
  }
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the address and pick at least one design.",
    };
  }
  // The allow-list, before the address is even looked at.
  const stems = [...new Set(parsed.data.stems)].sort();
  if (stems.some((s) => !HEX_CONCEPT_STEMS.has(s))) {
    return { ok: false, error: "One of those designs is not on this page." };
  }
  const email = parsed.data.email.toLowerCase();

  if (await defenseEnabled()) {
    const check = ipCheckFor("waitlist:ip:hour", clientIp(await headers()));
    if (check && !(await enforce([check], "open")).ok) {
      return {
        ok: false,
        error: "Too many requests. Please try again in a little while.",
      };
    }
  }

  // Stamp the userId only when the address is the signed-in visitor's own
  // (pass-waitlist.ts carries the reasoning).
  let userId: string | null = null;
  const session = await auth();
  const sessionEmailRaw = session?.user?.email ?? null;
  if (sessionEmailRaw && sessionEmailRaw.toLowerCase() === email) {
    const user = await db.user.findUnique({
      where: { email: sessionEmailRaw },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const prior = await db.hexPartWaitlist.findUnique({
    where: { email },
    select: { stems: true, confirmedAt: true },
  });
  if (!prior) {
    await db.hexPartWaitlist.create({
      data: {
        email,
        stems,
        userId,
        confirmedAt: doubleOptInEnabled() ? null : new Date(),
      },
    });
  } else {
    // UNION only after confirmation; before it, the latest submit stands alone.
    const next = prior.confirmedAt
      ? [...new Set([...prior.stems, ...stems])].sort()
      : stems;
    await db.hexPartWaitlist.update({
      where: { email },
      data: { stems: next, ...(userId ? { userId } : {}) },
    });
  }

  let state: "confirm-sent" | "confirmed" | "pending" = prior?.confirmedAt
    ? "confirmed"
    : "pending";
  try {
    const sent = await sendWaitlistConfirmation(
      db,
      { table: "HexPartWaitlist", email },
      {
        list: "the molded-parts list",
        promise: "when a design you chose goes to the mold maker",
      },
    );
    if (sent === "sent") state = "confirm-sent";
    if (sent === "already-confirmed" || sent === "disabled")
      state = "confirmed";
  } catch {
    // logged inside; the row stands and the next submit retries
  }

  if (!prior) {
    try {
      capture(
        "email_captured",
        { source: "hex_part_waitlist", stems: stems.length },
        userId ?? undefined,
      );
    } catch {
      // telemetry never fails the action
    }
  }
  return { ok: true, state };
}

export type TapHexPartInterestResult =
  | { ok: true }
  | { ok: false; reason: "off" | "unknown-stem" | "already" | "degraded" };

export async function tapHexPartInterest(
  input: unknown,
): Promise<TapHexPartInterestResult> {
  const parsed = tapSchema.safeParse(input);
  if (!parsed.success || !HEX_CONCEPT_STEMS.has(parsed.data.stem)) {
    return { ok: false, reason: "unknown-stem" };
  }
  const { stem } = parsed.data;
  if (!(await hexFlag("hexInterestEnabled")))
    return { ok: false, reason: "off" };

  const check = interestCheck(clientIp(await headers()), stem);
  const verdict = check
    ? await enforce([check], "closed")
    : { ok: false as const, rule: "degraded" as const };

  if (verdict.ok) {
    await db.hexPartInterest.upsert({
      where: { stem },
      create: { stem, ipDays: 1 },
      update: { ipDays: { increment: 1 } },
    });
    // Academy-only, consent-gated like every class (b) event; the stem is not
    // about a person. Never operational.
    capture("hex_part_interest", { stem });
    return { ok: true };
  }
  if (verdict.rule === "degraded") {
    await db.hexPartInterest.upsert({
      where: { stem },
      create: { stem, degradedDrops: 1 },
      update: { degradedDrops: { increment: 1 } },
    });
    return { ok: false, reason: "degraded" };
  }
  return { ok: false, reason: "already" };
}
