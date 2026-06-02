"use client";

// Per-type content-block editor for the inline guide-card editor (Task 3 /
// design §3). CONTROLLED + STATELESS: it renders a type-specific form for one
// `ContentBlock` and calls `onChange` with the next block on every edit. It
// holds NO server state and dispatches NO actions — the parent
// (GuideCardEditor, Task 4) owns the block array + Save.
//
// The switch over `block.type` is EXHAUSTIVE: a `never`-typed default arm makes
// the compiler flag any future block type that isn't handled here. The heavy
// `table` form lives in its own file (TableBlockEditor) per design §6.

import { useId } from "react";
import type { ContentBlock } from "@/lib/schemas/guide";
import { IconButton } from "@/components/IconButton";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { TableBlockEditor } from "@/components/guide/TableBlockEditor";

// Shared bench-flat input styling (matches NewChecklistDialog / _form.tsx).
const inputClass =
  "w-full rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const selectClass =
  "rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const textareaClass =
  "w-full rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none";
const labelClass =
  "block font-mono text-xs uppercase tracking-wider text-muted";
const helpClass = "mt-1 font-mono text-xs text-muted";

export function BlockEditor({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (next: ContentBlock) => void;
}) {
  switch (block.type) {
    case "prose":
      return <ProseEditor block={block} onChange={onChange} />;
    case "callout":
      return <CalloutEditor block={block} onChange={onChange} />;
    case "steps":
      return <StepsEditor block={block} onChange={onChange} />;
    case "table":
      return <TableBlockEditor block={block} onChange={onChange} />;
    case "termRef":
      return <TermRefEditor block={block} onChange={onChange} />;
    case "sourceRef":
      return <SourceRefEditor block={block} onChange={onChange} />;
    default: {
      // Exhaustiveness guard: if a new block.type is added to the schema and
      // not handled above, this line fails to typecheck.
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

// ─── prose ──────────────────────────────────────────────────────────────
function ProseEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: "prose" }>;
  onChange: (next: ContentBlock) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Prose (markdown)
      </label>
      <textarea
        id={id}
        rows={4}
        maxLength={4000}
        value={block.md}
        onChange={(e) => onChange({ type: "prose", md: e.target.value })}
        className={`mt-1 ${textareaClass}`}
      />
    </div>
  );
}

// ─── callout ────────────────────────────────────────────────────────────
const SEVERITIES: Array<Extract<ContentBlock, { type: "callout" }>["severity"]> =
  ["critical", "warn", "info"];

function CalloutEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: "callout" }>;
  onChange: (next: ContentBlock) => void;
}) {
  const baseId = useId();
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${baseId}-sev`} className={labelClass}>
          Severity
        </label>
        <select
          id={`${baseId}-sev`}
          value={block.severity}
          onChange={(e) =>
            onChange({
              ...block,
              severity: e.target.value as typeof block.severity,
            })
          }
          className={`mt-1 ${selectClass}`}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${baseId}-label`} className={labelClass}>
          Label
        </label>
        <input
          id={`${baseId}-label`}
          type="text"
          maxLength={120}
          value={block.label}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          className={`mt-1 ${inputClass}`}
        />
      </div>
      <div>
        <label htmlFor={`${baseId}-body`} className={labelClass}>
          Body
        </label>
        <textarea
          id={`${baseId}-body`}
          rows={3}
          maxLength={2000}
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
          className={`mt-1 ${textareaClass}`}
        />
      </div>
    </div>
  );
}

// ─── steps ──────────────────────────────────────────────────────────────
function StepsEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: "steps" }>;
  onChange: (next: ContentBlock) => void;
}) {
  const baseId = useId();
  const { items } = block;

  function setItem(i: number, value: string) {
    onChange({ ...block, items: items.map((s, si) => (si === i ? value : s)) });
  }
  function addItem() {
    onChange({ ...block, items: [...items, `Step ${items.length + 1}`] });
  }
  function removeItem(i: number) {
    if (items.length <= 1) return; // schema requires items min-length 1
    onChange({ ...block, items: items.filter((_, si) => si !== i) });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ ...block, items: next });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
        <input
          type="checkbox"
          checked={block.ordered}
          onChange={(e) => onChange({ ...block, ordered: e.target.checked })}
          className="accent-command-gold"
        />
        Ordered (numbered)
      </label>
      <fieldset>
        <legend className={labelClass}>Steps</legend>
        <div className="mt-1 space-y-1.5">
          {items.map((item, i) => {
            const id = `${baseId}-step-${i}`;
            return (
              <div key={i} className="flex items-center gap-1">
                <label htmlFor={id} className="sr-only">
                  Step {i + 1}
                </label>
                <input
                  id={id}
                  type="text"
                  maxLength={500}
                  value={item}
                  onChange={(e) => setItem(i, e.target.value)}
                  className={inputClass}
                />
                <IconButton
                  type="button"
                  hint="Move up"
                  ariaLabel={`Move step ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  type="button"
                  hint="Move down"
                  ariaLabel={`Move step ${i + 1} down`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Remove step"
                  ariaLabel={`Remove step ${i + 1}`}
                  disabled={items.length <= 1}
                  onClick={() => removeItem(i)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            );
          })}
        </div>
        <div className="mt-1">
          <IconButton
            type="button"
            hint="Add step"
            ariaLabel="Add step"
            onClick={addItem}
          >
            <PlusIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </fieldset>
    </div>
  );
}

// ─── termRef ────────────────────────────────────────────────────────────
function TermRefEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: "termRef" }>;
  onChange: (next: ContentBlock) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Glossary term
      </label>
      <input
        id={id}
        type="text"
        maxLength={80}
        value={block.term}
        onChange={(e) => onChange({ type: "termRef", term: e.target.value })}
        className={`mt-1 ${inputClass}`}
      />
    </div>
  );
}

// ─── sourceRef ──────────────────────────────────────────────────────────
function SourceRefEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: "sourceRef" }>;
  onChange: (next: ContentBlock) => void;
}) {
  const baseId = useId();
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${baseId}-label`} className={labelClass}>
          Label
        </label>
        <input
          id={`${baseId}-label`}
          type="text"
          maxLength={160}
          value={block.label}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          className={`mt-1 ${inputClass}`}
        />
      </div>
      <div>
        <label htmlFor={`${baseId}-href`} className={labelClass}>
          Link (href)
        </label>
        <input
          id={`${baseId}-href`}
          type="text"
          maxLength={500}
          value={block.href}
          onChange={(e) => onChange({ ...block, href: e.target.value })}
          className={`mt-1 ${inputClass}`}
          aria-describedby={`${baseId}-href-help`}
        />
        <p id={`${baseId}-href-help`} className={helpClass}>
          Must be an http(s):// URL or a root-relative path (e.g. /docs/x).
        </p>
      </div>
    </div>
  );
}
