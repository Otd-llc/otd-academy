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

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentBlock } from "@/lib/schemas/guide";
import { editGuideCardSchema, guideContentBlocksSchema } from "@/lib/schemas/guide";
import { saveGuideCard } from "@/lib/actions/guides-form";
import { BlockListEditor } from "@/components/guide/BlockListEditor";
import { resizeRows } from "@/lib/guide-table";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import { PencilIcon } from "@/components/icons";

// Header inputs span the card width; compose the shared field box (aligned to
// the same px-2 py-1 the block editors use, so the two render at one height).
const inputClass = `mt-1 w-full ${fieldInputClass}`;

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
    // Normalize table rows on entry so a pre-existing ragged table (reachable
    // via out-of-band writes — resizeRows otherwise only runs on column/row
    // add/remove) becomes rectangular, and a subsequent cell-only edit persists
    // rectangular. Non-table blocks pass through untouched.
    setBlocksDraft(
      blocks.map((b) =>
        b.type === "table"
          ? { ...b, rows: resizeRows(b.rows, b.columns.length) }
          : b,
      ),
    );
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

  // ─── block-array changes (delegated to BlockListEditor) ─────────────────
  // BlockListEditor owns the reorder/delete/append/edit controls and hands us
  // the next array. Per-block errors are keyed by ARRAY INDEX, so any structural
  // edit (reorder / delete / append) — and any content edit — must clear the
  // stale error state here, or a now-valid block would keep a mis-targeted red
  // error + aria-invalid/aria-describedby until the next save (fix C).
  function onBlocksChange(next: ContentBlock[]) {
    setError(null);
    setFieldErrors(undefined);
    setBlocksDraft(next);
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
      // `saveGuideCard`'s own try/catch runs on the SERVER and only maps
      // action-body errors (ZodError → field errors, other rejections →
      // `message`). A transport-layer rejection (offline, network drop, a 500
      // before the action body runs, a serialization error) rejects the awaited
      // promise instead — without this catch the button silently reverts
      // "Saving…" → "Save" with no feedback.
      try {
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
      } catch {
        setError("Could not save — check your connection and try again.");
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
    <div className="space-y-6 rounded border-t-2 border-command-gold bg-navy-dark/20 p-4">
      <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
        Editing
      </span>

      <HeaderFields
        eyebrow={eyebrowDraft}
        title={titleDraft}
        lead={leadDraft}
        onEyebrow={setEyebrowDraft}
        onTitle={setTitleDraft}
        onLead={setLeadDraft}
        fieldErrors={fieldErrors}
      />

      <BlockListEditor
        blocks={blocksDraft}
        onChange={onBlocksChange}
        errors={fieldErrors}
      />

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
          className="rounded border border-command-gold bg-command-gold px-3 py-2 font-mono text-xs uppercase tracking-wider text-deep-space transition-colors hover:border-gold-light hover:bg-gold-light disabled:opacity-50"
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
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
        Card header
      </p>
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

// ─── field-error helpers ────────────────────────────────────────────────────
function FieldError({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p id={id} className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}
