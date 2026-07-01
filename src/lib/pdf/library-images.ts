// Resolve a Library lesson's diagram image blocks into embeddable PNG data URIs
// for the PDF renderer. NO @react-pdf import here (pure node: fs + sharp), so the
// data prep stays out of the renderer bundle (mirrors cert-font-files.ts).
//
// A Library `image` block's `src` is the diagram REGISTRY KEY
// (`/guide-diagrams/<name>.svg`) — the on-page diagram is a DOM-only React
// component, but the diagram-export pipeline commits an indexable raster at
// `public/guide-diagrams/<name>.webp`. react-pdf can't embed WebP, so we read
// that file and transcode it to PNG with sharp (already a dependency). The
// result is cached per src so the combined Field Guide doesn't re-decode a
// diagram shared across lessons.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { ContentBlock } from "@/lib/schemas/guide";

export type ResolvedImage = {
  /** A `data:image/png;base64,...` URI react-pdf's <Image src> accepts. */
  dataUri: string;
  /** width / height, so the renderer can size the figure without guessing. */
  ratio: number;
};

const cache = new Map<string, ResolvedImage | null>();

// Map an image-block src to the on-disk raster, or null if it isn't one we embed.
//   /guide-diagrams/<name>.svg → public/guide-diagrams/<name>.webp (the export)
//   /<other root-relative>     → public/<other> (a real committed asset)
// http(s) and empty srcs are skipped (the Library uses neither for diagrams).
function diskPathFor(src: string): string | null {
  if (!src.startsWith("/")) return null; // http(s) or empty → skip
  const rel = src.startsWith("/guide-diagrams/")
    ? src.replace(/\.svg$/, ".webp").replace(/^\//, "")
    : src.replace(/^\//, "");
  return path.join(process.cwd(), "public", rel);
}

async function resolveOne(src: string): Promise<ResolvedImage | null> {
  if (cache.has(src)) return cache.get(src)!;
  let resolved: ResolvedImage | null = null;
  try {
    const file = diskPathFor(src);
    if (file) {
      const input = await readFile(file);
      const png = sharp(input).png();
      const { data, info } = await png.toBuffer({ resolveWithObject: true });
      resolved = {
        dataUri: `data:image/png;base64,${data.toString("base64")}`,
        ratio: info.height > 0 ? info.width / info.height : 1.6,
      };
    }
  } catch {
    // A missing/unreadable raster degrades to caption-only in the renderer —
    // never crash the whole PDF over one diagram.
    resolved = null;
  }
  cache.set(src, resolved);
  return resolved;
}

/**
 * Resolve every diagram image referenced by `blocks` into a src→PNG map. Pass
 * the same accumulator across many lessons (the Field Guide) to share decodes.
 */
export async function resolveLibraryImages(
  blocks: ContentBlock[],
  into: Map<string, ResolvedImage> = new Map(),
): Promise<Map<string, ResolvedImage>> {
  const srcs = blocks
    .filter((b): b is Extract<ContentBlock, { type: "image" }> => b.type === "image")
    .map((b) => b.src)
    .filter((s) => s && !into.has(s));
  await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      const r = await resolveOne(src);
      if (r) into.set(src, r);
    }),
  );
  return into;
}
