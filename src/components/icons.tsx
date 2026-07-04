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

/** Grip — drag handle (six dots). Fill-based, not stroke. */
export function GripIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
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

/** Curved arrow back — revert / undo (e.g. unverify a fact). */
export function UndoIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-5" />
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

/**
 * Two arrowed arcs forming a ring — "this is interactive, you can rotate it."
 * Used as the 3D-viewer affordance watermark.
 */
export function RotateIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
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

/** Box with an arrow leaving it — marks a link that opens off-site / in a new tab. */
export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/** Eye — the quick-glance / preview affordance (parts-list glance trigger). */
export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Photo — framed picture with sun + mountain (image / diagram block). */
export function PhotoIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

/** Video — framed play triangle (video block / placeholder). */
export function VideoIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Quiz — help/question circle (multiple-choice comprehension check). */
export function QuizIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// ── Social brand marks ──────────────────────────────────────────────────────
// Brand logos are FILLED glyphs (not the stroke-outline `baseProps` style), so
// each carries its own `fill="currentColor"` path and tints via the link color.
export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z" />
    </svg>
  );
}
export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}
