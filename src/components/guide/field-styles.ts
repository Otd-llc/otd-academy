// Shared bench-flat field styling for the inline guide-card editor
// (GuideCardEditor / BlockEditor / TableBlockEditor). Extracted so the three
// editors render with ONE consistent look — in particular a single vertical
// padding (`py-1`) on every text control, removing the height drift that was
// visible when the header inputs (`py-2`) and block inputs (`py-1`) rendered
// together.
//
// NOTE: `inputClass`/`textareaClass`/`selectClass` deliberately do NOT include
// `mt-1` or `w-full` — call sites compose those (some inputs are inline, some
// full-width) so the shared string stays purely about the field's own box.

export const inputClass =
  "rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
export const textareaClass =
  "rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
export const selectClass =
  "rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
export const labelClass =
  "block font-mono text-xs uppercase tracking-wider text-muted";
export const helpClass = "mt-1 font-mono text-xs text-muted";
