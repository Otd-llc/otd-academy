// Resolve a Library lesson's diagram image blocks into embeddable PNG data URIs
// for the PDF renderer. Pure node (fs only) — NO runtime image codec.
//
// A Library `image` block's `src` is the diagram REGISTRY KEY
// (`/guide-diagrams/<name>.svg`). The diagram-export pipeline commits an
// indexable `<name>.webp` for the web AND a `<name>.png` sibling for print
// (react-pdf can't embed WebP, and a native transcoder like sharp won't load its
// libvips .so on Vercel's serverless target — ERR_DLOPEN_FAILED). So the PDF
// reads the committed .png directly: no transcode, no native/wasm dependency.
// Dimensions come from the PNG IHDR header. Cached per src so the combined Field
// Guide doesn't re-read a diagram shared across lessons.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentBlock } from "@/lib/schemas/guide";

export type ResolvedImage = {
  /** A `data:image/png;base64,...` URI react-pdf's <Image src> accepts. */
  dataUri: string;
  /** width / height, so the renderer can size the figure without guessing. */
  ratio: number;
};

const cache = new Map<string, ResolvedImage | null>();

// Map an image-block src to the on-disk PNG raster, or null if it isn't one we
// embed. http(s) and empty srcs are skipped (the Library uses neither).
//   /guide-diagrams/<name>.svg → public/guide-diagrams/<name>.png (the export)
//   /<other root-relative>     → public/<other> (a real committed asset)
function diskPathFor(src: string): string | null {
  if (!src.startsWith("/")) return null; // http(s) or empty → skip
  const rel = src.startsWith("/guide-diagrams/")
    ? src.replace(/\.svg$/, ".png").replace(/^\//, "")
    : src.replace(/^\//, "");
  return path.join(process.cwd(), "public", rel);
}

// PNG header: 8-byte signature (0x89 'PNG'...), then the IHDR chunk with width as
// a big-endian uint32 at byte 16 and height at byte 20. Returns null if the file
// isn't a PNG (the caller falls back to a default aspect ratio).
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function resolveOne(src: string): Promise<ResolvedImage | null> {
  if (cache.has(src)) return cache.get(src)!;
  let resolved: ResolvedImage | null = null;
  try {
    const file = diskPathFor(src);
    if (file) {
      const buf = await readFile(file);
      const dim = pngSize(buf);
      resolved = {
        dataUri: `data:image/png;base64,${buf.toString("base64")}`,
        ratio: dim && dim.h > 0 ? dim.w / dim.h : 1.6,
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
 * the same accumulator across many lessons (the Field Guide) to share reads.
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
