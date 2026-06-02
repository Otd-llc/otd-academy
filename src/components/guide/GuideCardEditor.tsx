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

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentBlock } from "@/lib/schemas/guide";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  defaultBlock,
  type BlockType,
} from "@/lib/guide-block-defaults";
import { saveGuideCard } from "@/lib/actions/guides-form";
import { BlockEditor } from "@/components/guide/BlockEditor";
import { IconButton } from "@/components/IconButton";
import { InlineBanner } from "@/components/InlineBanner";
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

    // Client-validate the assembled blocks for immediate inline feedback; the
    // server re-validates regardless (defense-in-depth).
    const parsed = guideContentBlocksSchema.safeParse(blocksDraft);
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = `contentBlocks.${issue.path.join(".")}`;
        (errs[key] ??= []).push(issue.message);
      }
      setFieldErrors(errs);
      setError("Some blocks are invalid — fix the highlighted fields.");
      return;
    }

    const trimmedLead = leadDraft.trim();
    startTransition(async () => {
      const r = await saveGuideCard({
        id: cardId,
        eyebrow: eyebrowDraft,
        title: titleDraft,
        lead: trimmedLead === "" ? null : trimmedLead,
        contentBlocks: parsed.data,
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
                  <BlockEditor block={block} onChange={updateBlockAt(i)} />
                  {blockErrors.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs font-bold text-alert-red">
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

      {error ? <InlineBanner variant="error">{error}</InlineBanner> : null}

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
        />
        <FieldError messages={fieldErrors?.eyebrow} />
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
        />
        <FieldError messages={fieldErrors?.title} />
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
        />
        <FieldError messages={fieldErrors?.lead} />
      </div>
    </div>
  );
}

// ─── add-block menu ─────────────────────────────────────────────────────────
// A Plus IconButton that toggles a small keyboard-operable menu of block
// types; choosing one appends defaultBlock(type) and closes the menu.
function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const firstItemRef = useRef<HTMLButtonElement>(null);

  function choose(type: BlockType) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
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
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
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
function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
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
