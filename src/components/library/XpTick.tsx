"use client";

// The +XP tick (design §9.3): a gold Saira number that rises in on a correct
// award and settles as the earned marker. Reduced-motion → a static show (the
// `.xp-tick` keyframe is disabled under prefers-reduced-motion in globals.css).
// Wrapped in an aria-live region so it isn't sight-only. NO audio by design.
export function XpTick({ amount }: { amount: number }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="xp-tick font-numeral text-sm font-bold tabular-nums text-command-gold"
    >
      +{amount} XP
    </span>
  );
}
