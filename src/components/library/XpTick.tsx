"use client";

// The +XP tick (design §9.3): on a correct-answer award, a gold Saira "+N XP"
// pops in, rises, and fades (the floating layer) while a quiet persistent marker
// keeps the earned amount on the row. Wrapped in an aria-live region so it isn't
// sight-only; NO audio by design. Reduced-motion hides the float (globals.css) and
// leaves the persistent marker, so the value is never lost.
export function XpTick({ amount }: { amount: number }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="relative inline-flex items-baseline leading-none"
    >
      {/* Persistent earned marker (stays after the pop settles). */}
      <span
        aria-hidden
        className="font-numeral text-sm font-bold tabular-nums text-command-gold/80"
      >
        +{amount} XP
      </span>
      {/* Floating pop: rises and fades once, does not affect layout. */}
      <span
        aria-hidden
        className="xp-pop pointer-events-none absolute left-0 top-0 whitespace-nowrap font-numeral text-base font-bold tabular-nums text-command-gold"
      >
        +{amount} XP
      </span>
    </span>
  );
}
