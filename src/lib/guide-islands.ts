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

// A "Setup · <title>" callout opens a collapsible "set up once" region that
// swallows every following block until the next structural break — a "Mode · …"
// band, a "NN · …" section header, another "Setup · …" callout, or the end of
// the list. `end` is exclusive; the Setup callout itself is the range start
// (the renderer uses its title for the band summary, not as body).
const SETUP_LABEL_RE = /^setup\s*·\s*(.*)$/i;
const MODE_LABEL_RE = /^mode\b/i;

export interface SetupRange {
  start: number;
  end: number;
  title: string;
}

function isStructuralBreak(b: ContentBlock): boolean {
  if (b.type !== "callout") return false;
  const label = b.label ?? "";
  return MODE_LABEL_RE.test(label) || SECTION_LABEL_RE.test(label) || SETUP_LABEL_RE.test(label);
}

export function deriveSetupRanges(blocks: ContentBlock[]): SetupRange[] {
  const out: SetupRange[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "callout") continue;
    const m = (b.label ?? "").match(SETUP_LABEL_RE);
    if (!m) continue;
    let end = i + 1;
    while (end < blocks.length && !isStructuralBreak(blocks[end]!)) end++;
    out.push({ start: i, end, title: m[1].trim() });
    i = end - 1; // resume scanning at the terminator (may be another Setup)
  }
  return out;
}
