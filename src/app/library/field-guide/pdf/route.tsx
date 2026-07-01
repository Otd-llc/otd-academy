// /library/field-guide/pdf — the WHOLE Library as one downloadable book: a cover,
// a table of contents, then every published reference guide back-to-back. Built
// server-side from live content (no drift), shared across the diagram decodes so
// a diagram used in two lessons is transcoded once.
//
// `field-guide` is a static sibling of the `[slug]` segment (static wins in
// Next routing), so this never collides with a real lesson slug.
import { renderToBuffer } from "@react-pdf/renderer";
import { loadPublicLibraryForBook } from "@/lib/library/load";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import { resolveLibraryImages, type ResolvedImage } from "@/lib/pdf/library-images";
import { registerLibraryFonts } from "@/lib/pdf/library-fonts";
import { FieldGuidePdf, type LibraryPdfLesson } from "@/lib/pdf/library-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await loadPublicLibraryForBook();
  if (rows.length === 0) return new Response("Not found", { status: 404 });

  const images = new Map<string, ResolvedImage>();
  const lessons: LibraryPdfLesson[] = [];
  for (const r of rows) {
    const parsed = guideContentBlocksSchema.safeParse(r.contentBlocks);
    const blocks = filterLibraryBlocks(parsed.success ? parsed.data : []);
    await resolveLibraryImages(blocks, images);
    lessons.push({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      byline: r.byline,
      updatedAt: r.updatedAt,
      blocks,
    });
  }

  // Honest "reviewed <month year>" from the freshest lesson edit.
  const freshest = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt;
  const reviewed = freshest.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  registerLibraryFonts();
  const buffer = await renderToBuffer(
    <FieldGuidePdf lessons={lessons} images={images} reviewed={reviewed} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="otd-academy-field-guide.pdf"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
