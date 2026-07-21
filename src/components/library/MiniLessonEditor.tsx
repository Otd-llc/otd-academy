"use client";

// Admin authoring editor for a Library mini-lesson (Task A9). Reuses the guide
// BlockListEditor verbatim (same component the guide-card editor uses) for
// contentBlocks, and adds the mini-lesson header fields (slug / title / summary
// / SEO) + a relatedProjects link editor.
//
// Serves BOTH create (no `lessonId`) and edit (`lessonId` set). On save it
// client-validates with `miniLessonInputSchema` for immediate inline feedback,
// then dispatches the matching server action via useTransition; the server
// re-validates regardless (defense-in-depth). Publish/unpublish is a separate
// button (edit mode only) that flips `published` without touching content.
//
// Mirrors GuideCardEditor's transition + error-mapping shape: a ZodError maps to
// a per-field `fieldErrors` map (keyed `contentBlocks.<path>` for block errors so
// BlockListEditor's index-keyed display lights up); any other rejection → a
// single `error` banner.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentBlock } from "@/lib/schemas/guide";
import { miniLessonInputSchema } from "@/lib/schemas/mini-lesson";
import {
  createMiniLesson,
  saveMiniLesson,
  publishMiniLesson,
  unpublishMiniLesson,
} from "@/lib/actions/mini-lesson";
import { BlockListEditor } from "@/components/guide/BlockListEditor";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

export type RelatedProjectLink = {
  projectSlug: string;
  role: "SUPPORTING" | "DOWN_FUNNEL";
  ordinal: number;
};

export type MiniLessonEditorProps = {
  lessonId?: string;
  published?: boolean;
  initialSlug?: string;
  initialTitle?: string;
  initialSummary?: string;
  initialSeoTitle?: string;
  initialSeoDescription?: string;
  initialBlocks?: ContentBlock[];
  initialRelated?: RelatedProjectLink[];
  // All Project slugs (+ a label) for the relatedProjects picker.
  projectOptions: { slug: string; label: string }[];
};

export function MiniLessonEditor({
  lessonId,
  published = false,
  initialSlug = "",
  initialTitle = "",
  initialSummary = "",
  initialSeoTitle = "",
  initialSeoDescription = "",
  initialBlocks = [],
  initialRelated = [],
  projectOptions,
}: MiniLessonEditorProps) {
  const router = useRouter();
  const isCreate = !lessonId;
  const [isPending, startTransition] = useTransition();
  const [isPublishPending, startPublishTransition] = useTransition();

  const [slug, setSlug] = useState(initialSlug);
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle);
  const [seoDescription, setSeoDescription] = useState(initialSeoDescription);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [related, setRelated] = useState<RelatedProjectLink[]>(initialRelated);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  const baseId = useId();

  function onBlocksChange(next: ContentBlock[]) {
    setError(null);
    setOk(null);
    setFieldErrors(undefined);
    setBlocks(next);
  }

  // ─── relatedProjects mutations ──────────────────────────────────────────
  function addLink() {
    const first = projectOptions[0]?.slug ?? "";
    setRelated((r) => [
      ...r,
      { projectSlug: first, role: "SUPPORTING", ordinal: r.length },
    ]);
  }
  function updateLink(i: number, patch: Partial<RelatedProjectLink>) {
    setRelated((r) => r.map((l, li) => (li === i ? { ...l, ...patch } : l)));
  }
  function removeLink(i: number) {
    setRelated((r) => r.filter((_, li) => li !== i));
  }

  function assemble() {
    const trimmedSummary = summary.trim();
    const trimmedSeoTitle = seoTitle.trim();
    const trimmedSeoDescription = seoDescription.trim();
    return {
      slug: slug.trim(),
      title: title.trim(),
      summary: trimmedSummary === "" ? null : trimmedSummary,
      seoTitle: trimmedSeoTitle === "" ? null : trimmedSeoTitle,
      seoDescription: trimmedSeoDescription === "" ? null : trimmedSeoDescription,
      contentBlocks: blocks,
      relatedProjects: related,
    };
  }

  function save() {
    setError(null);
    setOk(null);
    setFieldErrors(undefined);

    const payload = assemble();
    const parsed = miniLessonInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_root";
        (errs[key] ??= []).push(issue.message);
      }
      setFieldErrors(errs);
      setError("Some fields are invalid — fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      try {
        if (isCreate) {
          const created = await createMiniLesson(parsed.data);
          setOk("Created.");
          router.replace(`/admin/library/${created.id}`);
          router.refresh();
        } else {
          await saveMiniLesson({ id: lessonId, ...parsed.data });
          setOk("Saved.");
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function togglePublish() {
    if (!lessonId) return;
    setError(null);
    setOk(null);
    startPublishTransition(async () => {
      try {
        if (published) {
          await unpublishMiniLesson(lessonId);
          setOk("Unpublished.");
        } else {
          await publishMiniLesson(lessonId);
          setOk("Published.");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change publish state.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <label htmlFor={`${baseId}-slug`} className={labelClass}>
            Slug (kebab-case)
          </label>
          <input
            id={`${baseId}-slug`}
            type="text"
            maxLength={120}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="motor-imagery-bci"
          />
          <FieldError messages={fieldErrors?.slug} />
        </div>
        <div>
          <label htmlFor={`${baseId}-title`} className={labelClass}>
            Title
          </label>
          <input
            id={`${baseId}-title`}
            type="text"
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors?.title} />
        </div>
        <div>
          <label htmlFor={`${baseId}-summary`} className={labelClass}>
            Summary (optional)
          </label>
          <textarea
            id={`${baseId}-summary`}
            rows={2}
            maxLength={400}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors?.summary} />
        </div>
        <div>
          <label htmlFor={`${baseId}-seoTitle`} className={labelClass}>
            SEO title (optional, ≤70)
          </label>
          <input
            id={`${baseId}-seoTitle`}
            type="text"
            maxLength={70}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors?.seoTitle} />
        </div>
        <div>
          <label htmlFor={`${baseId}-seoDescription`} className={labelClass}>
            SEO description (optional, ≤200)
          </label>
          <textarea
            id={`${baseId}-seoDescription`}
            rows={2}
            maxLength={200}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className={inputClass}
          />
          <FieldError messages={fieldErrors?.seoDescription} />
        </div>
      </div>

      {/* ─── related projects ─────────────────────────────────────────── */}
      <fieldset className="space-y-2 border-t border-panel-border pt-4">
        <legend className={labelClass}>Related projects</legend>
        {related.length === 0 ? (
          <p className="font-mono text-xs text-muted">No links yet.</p>
        ) : (
          <ul className="space-y-2">
            {related.map((link, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Project for link ${i + 1}`}
                  value={link.projectSlug}
                  onChange={(e) => updateLink(i, { projectSlug: e.target.value })}
                  className={`${fieldInputClass} max-w-xs`}
                >
                  {projectOptions.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Role for link ${i + 1}`}
                  value={link.role}
                  onChange={(e) =>
                    updateLink(i, {
                      role: e.target.value as RelatedProjectLink["role"],
                    })
                  }
                  className={fieldInputClass}
                >
                  <option value="SUPPORTING">SUPPORTING (up-link)</option>
                  <option value="DOWN_FUNNEL">DOWN_FUNNEL (CTA)</option>
                </select>
                <input
                  aria-label={`Ordinal for link ${i + 1}`}
                  type="number"
                  min={0}
                  value={link.ordinal}
                  onChange={(e) =>
                    updateLink(i, { ordinal: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={`${fieldInputClass} w-20`}
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="rounded border border-panel-border px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-alert-red hover:text-alert-red"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={addLink}
          disabled={projectOptions.length === 0}
          className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
        >
          + Add link
        </button>
        <FieldError messages={fieldErrors?.relatedProjects} />
      </fieldset>

      <BlockListEditor blocks={blocks} onChange={onBlocksChange} errors={fieldErrors} />

      {error ? (
        <p
          role="alert"
          className="rounded border border-alert-red bg-deep-space px-4 py-3 font-mono text-sm text-alert-red"
        >
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded border border-command-gold bg-deep-space px-4 py-3 font-mono text-sm text-command-gold">
          {ok}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded border border-command-gold bg-command-gold px-3 py-2 font-mono text-xs uppercase tracking-wider text-deep-space transition-colors hover:border-gold-light hover:bg-gold-light disabled:opacity-50"
        >
          {isPending ? "Saving…" : isCreate ? "Create" : "Save"}
        </button>
        {!isCreate ? (
          <button
            type="button"
            onClick={togglePublish}
            disabled={isPublishPending}
            className="rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold disabled:opacity-50"
          >
            {isPublishPending
              ? "Working…"
              : published
                ? "Unpublish"
                : "Publish"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}
