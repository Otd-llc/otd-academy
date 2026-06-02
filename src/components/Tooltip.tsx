"use client";

// Reusable hover/focus tooltip primitive (design §6).
//
// Wraps Radix `@radix-ui/react-tooltip` so the app gets the WAI-ARIA tooltip
// pattern for free: shows on hover AND keyboard focus, dismisses on Esc, and
// Radix attaches `role="tooltip"` + `aria-describedby` wiring on the trigger.
// Content is intentionally NON-interactive (per the ARIA tooltip pattern — use
// `GlossaryTerm`'s popover for click-to-read/interactive content instead).
//
// Styling reuses existing design tokens: a `.glass-card` surface with a serif
// `.note-italic` body and an optional small `font-mono` label. The content is
// given `z-50` so it floats ABOVE the app's `sticky top-0 z-20` header
// (Radix portals to `document.body`).
//
// Usage:
//   <Tooltip content="Save">{<button>…</button>}</Tooltip>
//   <Tooltip label="GATE" content={<>…richer hint…</>}>{trigger}</Tooltip>
//
// The trigger child must be able to receive a ref + the hover/focus handlers
// Radix forwards. Plain interactive elements (button, a, label) work directly.
// For a DISABLED button, wrap it so the wrapper stays hoverable/focusable —
// see `MarkBringupCompleteButton` for that pattern (disabled elements fire no
// pointer/focus events themselves).

import * as RadixTooltip from "@radix-ui/react-tooltip";

export interface TooltipProps {
  /** The hint shown in the floating bubble. Brief, non-interactive. */
  content: React.ReactNode;
  /** The trigger element (button / link / span). Must accept a ref. */
  children: React.ReactNode;
  /** Optional small mono label rendered above the body (e.g. "GATE"). */
  label?: React.ReactNode;
  /** Hover open delay in ms. Defaults to 200. */
  delayDuration?: number;
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
  delayDuration = 200,
  side = "top",
  container,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal container={container ?? undefined}>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="glass-card z-50 max-w-xs px-3 py-2 text-xs leading-relaxed shadow-xl"
          >
            {label ? (
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gold-dim">
                {label}
              </p>
            ) : null}
            <p className="note-italic text-link-muted">{content}</p>
            <RadixTooltip.Arrow className="fill-[rgba(200,150,62,0.35)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
