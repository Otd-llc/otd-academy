// /library/field-guide/[cluster]/pdf — one Library CLUSTER as its own downloadable
// book: cover, table of contents, then every published guide in that cluster,
// with the cluster's own chrome (cover label, running header, intro/outro, part
// dividers). Built server-side from live content (no drift). The combined
// all-clusters book lives at the sibling static `field-guide/pdf` route.
//
// TRACING: this dynamic path is registered in next.config.ts
// `outputFileTracingIncludes` (LIBRARY_PDF_TRACE) so the bundled fonts +
// public/guide-diagrams ship with the serverless function; without that entry it
// 500s on a missing font in prod (dev masks it with on-disk files).
import { renderToBuffer } from "@react-pdf/renderer";
import { loadPublicLibraryForBook } from "@/lib/library/load";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import { resolveLibraryImages, type ResolvedImage } from "@/lib/pdf/library-images";
import { registerLibraryFonts } from "@/lib/pdf/library-fonts";
import { FieldGuidePdf, type LibraryPdfLesson } from "@/lib/pdf/library-pdf";
import { FIELD_GUIDE_CHROME } from "@/lib/pdf/field-guide-chrome";
import { clusterByKey } from "@/lib/library/clusters";
import { isFieldGuideAuthorized, fieldGuideGateRedirect } from "@/lib/library/field-guide-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cluster: string }> },
) {
  const { cluster } = await params;
  // Unknown cluster (no registry entry OR no chrome) → 404 before any DB work, so
  // the route can never render the wrong book's cover/intro.
  const chrome = FIELD_GUIDE_CHROME[cluster];
  if (!clusterByKey(cluster) || !chrome) {
    return new Response("Not found", { status: 404 });
  }

  // Account-gated (free): a signed-in session, or a valid emailed token for THIS
  // cluster. Unauthorized direct hits bounce to the Library signup prompt.
  if (!(await isFieldGuideAuthorized(req, cluster))) {
    return fieldGuideGateRedirect(req, cluster);
  }

  const rows = await loadPublicLibraryForBook(cluster);
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

  // Honest "reviewed <month year>" from the freshest lesson edit in this cluster.
  const freshest = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt;
  const reviewed = freshest.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  registerLibraryFonts();
  const buffer = await renderToBuffer(
    <FieldGuidePdf lessons={lessons} images={images} reviewed={reviewed} chrome={chrome} />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // `?download=1` (the lead-magnet welcome auto-download) saves the file
      // instead of opening it inline, so the tab stays free to onboard.
      "Content-Disposition": `${new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="otd-academy-${cluster}-field-guide.pdf"`,
      // Per-user (session/token gated) → never let a shared cache hold it.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
