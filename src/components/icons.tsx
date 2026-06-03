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

/** Chevron left — back / previous navigation. */
export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Chevron right — advance / next navigation. */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/** Floppy disk — save / commit an edit-in-place form. */
export function SaveIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/**
 * Rotating arc — in-flight / pending state. Pair with `animate-spin` on the
 * className. Decorative; the accessible name lives on the wrapping control.
 */
export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Archive box — stow a project out of the active list. */
export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

/** Archive box with an up-arrow — restore a project from the archive. */
export function ArchiveRestoreIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h4" />
      <path d="M19 8v3" />
      <polyline points="9 15 12 12 15 15" />
      <line x1="12" y1="12" x2="12" y2="20" />
    </svg>
  );
}

// ─── content block-type glyphs ──────────────────────────────────────────────
// Used to give each guide-card content block a legible type identity in the
// inline editor (block header + the Add-block menu). Drawn to read at h-4.

/** Document with text lines — the `prose` block. */
export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

/** Triangle with a bang — the `callout` block. */
export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Bulleted list — the `steps` block. */
export function ListIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

/** Grid — the `table` block. */
export function TableIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

/** Tag/label — the `termRef` (glossary term) block. */
export function TagIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

/** Chain link — the `sourceRef` (source link) block. */
export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
