// Island metadata derived from the numbered-section callout convention
// ("NN · Title" labels, the same regex SectionHeaderBlock dispatches on).
// The rail, the setup band, and resume-position all key off this scan.
import type { ContentBlock } from "@/lib/schemas/guide";

export const SECTION_LABEL_RE = /^(\d+)\s*·\s*(.*)$/;
export const RAIL_MIN_ISLANDS = 3;

export interface Island {
  num: string;
  title: string;
  blockIndex: number;
  anchorId: string;
}

export function scanIslands(blocks: ContentBlock[]): Island[] {
  const out: Island[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "callout") return;
    const m = (b.label ?? "").match(SECTION_LABEL_RE);
    if (!m) return;
    out.push({ num: m[1], title: m[2], blockIndex: i, anchorId: `island-${m[1]}` });
  });
  return out;
}
