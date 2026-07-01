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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
