"use client";

// NOTES data editor (design §3.3): narrative `contentBlocks` reused verbatim
// from the guide layer via the extracted BlockListEditor. Controlled
// `{ data, onChange }` over `data.blocks`. The parent (FactGroupCard) clears its
// index-keyed block errors on every onChange and validates against `notesSchema`
// (= `{ blocks: guideContentBlocksSchema }`) before dispatch.

import type { Notes } from "@/lib/schemas/part-fact";
import type { ContentBlock } from "@/lib/schemas/guide";
import { BlockListEditor } from "@/components/guide/BlockListEditor";

export function NotesEditor({
  data,
  onChange,
  errors,
}: {
  data: Notes;
  onChange: (next: Notes) => void;
  /** Per-block errors keyed under `blocks.<i>.…` for BlockListEditor. */
  errors?: Record<string, string[]>;
}) {
  return (
    <BlockListEditor
      blocks={data.blocks as ContentBlock[]}
      onChange={(blocks) => onChange({ ...data, blocks })}
      errors={errors}
    />
  );
}
