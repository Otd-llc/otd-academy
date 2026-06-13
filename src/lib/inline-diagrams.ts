// Inline our hand-authored house-style /guide-diagrams SVGs so they render with
// the site's Space Mono. An <img>-sourced SVG is sandboxed and can't use a page
// webfont, so it falls back to system mono — visibly off-brand. Inlined into the
// page DOM, the diagram inherits the loaded font (forced via a CSS rule on the
// `.guide-diagram` wrapper in globals.css).
//
// SCOPE: only the house canvas (viewBox "0 0 780 360") is inlined. The KiCad
// Eeschema exports (l1-01-sub-*.svg, the schematic reference) are CAD drawings on
// their own white background and must keep their baked layout — they stay <img>.
//
// TRUST: `src` is admin-authored, but we only ever read a strict basename under
// public/guide-diagrams (the regex + fixed dir block path traversal), and these
// are our own committed build assets — same trust level as importing them. The
// content is then dangerouslySet in ImageBlock.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentBlock } from "@/lib/schemas/guide";

const DIAGRAM_DIR = path.join(process.cwd(), "public", "guide-diagrams");
const NAME = /^\/guide-diagrams\/([a-z0-9][a-z0-9-]*\.svg)$/;
// House canvas is 780 wide, zero origin (height varies: 300–400). KiCad Eeschema
// exports use fractional mm viewBoxes (e.g. "47.0251 72.9331 …"), so this prefix
// cleanly selects hand-authored house diagrams and excludes the CAD drawings.
const HOUSE_CANVAS = 'viewBox="0 0 780 ';
const cache = new Map<string, string | null>(); // null = read but not a house diagram

export async function resolveInlineDiagrams(
  blocks: ContentBlock[],
): Promise<Record<string, string>> {
  const srcs = new Set<string>();
  for (const b of blocks) if (b.type === "image" && NAME.test(b.src)) srcs.add(b.src);

  const out: Record<string, string> = {};
  for (const src of srcs) {
    if (!cache.has(src)) {
      const name = NAME.exec(src)![1];
      try {
        const svg = await readFile(path.join(DIAGRAM_DIR, name), "utf8");
        cache.set(src, svg.includes(HOUSE_CANVAS) ? svg : null);
      } catch {
        cache.set(src, null); // missing → falls back to <img>
      }
    }
    const cached = cache.get(src);
    if (cached) out[src] = cached;
  }
  return out;
}
