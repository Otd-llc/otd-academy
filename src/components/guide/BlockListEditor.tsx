"use client";

// Reusable controlled editor for an ordered array of guide `ContentBlock`s.
//
// CONTROLLED + STATELESS (re: persistence): it renders the block-array "shell"
// only — one per-type <BlockEditor> row per block (with reorder/insert/delete
// chrome), Add-block menus, and the per-block error display + a11y wiring — and
// calls `onChange` with the next array on every structural edit (reorder /
// insert / delete) and every content edit. It holds NO server state, NO header
// fields, NO Save/Cancel, and dispatches NO actions: the parent owns the
// surrounding chrome and persistence (GuideCardEditor).
//
// Reordering: drag a block by its grip handle (native HTML5 DnD) to drop it at a
// new position, OR use the up/down buttons (the keyboard/AT-friendly fallback —
// DnD is a pointer affordance, so the buttons stay for accessibility). Inserting:
// a reveal-on-hover "+ insert" zone sits before every block (and a full Add menu
// at the end), so a block can be added ANYWHERE, not just appended.
//
// Per-block errors are keyed by ARRAY INDEX (`collectBlockErrors`), so the parent
// clears the stale `errors` map on every `onChange` (a now-valid block would
// otherwise keep a mis-targeted error). GuideCardEditor's `onChange` does that.

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
import { labelClass } from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripIcon,
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
  errors?: Record<string, string[]>;
}) {
  const blockErrId = useId();

  // Drag-and-drop reorder state. `dragIndex` is the block being dragged (set on
  // the grip handle's dragstart); `overIndex` is the drop target under the
  // pointer (for the insertion-line cue). Both clear on drop/dragend.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // ─── block-array mutations ───────────────────────────────────────────────
  function updateBlockAt(i: number) {
    return (next: ContentBlock) => {
      onChange(blocks.map((b, bi) => (bi === i ? next : b)));
    };
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }
  function removeBlock(i: number) {
    onChange(blocks.filter((_, bi) => bi !== i));
  }
  // Insert a fresh default block at `at` (0…length). `at === length` appends.
  function insertBlock(type: BlockType, at: number) {
    const next = blocks.slice();
    next.splice(at, 0, defaultBlock(type));
    onChange(next);
  }
  // Move the dragged block so it lands BEFORE the block currently at `to`.
  function reorder(from: number, to: number) {
    if (from === to || to === from + 1) return; // no-op drops
    const next = blocks.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, moved!);
    onChange(next);
  }

  function clearDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <fieldset className="space-y-1 border-t border-panel-border pt-4">
      <legend className={labelClass}>Content blocks</legend>
      {blocks.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          No blocks yet — add one below.
        </p>
      ) : (
        <div>
          {blocks.map((block, i) => {
            const blockErrors = collectBlockErrors(errors, i);
            const hasBlockError = blockErrors.length > 0;
            const blockErrListId = `${blockErrId}-block-${i}-error`;
            const TypeIcon = BLOCK_TYPE_ICON[block.type];
            // Authoring-stub flag: the scaffold seeds quiz/image stubs marked
            // TODO; surface any that survive so they're obvious at a glance (the
            // same signal the lesson-readiness gate enforces before publish).
            const hasTodo = JSON.stringify(block).includes("TODO");
            const isDragging = dragIndex === i;
            const isDropTarget =
              overIndex === i && dragIndex !== null && dragIndex !== i;
            return (
              <div key={i}>
                {/* Insert-before zone (reveal on hover/focus). */}
                <InsertZone onInsert={(t) => insertBlock(t, i)} />

                <div
                  className={`rounded border bg-deep-space p-3 transition-shadow ${blockAccentClass(
                    block,
                  )} ${isDragging ? "opacity-40" : ""} ${
                    isDropTarget
                      ? "ring-2 ring-command-gold ring-offset-1 ring-offset-deep-space"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    if (dragIndex === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorder(dragIndex, i);
                    clearDrag();
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold">
                      {/* Grip = the drag source. draggable so a pointer drag
                          starts here without breaking text selection in the
                          fields below. */}
                      <span
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(i);
                          e.dataTransfer.effectAllowed = "move";
                          // Firefox requires data to be set for a drag to begin.
                          e.dataTransfer.setData("text/plain", String(i));
                        }}
                        onDragEnd={clearDrag}
                        title="Drag to reorder"
                        aria-label={`Drag block ${i + 1} to reorder`}
                        className="cursor-grab text-gray-3 transition-colors hover:text-command-gold active:cursor-grabbing"
                      >
                        <GripIcon className="h-4 w-4" />
                      </span>
                      <TypeIcon className="h-4 w-4" />
                      {BLOCK_TYPE_LABELS[block.type]}
                      {hasTodo ? (
                        <span
                          title="Unfilled authoring stub — replace the TODO text before publishing"
                          className="ml-1 inline-flex items-center rounded bg-command-gold/15 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-command-gold"
                        >
                          TODO
                        </span>
                      ) : null}
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
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2">
        <AddBlockMenu variant="full" onAdd={(t) => insertBlock(t, blocks.length)} />
      </div>
    </fieldset>
  );
}

// ─── insert-between zone ─────────────────────────────────────────────────────
// A slim row before each block. The hairline + "+ insert" trigger stay near-
// invisible until the row is hovered or something inside it is focused, so the
// editor isn't cluttered with N insert controls — they reveal where you point.
function InsertZone({ onInsert }: { onInsert: (type: BlockType) => void }) {
  return (
    <div className="group/insert relative flex h-6 items-center justify-center">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-command-gold/0 transition-colors group-hover/insert:bg-command-gold/25 group-focus-within/insert:bg-command-gold/25" />
      <span className="relative opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100">
        <AddBlockMenu variant="inline" onAdd={onInsert} />
      </span>
    </div>
  );
}

// ─── add-block menu ─────────────────────────────────────────────────────────
// A trigger that toggles a small popup list of block types; choosing one calls
// `onAdd(type)` and closes. `variant` switches the trigger between the bottom
// "Add block" button (full) and the compact "+" used inside an InsertZone.
//
// Keyboard/dismissal contract (unchanged): focus moves to the first item on
// open; Escape closes + returns focus to the trigger; an outside mousedown/focus
// closes; choosing a type closes + returns focus to the trigger.
function AddBlockMenu({
  onAdd,
  variant,
}: {
  onAdd: (type: BlockType) => void;
  variant: "full" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const triggerLabel = variant === "full" ? "Add block" : "Insert block here";

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

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

  function focusTrigger() {
    containerRef.current
      ?.querySelector<HTMLButtonElement>("button[data-add-trigger]")
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
      <button
        type="button"
        data-add-trigger
        aria-label={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "full"
            ? "inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
            : "inline-flex items-center gap-1 rounded border border-command-gold bg-deep-space px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
        }
      >
        <PlusIcon className={variant === "full" ? "h-4 w-4" : "h-3 w-3"} />
        {variant === "full" ? "Add block" : "Insert"}
      </button>
      {open ? (
        <ul
          id={menuId}
          aria-label="Block types"
          className={`absolute z-20 mt-1 min-w-44 rounded border border-panel-border bg-deep-space p-1 shadow-xl ${
            variant === "full" ? "left-0" : "left-1/2 -translate-x-1/2"
          }`}
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
// inherit their severity's hue so the editor previews the block's emphasis.
function blockAccentClass(block: ContentBlock): string {
  if (block.type === "callout") {
    switch (block.severity) {
      case "critical":
        return "border-alert-red/30";
      case "info":
        return "border-signal-blue/30";
      case "warn":
      default:
        return "border-command-gold/25";
    }
  }
  return "border-command-gold/25";
}
