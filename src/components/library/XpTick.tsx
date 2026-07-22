"use client";

// The +XP tick (design §9.3): on a correct-answer award, a gold Saira "+N XP"
// floats up and fades (the .xp-pop layer) while a quiet persistent marker keeps
// the earned amount on the row. The float VARIANT is chosen at random per award
// for variety (owner call 2026-07-11) — every variant is a rise-and-fade so the
// persistent marker stays consistent. Wrapped in an aria-live region so it isn't
// sight-only; NO audio. Reduced-motion hides the float (globals.css); the marker
// still shows the award, so the value is never lost.
import { useState } from "react";

const VARIANTS = ["v1", "v2", "v3", "v4", "v5"] as const;

export function XpTick({ amount }: { amount: number }) {
  // Pick ONCE per mount (each award re-mounts via a key change upstream). Random
  // is safe here: the tick only ever renders client-side after an interaction,
  // never during SSR, so there is no hydration mismatch.
  const [variant] = useState(
    () => VARIANTS[Math.floor(Math.random() * VARIANTS.length)],
  );
  return (
    <span
      role="status"
      aria-live="polite"
      className="relative inline-flex items-baseline leading-none"
    >
      {/* Persistent earned marker (stays after the float fades). NOT
          aria-hidden: it is the live region's ONLY announceable content — with
          both children hidden the region announced nothing and the award was
          sight-only after all, exactly what the wrapper claims to prevent. */}
      <span className="font-numeral text-sm font-bold tabular-nums text-command-gold/80">
        +{amount} XP
      </span>
      {/* Floating pop: rises and fades once, does not affect layout. */}
      <span
        aria-hidden
        className={`xp-pop ${variant} pointer-events-none absolute left-0 top-0 whitespace-nowrap font-numeral text-base font-bold tabular-nums text-command-gold`}
      >
        +{amount} XP
      </span>
    </span>
  );
}
