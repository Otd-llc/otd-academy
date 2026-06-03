"use client";

// Reusable controlled editor for an ordered array of guide `ContentBlock`s
// (extracted verbatim from GuideCardEditor — design §2/§4, Stage-A Task 6).
//
// CONTROLLED + STATELESS: it renders the block-array "shell" only — one
// per-type <BlockEditor> row per block (with reorder/delete chrome), an
// Add-block menu, and the per-block error display + a11y wiring — and calls
// `onChange` with the next array on every structural edit (reorder / delete /
// append) and every content edit. It holds NO server state, NO header fields,
// NO Save/Cancel, NO `cardId`, and dispatches NO actions: the parent owns the
// surrounding chrome and persistence (GuideCardEditor for guide cards; the
// part NOTES editor in Stage A).
//
// Per-block errors are keyed by ARRAY INDEX (`collectBlockErrors`), so the
// parent is responsible for clearing the stale `errors` map on every `onChange`
// (a now-valid block would otherwise keep a mis-targeted error until the next
// save). GuideCardEditor's `onChange` does exactly that — it both stores the
// next array and clears its error state — preserving the pre-extraction
// behavior byte-for-byte.

import { useEffect, useId, useRef, useState } from "react";
import type { ContentBlock } from "@/lib/schemas/guide";
import {
  BLOCK_TYPES,
  BLOCK_TYPE_ICON,
  BLOCK_TYPE_LABELS,
  defaultBlock,
  type BlockType,
} from "@/lib/guide-block-defaults";
import { BlockEditor } from "@/components/guide/BlockEditor";
import { collectBlockErrors } from "@/lib/guide-card-errors";
import { moveWithin } from "@/lib/guide-table";
import { labelClass } from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

export function BlockListEditor({
  blocks,
  onChange,
  errors,
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
  /**
   * Per-block field errors keyed by Zod issue path under `contentBlocks.`
   * (e.g. `contentBlocks.0.label`); `collectBlockErrors` pulls the messages
   * for each block index. The parent clears this on every `onChange` so a
   * now-valid block drops its red error + aria-invalid/aria-describedby.
   */
  errors?: Record<string, string[]>;
}) {
  const blockErrId = useId();

  // ─── block-array mutations (index swap / splice / append) ───────────────
  // Each mutation produces the next array and hands it to `onChange`; the
  // parent is responsible for clearing the index-keyed `errors` map (see the
  // file header). The reorder uses moveWithin (guide-table) — a bounds-checked
  // adjacent swap — and the no-op guard matches the pre-extraction behavior.
  function updateBlockAt(i: number) {
    return (next: ContentBlock) => {
      onChange(blocks.map((b, bi) => (bi === i ? next : b)));
    };
  }
  function moveBlock(i: number, dir: -1 | 1) {
    if (i + dir < 0 || i + dir >= blocks.length) return;
    onChange(moveWithin(blocks, i, dir));
  }
  function removeBlock(i: number) {
    onChange(blocks.filter((_, bi) => bi !== i));
  }
  function addBlock(type: BlockType) {
    onChange([...blocks, defaultBlock(type)]);
  }

  return (
    <fieldset className="space-y-3 border-t border-panel-border pt-4">
      <legend className={labelClass}>Content blocks</legend>
      {blocks.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          No blocks yet — add one below.
        </p>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, i) => {
            const blockErrors = collectBlockErrors(errors, i);
            const hasBlockError = blockErrors.length > 0;
            const blockErrListId = `${blockErrId}-block-${i}-error`;
            const TypeIcon = BLOCK_TYPE_ICON[block.type];
            return (
              <div
                key={i}
                className={`rounded-r border-l-2 bg-navy-dark/30 p-3 ${blockAccentClass(block)}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                    <TypeIcon className="h-4 w-4" />
                    {BLOCK_TYPE_LABELS[block.type]}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconButton
                      type="button"
                      hint="Move up"
                      ariaLabel={`Move block ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => moveBlock(i, -1)}
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      hint="Move down"
                      ariaLabel={`Move block ${i + 1} down`}
                      disabled={i === blocks.length - 1}
                      onClick={() => moveBlock(i, 1)}
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      tone="danger"
                      hint="Delete block"
                      ariaLabel={`Delete block ${i + 1}`}
                      onClick={() => removeBlock(i)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
                {/* role="group" so the per-block error list can be
                    associated with the whole block's editing region via
                    aria-describedby (the inputs live inside BlockEditor, and
                    the errors aggregate across its sub-fields). */}
                <div
                  role="group"
                  aria-invalid={hasBlockError || undefined}
                  aria-describedby={hasBlockError ? blockErrListId : undefined}
                >
                  <BlockEditor
                    block={block}
                    onChange={updateBlockAt(i)}
                    hasError={hasBlockError}
                    errorId={blockErrListId}
                  />
                </div>
                {hasBlockError ? (
                  <ul
                    id={blockErrListId}
                    className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs font-bold text-alert-red"
                  >
                    {blockErrors.map((msg, mi) => (
                      <li key={mi}>{msg}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <AddBlockMenu onAdd={addBlock} />
    </fieldset>
  );
}

// ─── add-block menu ─────────────────────────────────────────────────────────
// A Plus button that toggles a small popup list of block types; choosing one
// appends defaultBlock(type) and closes the popup. The popup is a plain list of
// buttons in natural tab order (NOT an ARIA `role="menu"` — see the trigger's
// aria-haspopup="true"): Tab/Shift+Tab move between items.
//
// Keyboard/dismissal contract:
//   • On open, focus moves to the first item (useEffect keyed on `open`).
//   • Escape closes the menu from anywhere inside the menu region (handler on
//     the container, so it fires whether focus is on the trigger or an item),
//     then returns focus to the trigger.
//   • Outside interaction (mousedown / focusin landing outside the container)
//     closes the menu — a document-level listener mounted only while open and
//     torn down on cleanup. No portal: the menu stays in the container subtree.
//   • Choosing a type appends the block, closes the menu, and returns focus to
//     the trigger so keyboard users aren't stranded.
function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Focus-on-open: move focus to the first menu item once the list mounts.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  // Outside-dismiss: while open, close when a mousedown or focus lands outside
  // the trigger+list container. Listener lives only for the open lifetime.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | FocusEvent) {
      const root = containerRef.current;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open]);

  // Return focus to the trigger button (inside the container) after close.
  function focusTrigger() {
    containerRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-label="Add block"]')
      ?.focus();
  }

  function choose(type: BlockType) {
    onAdd(type);
    setOpen(false);
    focusTrigger();
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          focusTrigger();
        }
      }}
    >
      {/* aria-haspopup="true" (not "menu"): the popup is a plain list of
          buttons in natural tab order, NOT an ARIA menu — there is no
          roving-tabindex / Arrow-key navigation, so promising `role="menu"`
          would mislead AT users. Tab/Shift+Tab moves between items; Escape and
          outside-interaction dismiss (handled on the container). */}
      <button
        type="button"
        aria-label="Add block"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
      >
        <PlusIcon className="h-4 w-4" />
        Add block
      </button>
      {open ? (
        <ul
          id={menuId}
          aria-label="Block types"
          className="absolute left-0 z-20 mt-1 min-w-44 rounded border border-panel-border bg-navy-dark p-1 shadow-xl"
        >
          {BLOCK_TYPES.map((type, i) => {
            const ItemIcon = BLOCK_TYPE_ICON[type];
            return (
              <li key={type}>
                <button
                  ref={i === 0 ? firstItemRef : undefined}
                  type="button"
                  onClick={() => choose(type)}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left font-mono text-sm text-link-muted transition-colors hover:bg-deep-space hover:text-command-gold focus-visible:bg-deep-space focus-visible:text-command-gold focus-visible:outline-none"
                >
                  <ItemIcon className="h-4 w-4" />
                  {BLOCK_TYPE_LABELS[type]}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// Left-accent rule color for a block card. Defaults to command-gold; callouts
// inherit their severity's hue (critical→alert-red, warn→gold, info→signal-blue)
// so the editor previews the block's emphasis at a glance.
function blockAccentClass(block: ContentBlock): string {
  if (block.type === "callout") {
    switch (block.severity) {
      case "critical":
        return "border-alert-red";
      case "info":
        return "border-signal-blue";
      case "warn":
      default:
        return "border-command-gold";
    }
  }
  return "border-command-gold";
}
