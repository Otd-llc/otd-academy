// /library/[slug]/pdf — a shareable, print-faithful PDF of a single Library
// reference guide, rendered server-side from the LIVE content blocks (the same
// data the HTML page renders), so the PDF never drifts from the page. The "share"
// affordance on the lesson page is just a link here; this URL is the artifact.
//
// noindex (X-Robots-Tag): the HTML page is canonical for search; the PDF is a
// duplicate convenience copy, so we keep it out of the index.
import { renderToBuffer } from "@react-pdf/renderer";
import { loadPublicMiniLesson } from "@/lib/library/load";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import { resolveLibraryImages } from "@/lib/pdf/library-images";
import { registerLibraryFonts } from "@/lib/pdf/library-fonts";
import { LibraryPdf } from "@/lib/pdf/library-pdf";

// Reads no session at all, so unlike the field-guide books this one IS cacheable —
// but the caching lives in loadPublicMiniLesson (`use cache`, tagged
// `mini-lesson-${slug}`), NOT on this handler. Two reasons:
//   • The DB read is the metric this migration exists to cut, and it is now cached
//     and tag-invalidated: a content edit fires revalidateTag, so the next request
//     renders a fresh PDF. No staleness window beyond the loader's.
//   • Wrapping the handler itself would put a `Response` across the cache boundary,
//     and whether Next serializes one is not an assumption worth making (same
//     reasoning as the Map in library/load.ts).
// The react-pdf render therefore still runs per request. That is Vercel compute,
// not Neon egress, so it is not what this work is optimizing.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const lesson = await loadPublicMiniLesson(slug);
  if (!lesson) return new Response("Not found", { status: 404 });

  const parsed = guideContentBlocksSchema.safeParse(lesson.contentBlocks);
  const blocks = filterLibraryBlocks(parsed.success ? parsed.data : []);
  const images = await resolveLibraryImages(blocks);

  registerLibraryFonts();
  const buffer = await renderToBuffer(
    <LibraryPdf
      lesson={{
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        byline: lesson.byline,
        updatedAt: lesson.updatedAt,
        blocks,
      }}
      images={images}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="otd-${lesson.slug}.pdf"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
