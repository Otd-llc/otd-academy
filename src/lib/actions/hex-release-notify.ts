"use server";

// "Tell me when the next hex release lands."
//
// "use server" rule: this module exports ONLY async functions. Types live
// elsewhere — an `export type` here survives tsc and throws at runtime.
//
// NO AUTH, deliberately, and offered only AFTER a download has started. The
// files are CC BY and the `Source:` URL inside every published LICENSE.txt
// points at /hex, so a large share of arrivals are following an attribution
// link from someone else's remix. A form in front of the download would be
// hostile to the licence's own purpose, and gating a set that is already one
// public URL away would be theatre.
//
// Modelled on `joinPassWaitlist`, which solves the same problem: anonymous
// capture, unique on email, userId stamped when a session happens to exist, and
// an upsert so a repeat submit is a no-op rather than a duplicate or a throw.
import { z } from "zod";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { capture } from "@/lib/analytics";
import { clientIp, ipCheckFor } from "@/lib/abuse-policy";
import { enforce } from "@/lib/abuse-limit";
import { defenseEnabled } from "@/lib/abuse-defense-flag";

const schema = z.object({
  email: z.email(),
  // Which release they were taking when they asked, so a future send can tell a
  // first-timer from someone already on their third. Bounded to the same
  // grammar the download proxy uses; anything else is dropped rather than
  // stored, because this string is written to a row from an anonymous caller.
  release: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function notifyOnHexRelease(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That does not look like an email address." };
  }
  const { email, release } = parsed.data;

  // Same fail-open per-IP guard, and the same shared bucket, as the two other
  // anonymous public writes: this is the identical abuse class (arbitrary-email
  // insert plus a telemetry-pollution loop).
  if (await defenseEnabled()) {
    const check = ipCheckFor("waitlist:ip:hour", clientIp(await headers()));
    if (check && !(await enforce([check], "open")).ok) {
      return {
        ok: false,
        error: "Too many requests. Please try again in a little while.",
      };
    }
  }

  // Best-effort: anonymous is the expected case here, not an edge case.
  let userId: string | null = null;
  const session = await auth();
  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const prior = await db.hexReleaseNotify.findUnique({
    where: { email },
    select: { id: true },
  });

  await db.hexReleaseNotify.upsert({
    where: { email },
    // A repeat submit does NOT reset `release`: the first one is the honest
    // answer to "which release brought them in", and overwriting it would lose
    // that the moment they came back for the next one.
    update: userId ? { userId } : {},
    create: { email, userId, release },
  });

  if (!prior) {
    try {
      // No raw email in the props. The row holds it; analytics does not need to.
      capture(
        "email_captured",
        { source: "hex_release_notify", release },
        userId ?? undefined,
      );
    } catch {
      // Telemetry must never break the thing it is measuring.
    }
  }

  return { ok: true };
}
