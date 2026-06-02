"use client";

// Single app-wide Radix tooltip provider (hydration fix).
//
// Radix `@radix-ui/react-tooltip` expects ONE `<Provider>` near the root of the
// tree, with each `<Tooltip>` rendering only a `<Root>` beneath it. Previously
// `Tooltip.tsx` mounted a fresh `<Provider>` per instance, so the 9-chip
// StageTracker stamped 9 providers — each churning React `useId`, which
// produced a server/client id mismatch on hydration. Hoisting a single provider
// here (rendered once in the root layout) fixes that and also lets sibling
// tooltips share the `skipDelayDuration` window so moving between adjacent
// triggers feels instant.
//
// This is a thin `"use client"` island: the root layout is a server component,
// so it can't render Radix's client context directly. The provider only sets up
// context — `children` may freely be server-rendered content.

import * as RadixTooltip from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}
