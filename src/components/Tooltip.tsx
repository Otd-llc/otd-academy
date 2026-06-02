"use client";

// Reusable hover/focus tooltip primitive (design §6).
//
// Wraps Radix `@radix-ui/react-tooltip` so the app gets the WAI-ARIA tooltip
// pattern for free: shows on hover AND keyboard focus, dismisses on Esc, and
// Radix attaches `role="tooltip"` + `aria-describedby` wiring on the trigger.
// Content is intentionally NON-interactive (per the ARIA tooltip pattern — use
// `GlossaryTerm`'s popover for click-to-read/interactive content instead).
//
// This renders ONLY a `<Root>` — the single app-wide `<Provider>` lives in
// `TooltipProvider` (mounted once in the root layout). Mounting a provider per
// instance churned React `useId` and tripped a hydration mismatch on multi-chip
// surfaces like StageTracker; one hoisted provider fixes that. The hover open
// delay is therefore set on the shared provider, not here.
//
// Styling uses existing tokens but a SOLID surface (not the translucent
// `.glass-card`): a `bg-deep-space` bubble with a gold hairline, a near-white
// `text-gray-1` non-italic body, and an optional small `font-mono` gold label.
// Tooltips must be opaque + high-contrast (underlying content must not bleed
// through, and the body must read at 12px). `z-50` floats it ABOVE the app's
// `sticky top-0 z-20` header (Radix portals to `document.body`).
//
// Usage:
//   <Tooltip content="Save">{<button>…</button>}</Tooltip>
//   <Tooltip label="GATE" content={<>…richer hint…</>}>{trigger}</Tooltip>
//
// The trigger child must be able to receive a ref + the hover/focus handlers
// Radix forwards. Plain interactive elements (button, a, label) work directly.
// For a DISABLED button, wrap it in a span (disabled elements fire no
// pointer/focus events themselves). Note the `asChild` Trigger does NOT inject
// tabIndex onto that wrapper, so the wrapper must set `tabIndex={0}` itself (+ a
// focus ring) to stay keyboard-reachable — see `MarkBringupCompleteButton` /
// `SaveButton` for that pattern.

import * as RadixTooltip from "@radix-ui/react-tooltip";

export interface TooltipProps {
  /** The hint shown in the floating bubble. Brief, non-interactive. */
  content: React.ReactNode;
  /** The trigger element (button / link / span). Must accept a ref. */
  children: React.ReactNode;
  /** Optional small mono label rendered above the body (e.g. "GATE"). */
  label?: React.ReactNode;
  /** Preferred side of the trigger to render on. Defaults to "top". */
  side?: RadixTooltip.TooltipContentProps["side"];
  /**
   * Optional portal container — forward the open `<dialog>` element for
   * in-dialog triggers so the bubble renders inside the top layer (design §6
   * in-dialog note), rather than behind the modal backdrop.
   */
  container?: Element | DocumentFragment | null;
}

export function Tooltip({
  content,
  children,
  label,
  side = "top",
  container,
}: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal container={container ?? undefined}>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          // Opaque, high-contrast bubble: a tooltip must not let underlying
          // content bleed through, and the body must read at small sizes — so
          // a SOLID deep-space surface (not the translucent .glass-card) with a
          // gold hairline + near-white non-italic body. The arrow matches the
          // solid surface so it reads as part of the bubble.
          className="z-50 max-w-xs rounded-lg border border-[rgba(200,150,62,0.45)] bg-deep-space px-3 py-2 text-xs leading-relaxed shadow-xl"
        >
          {label ? (
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
              {label}
            </p>
          ) : null}
          <p className="text-gray-1">{content}</p>
          <RadixTooltip.Arrow className="fill-deep-space" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
