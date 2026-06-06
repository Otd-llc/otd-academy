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
import { moveWithin } from "@/lib/guide-table";
import {
  inputClass as fieldInputClass,
  helpClass,
  labelClass,
  selectClass,
  textareaClass as fieldTextareaClass,
} from "@/components/guide/field-styles";

// Block inputs/textareas span their container; compose full-width onto the
// shared field box.
const inputClass = `w-full ${fieldInputClass}`;
const textareaClass = `w-full ${fieldTextareaClass}`;

// Per-block error wiring (fix D): when the parent block has a save error, the
// PRIMARY input of each editor flips `aria-invalid` and points its
// `aria-describedby` at the parent's block-error list, mirroring HeaderFields.
type BlockErrorProps = { hasError?: boolean; errorId?: string };

function ariaErrorProps({ hasError, errorId }: BlockErrorProps) {
  return {
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? errorId : undefined,
  } as const;
}

export function BlockEditor({
  block,
  onChange,
  hasError,
  errorId,
}: {
  block: ContentBlock;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
  const err: BlockErrorProps = { hasError, errorId };
  switch (block.type) {
    case "prose":
      return <ProseEditor block={block} onChange={onChange} {...err} />;
    case "callout":
      return <CalloutEditor block={block} onChange={onChange} {...err} />;
    case "steps":
      return <StepsEditor block={block} onChange={onChange} {...err} />;
    case "table":
      return <TableBlockEditor block={block} onChange={onChange} {...err} />;
    case "termRef":
      return <TermRefEditor block={block} onChange={onChange} {...err} />;
    case "sourceRef":
      return <SourceRefEditor block={block} onChange={onChange} {...err} />;
    case "partModel":
      return <PartModelEditor block={block} onChange={onChange} {...err} />;
    case "image":
      return (
        <MediaEditor
          block={block}
          onChange={onChange}
          srcHelp="A root-relative path (e.g. /guide-diagrams/x.svg) or an http(s):// URL."
          {...err}
        />
      );
    case "video":
      return (
        <MediaEditor
          block={block}
          onChange={onChange}
          srcHelp="A root-relative path (e.g. /guide-media/x.mp4) or an http(s):// URL. Leave empty for a placeholder."
          {...err}
        />
      );
    case "quiz":
      return <QuizEditor block={block} onChange={onChange} {...err} />;
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
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "prose" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
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
        {...ariaErrorProps({ hasError, errorId })}
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
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "callout" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
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
          {...ariaErrorProps({ hasError, errorId })}
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
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "steps" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
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
    // moveWithin is a bounds-checked adjacent swap (guide-table); a no-op move
    // returns an equivalent array, so behavior is unchanged.
    onChange({ ...block, items: moveWithin(items, i, dir) });
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
                  {...(i === 0 ? ariaErrorProps({ hasError, errorId }) : {})}
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
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "termRef" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
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
        {...ariaErrorProps({ hasError, errorId })}
      />
    </div>
  );
}

// ─── sourceRef ──────────────────────────────────────────────────────────
function SourceRefEditor({
  block,
  onChange,
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "sourceRef" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
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
          {...ariaErrorProps({ hasError, errorId })}
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

// ─── partModel ──────────────────────────────────────────────────────────
function PartModelEditor({
  block,
  onChange,
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "partModel" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
  const baseId = useId();
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${baseId}-mpn`} className={labelClass}>
          Part MPN
        </label>
        <input
          id={`${baseId}-mpn`}
          type="text"
          maxLength={80}
          value={block.mpn}
          onChange={(e) => onChange({ ...block, mpn: e.target.value })}
          className={`mt-1 ${inputClass}`}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError && errorId
              ? `${errorId} ${baseId}-mpn-help`
              : `${baseId}-mpn-help`
          }
        />
        <p id={`${baseId}-mpn-help`} className={helpClass}>
          MPN of a part with a 3D model (e.g. USB4110-GF-A). The card embeds its
          viewer; an MPN with no 3D asset shows the caption only.
        </p>
      </div>
      <div>
        <label htmlFor={`${baseId}-cap`} className={labelClass}>
          Caption (optional)
        </label>
        <input
          id={`${baseId}-cap`}
          type="text"
          maxLength={160}
          value={block.caption ?? ""}
          onChange={(e) =>
            onChange({ ...block, caption: e.target.value || undefined })
          }
          className={`mt-1 ${inputClass}`}
        />
      </div>
    </div>
  );
}

// ─── image / video ──────────────────────────────────────────────────────
// Both media blocks share the same fields (src / alt / caption); only the
// source help text differs (passed in). An empty src is a valid placeholder.
function MediaEditor({
  block,
  onChange,
  srcHelp,
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "image" | "video" }>;
  onChange: (next: ContentBlock) => void;
  srcHelp: string;
} & BlockErrorProps) {
  const baseId = useId();
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${baseId}-src`} className={labelClass}>
          {block.type === "video" ? "Video source" : "Image source"}
        </label>
        <input
          id={`${baseId}-src`}
          type="text"
          maxLength={500}
          value={block.src}
          onChange={(e) => onChange({ ...block, src: e.target.value })}
          className={`mt-1 ${inputClass}`}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError && errorId
              ? `${errorId} ${baseId}-src-help`
              : `${baseId}-src-help`
          }
        />
        <p id={`${baseId}-src-help`} className={helpClass}>
          {srcHelp}
        </p>
      </div>
      <div>
        <label htmlFor={`${baseId}-alt`} className={labelClass}>
          {block.type === "video" ? "Description" : "Alt text"}
        </label>
        <input
          id={`${baseId}-alt`}
          type="text"
          maxLength={200}
          value={block.alt}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
          className={`mt-1 ${inputClass}`}
        />
      </div>
      <div>
        <label htmlFor={`${baseId}-cap`} className={labelClass}>
          Caption (optional)
        </label>
        <input
          id={`${baseId}-cap`}
          type="text"
          maxLength={200}
          value={block.caption ?? ""}
          onChange={(e) =>
            onChange({ ...block, caption: e.target.value || undefined })
          }
          className={`mt-1 ${inputClass}`}
        />
      </div>
    </div>
  );
}

// ─── quiz ───────────────────────────────────────────────────────────────
function QuizEditor({
  block,
  onChange,
  hasError,
  errorId,
}: {
  block: Extract<ContentBlock, { type: "quiz" }>;
  onChange: (next: ContentBlock) => void;
} & BlockErrorProps) {
  const baseId = useId();
  const { questions } = block;

  const setQuestions = (qs: typeof questions) =>
    onChange({ ...block, questions: qs });
  const patchQ = (qi: number, patch: Partial<(typeof questions)[number]>) =>
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  const addQ = () => {
    if (questions.length >= 10) return;
    setQuestions([
      ...questions,
      { q: "New question?", options: ["Option A", "Option B"], answer: 0 },
    ]);
  };
  const removeQ = (qi: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qi));
  };
  const setOpt = (qi: number, oi: number, val: string) =>
    patchQ(qi, {
      options: questions[qi]!.options.map((o, i) => (i === oi ? val : o)),
    });
  const addOpt = (qi: number) => {
    const q = questions[qi]!;
    if (q.options.length >= 6) return;
    patchQ(qi, {
      options: [
        ...q.options,
        `Option ${String.fromCharCode(65 + q.options.length)}`,
      ],
    });
  };
  const removeOpt = (qi: number, oi: number) => {
    const q = questions[qi]!;
    if (q.options.length <= 2) return;
    const options = q.options.filter((_, i) => i !== oi);
    // Keep `answer` pointing at the same option (or reset if it was removed).
    const answer = q.answer === oi ? 0 : q.answer > oi ? q.answer - 1 : q.answer;
    patchQ(qi, { options, answer });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Prompt (optional)</label>
        <input
          type="text"
          maxLength={300}
          value={block.prompt ?? ""}
          onChange={(e) =>
            onChange({ ...block, prompt: e.target.value || undefined })
          }
          className={`mt-1 ${inputClass}`}
        />
      </div>

      {questions.map((q, qi) => (
        <fieldset
          key={qi}
          className="space-y-2 rounded border border-panel-border p-2"
        >
          <div className="flex items-center justify-between">
            <legend className={labelClass}>Question {qi + 1}</legend>
            <IconButton
              type="button"
              tone="danger"
              hint="Remove question"
              ariaLabel={`Remove question ${qi + 1}`}
              disabled={questions.length <= 1}
              onClick={() => removeQ(qi)}
            >
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          </div>
          <input
            type="text"
            maxLength={500}
            value={q.q}
            onChange={(e) => patchQ(qi, { q: e.target.value })}
            className={inputClass}
            {...(qi === 0 ? ariaErrorProps({ hasError, errorId }) : {})}
          />
          <p className={helpClass}>
            Select the radio beside the correct option.
          </p>
          <div className="space-y-1">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${baseId}-q${qi}`}
                  checked={q.answer === oi}
                  onChange={() => patchQ(qi, { answer: oi })}
                  className="accent-command-gold"
                  aria-label={`Mark option ${oi + 1} correct`}
                />
                <input
                  type="text"
                  maxLength={300}
                  value={opt}
                  onChange={(e) => setOpt(qi, oi, e.target.value)}
                  className={inputClass}
                />
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Remove option"
                  ariaLabel={`Remove option ${oi + 1}`}
                  disabled={q.options.length <= 2}
                  onClick={() => removeOpt(qi, oi)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <IconButton
            type="button"
            hint="Add option"
            ariaLabel="Add option"
            onClick={() => addOpt(qi)}
          >
            <PlusIcon className="h-4 w-4" />
          </IconButton>
          <div>
            <label className={labelClass}>Explanation (optional)</label>
            <input
              type="text"
              maxLength={500}
              value={q.explain ?? ""}
              onChange={(e) =>
                patchQ(qi, { explain: e.target.value || undefined })
              }
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </fieldset>
      ))}

      <IconButton
        type="button"
        hint="Add question"
        ariaLabel="Add question"
        onClick={addQ}
      >
        <PlusIcon className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
