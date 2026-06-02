// Inline SVG icon set — bench/shop-floor checklist controls (and reusable
// elsewhere).
//
// Hand-inlined SVGs (no icon library) so they ship in the bundle without an
// asset fetch and tint via `currentColor` — same approach as BrandMark. Each
// icon is a stroke-based 24×24 glyph drawn with `stroke="currentColor"`; the
// caller controls size + color through Tailwind classes on the returned
// `<svg>` (e.g. `text-alert-red h-5 w-5`). They are decorative (`aria-hidden`)
// because their accessible name lives on the wrapping `<button aria-label>` +
// `<Tooltip>` — see ChecklistEditor's IconButton.

type IconProps = { className?: string };

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Trashcan — destructive delete. */
export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** Pencil — inline edit. */
export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/** Chevron up — reorder toward the top. */
export function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="6 15 12 9 18 15" />
    </svg>
  );
}

/** Chevron down — reorder toward the bottom. */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Slashed circle — "not applicable" glyph. */
export function NotApplicableIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

/** Checkmark — the checked state glyph inside the big toggle. */
export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

/** X / close — used for the cancel arm of edit + the cancel-confirm of delete. */
export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Plus — add-item affordance. */
export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
