"use client";

// Inline edit-in-place wrapper for a guide card's teaching content (Task 4 /
// design §2 + §4). A client island that wraps the server-rendered card body
// (PageHeader + GuideBlocks, passed as `children`).
//
// VIEW mode renders `children` verbatim plus an unobtrusive Edit pencil
// (only when `canEdit`). EDIT mode seeds controlled copies of
// {eyebrow,title,lead,blocks} from props (re-seeded on every entry), renders
// the header inputs + a block-list editor (per-type <BlockEditor> rows with
// reorder/delete + an Add-block menu), and on Save dispatches the structured
// `saveGuideCard` server wrapper via useTransition; on success it exits edit
// mode and `router.refresh()`es so the server children + StageGate re-render
// with the committed content. Cancel discards the in-memory state.
//
// Gate-wiring (`completionRef` / `isGate`) is intentionally NOT surfaced here
// — those drive the authoritative-done mapping and stay locked (design §1).
// The editor never sends them; `saveGuideCard` patches only the fields below.

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentBlock } from "@/lib/schemas/guide";
import { editGuideCardSchema, guideContentBlocksSchema } from "@/lib/schemas/guide";
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  defaultBlock,
  type BlockType,
} from "@/lib/guide-block-defaults";
import { saveGuideCard } from "@/lib/actions/guides-form";
import { BlockEditor } from "@/components/guide/BlockEditor";
import { IconButton } from "@/components/IconButton";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

// Shared bench-flat styling (matches NewChecklistDialog / BlockEditor).
const inputClass =
  "mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const labelClass =
  "block font-mono text-xs uppercase tracking-wider text-muted";

export function GuideCardEditor({
  cardId,
  eyebrow,
  title,
  lead,
  blocks,
  canEdit,
  children,
}: {
  cardId: string;
  eyebrow: string;
  title: string;
  lead: string | null;
  blocks: ContentBlock[];
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const blockErrId = useId();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Controlled edit-mode copies, seeded from props on entry (see enterEdit).
  const [eyebrowDraft, setEyebrowDraft] = useState(eyebrow);
  const [titleDraft, setTitleDraft] = useState(title);
  const [leadDraft, setLeadDraft] = useState(lead ?? "");
  const [blocksDraft, setBlocksDraft] = useState<ContentBlock[]>(blocks);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  function enterEdit() {
    // Re-seed every draft from the latest props so a Cancel-then-Edit (or a
    // post-refresh re-Edit) starts from the freshly rendered server state.
    setEyebrowDraft(eyebrow);
    setTitleDraft(title);
    setLeadDraft(lead ?? "");
    setBlocksDraft(blocks);
    setError(null);
    setFieldErrors(undefined);
    setEditing(true);
  }

  function cancel() {
    // Discard all in-memory edits.
    setError(null);
    setFieldErrors(undefined);
    setEditing(false);
  }

  // ─── block-array mutations (index swap / splice / append) ───────────────
  function updateBlockAt(i: number) {
    return (next: ContentBlock) =>
      setBlocksDraft((prev) => prev.map((b, bi) => (bi === i ? next : b)));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocksDraft.length) return;
    setBlocksDraft((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  function removeBlock(i: number) {
    setBlocksDraft((prev) => prev.filter((_, bi) => bi !== i));
  }
  function addBlock(type: BlockType) {
    setBlocksDraft((prev) => [...prev, defaultBlock(type)]);
  }

  function save() {
    setError(null);
    setFieldErrors(undefined);

    // Client-validate header fields + the assembled blocks for immediate inline
    // feedback; the server re-validates regardless (defense-in-depth).
    const errs: Record<string, string[]> = {};

    // Header fields: eyebrow + title are `.trim().min(1)` in editGuideCardSchema
    // — surface emptiness inline instead of after a server round-trip.
    const eyebrowCheck = editGuideCardSchema.shape.eyebrow.safeParse(eyebrowDraft);
    if (!eyebrowCheck.success) {
      errs.eyebrow = eyebrowCheck.error.issues.map((i) => i.message);
    }
    const titleCheck = editGuideCardSchema.shape.title.safeParse(titleDraft);
    if (!titleCheck.success) {
      errs.title = titleCheck.error.issues.map((i) => i.message);
    }

    const parsed = guideContentBlocksSchema.safeParse(blocksDraft);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = `contentBlocks.${issue.path.join(".")}`;
        (errs[key] ??= []).push(issue.message);
      }
    }

    if (!parsed.success || Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Some fields are invalid — fix the highlighted fields.");
      return;
    }

    const validBlocks = parsed.data;
    const trimmedLead = leadDraft.trim();
    startTransition(async () => {
      const r = await saveGuideCard({
        id: cardId,
        eyebrow: eyebrowDraft,
        title: titleDraft,
        lead: trimmedLead === "" ? null : trimmedLead,
        contentBlocks: validBlocks,
      });
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(r.message ?? "Could not save");
        setFieldErrors(r.errors);
      }
    });
  }

  // ─── VIEW mode ──────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="relative">
        {canEdit ? (
          <div className="absolute right-0 top-0 z-10">
            <IconButton
              type="button"
              hint="Edit card"
              ariaLabel="Edit card"
              onClick={enterEdit}
            >
              <PencilIcon className="h-5 w-5" />
            </IconButton>
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  // ─── EDIT mode ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <HeaderFields
        eyebrow={eyebrowDraft}
        title={titleDraft}
        lead={leadDraft}
        onEyebrow={setEyebrowDraft}
        onTitle={setTitleDraft}
        onLead={setLeadDraft}
        fieldErrors={fieldErrors}
      />

      <fieldset className="space-y-3">
        <legend className={labelClass}>Content blocks</legend>
        {blocksDraft.length === 0 ? (
          <p className="font-mono text-xs text-muted">
            No blocks yet — add one below.
          </p>
        ) : (
          <div className="space-y-3">
            {blocksDraft.map((block, i) => {
              const blockErrors = collectBlockErrors(fieldErrors, i);
              const hasBlockError = blockErrors.length > 0;
              const blockErrListId = `${blockErrId}-block-${i}-error`;
              return (
                <div
                  key={i}
                  className="rounded border border-panel-border bg-navy-dark/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
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
                        disabled={i === blocksDraft.length - 1}
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
                    <BlockEditor block={block} onChange={updateBlockAt(i)} />
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

      {error ? (
        // Rendered as normal-case (not InlineBanner, whose root forces
        // `uppercase`) so URL-bearing messages — e.g. "href must be http(s)://
        // or a root-relative path" — read cleanly.
        <p
          role="alert"
          className="rounded border border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm text-alert-red"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── header fields ────────────────────────────────────────────────────────
function HeaderFields({
  eyebrow,
  title,
  lead,
  onEyebrow,
  onTitle,
  onLead,
  fieldErrors,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  onEyebrow: (v: string) => void;
  onTitle: (v: string) => void;
  onLead: (v: string) => void;
  fieldErrors?: Record<string, string[]>;
}) {
  const baseId = useId();
  // Stable error-element ids so each input can point at its error via
  // aria-describedby; aria-invalid flips when an error is present, so an SR
  // user tabbing to the field hears the message.
  const eyebrowErrId = `${baseId}-eyebrow-error`;
  const titleErrId = `${baseId}-title-error`;
  const leadErrId = `${baseId}-lead-error`;
  const hasEyebrowError = (fieldErrors?.eyebrow?.length ?? 0) > 0;
  const hasTitleError = (fieldErrors?.title?.length ?? 0) > 0;
  const hasLeadError = (fieldErrors?.lead?.length ?? 0) > 0;
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${baseId}-eyebrow`} className={labelClass}>
          Eyebrow
        </label>
        <input
          id={`${baseId}-eyebrow`}
          type="text"
          maxLength={40}
          value={eyebrow}
          onChange={(e) => onEyebrow(e.target.value)}
          className={inputClass}
          aria-invalid={hasEyebrowError || undefined}
          aria-describedby={hasEyebrowError ? eyebrowErrId : undefined}
        />
        <FieldError id={eyebrowErrId} messages={fieldErrors?.eyebrow} />
      </div>
      <div>
        <label htmlFor={`${baseId}-title`} className={labelClass}>
          Title
        </label>
        <input
          id={`${baseId}-title`}
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          className={inputClass}
          aria-invalid={hasTitleError || undefined}
          aria-describedby={hasTitleError ? titleErrId : undefined}
        />
        <FieldError id={titleErrId} messages={fieldErrors?.title} />
      </div>
      <div>
        <label htmlFor={`${baseId}-lead`} className={labelClass}>
          Lead (optional)
        </label>
        <textarea
          id={`${baseId}-lead`}
          rows={2}
          maxLength={400}
          value={lead}
          onChange={(e) => onLead(e.target.value)}
          className={inputClass}
          aria-invalid={hasLeadError || undefined}
          aria-describedby={hasLeadError ? leadErrId : undefined}
        />
        <FieldError id={leadErrId} messages={fieldErrors?.lead} />
      </div>
    </div>
  );
}

// ─── add-block menu ─────────────────────────────────────────────────────────
// A Plus IconButton that toggles a small keyboard-operable menu of block
// types; choosing one appends defaultBlock(type) and closes the menu.
//
// Keyboard/dismissal contract:
//   • On open, focus moves to the first menu item (useEffect keyed on `open`).
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
      <IconButton
        type="button"
        hint="Add block"
        ariaLabel="Add block"
        onClick={() => setOpen((v) => !v)}
      >
        <PlusIcon className="h-4 w-4" />
      </IconButton>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label="Block types"
          className="absolute left-0 z-20 mt-1 min-w-44 rounded border border-panel-border bg-navy-dark p-1 shadow-xl"
        >
          {BLOCK_TYPES.map((type, i) => (
            <li key={type} role="none">
              <button
                ref={i === 0 ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                onClick={() => choose(type)}
                className="block w-full rounded px-3 py-1.5 text-left font-mono text-sm text-link-muted transition-colors hover:bg-deep-space hover:text-command-gold focus-visible:bg-deep-space focus-visible:text-command-gold focus-visible:outline-none"
              >
                {BLOCK_TYPE_LABELS[type]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── field-error helpers ────────────────────────────────────────────────────
function FieldError({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p id={id} className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

// Pull every field error whose key targets block index `i` (e.g.
// "contentBlocks.0.label"), stripping the "contentBlocks.<i>." prefix so the
// surfaced message names the offending sub-field.
function collectBlockErrors(
  fieldErrors: Record<string, string[]> | undefined,
  i: number,
): string[] {
  if (!fieldErrors) return [];
  const prefix = `contentBlocks.${i}`;
  const out: string[] = [];
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (key === prefix || key.startsWith(`${prefix}.`)) {
      const sub = key.slice(prefix.length).replace(/^\./, "");
      for (const msg of messages) out.push(sub ? `${sub}: ${msg}` : msg);
    }
  }
  return out;
}
