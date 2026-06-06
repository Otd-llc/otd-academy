"use client";

// Inline glossary term → click-to-read popover (design §6).
//
// Built on Radix `@radix-ui/react-popover`: the trigger is a real <button>, so
// Radix gives us `aria-expanded` / `aria-controls`, focus management, Esc, and
// click-outside dismissal for free (the disclosure/popover ARIA pattern — NOT
// tooltip semantics, which would be wrong for click-to-reveal + touch + screen
// readers).
//
// The term is resolved against the pure `lookupTerm` map. If the term is
// UNKNOWN, the component renders the term text plain (no button, no affordance)
// so an authoring typo degrades gracefully to inert prose.
//
// Styling reuses existing tokens: a dotted-underline affordance in
// `text-link-muted` (hover → `signal-blue`), and a `.glass-popover` (a denser,
// more-opaque glass than `.glass-card`, so body text doesn't bleed through this
// little floating pane) with a `font-mono` term header + serif body. Content is
// `z-50` to float above the
// `sticky top-0 z-20` header.
//
// `container` is forwarded to Radix's Portal + Content so in-dialog triggers
// (jargon inside CreatePartDialog / NewChecklistDialog native <dialog> modals)
// render inside the top layer instead of behind the backdrop (design §6).

import * as Popover from "@radix-ui/react-popover";
import { lookupTerm } from "@/lib/glossary";

export interface GlossaryTermProps {
  /** The jargon term to look up + display (e.g. "ADC1", "SAC305"). */
  term: string;
  /**
   * Optional override for the visible trigger text. Defaults to the looked-up
   * canonical term, falling back to the raw `term` prop.
   */
  children?: React.ReactNode;
  /**
   * Optional portal container — forward the open `<dialog>` element for
   * in-dialog use so the popover renders in the top layer (design §6).
   */
  container?: Element | DocumentFragment | null;
}

export function GlossaryTerm({ term, children, container }: GlossaryTermProps) {
  const entry = lookupTerm(term);

  // Unknown term → inert plain text (graceful degradation for authoring typos).
  if (!entry) {
    return <span>{children ?? term}</span>;
  }

  const label = children ?? entry.term;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="cursor-help rounded-sm font-medium text-link-muted underline decoration-dotted decoration-from-font underline-offset-2 transition-colors hover:text-signal-blue focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-blue"
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="glass-popover z-50 max-w-xs p-3 shadow-xl"
        >
          <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-command-gold">
            {entry.term}
          </p>
          <p className="font-serif text-sm leading-relaxed text-gray-1">
            {entry.def}
          </p>
          <Popover.Arrow className="fill-[rgba(200,150,62,0.35)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
