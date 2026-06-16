// The downloadable PDF certificate. GET → verifies the signed token → renders the
// premium @react-pdf document to a buffer. Node runtime (react-pdf needs Node).
// A bad/forged token → 404 (nothing to certify).
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { verifyCardToken } from "@/lib/certificate-token";
import { certificateId } from "@/lib/certificate-id";
import { CertificatePdf } from "@/lib/pdf/certificate-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  const { token } = await params;
  const claims = verifyCardToken(token);
  if (!claims) return new Response("Not found", { status: 404 });

  let board = "a real board";
  try {
    const project = await db.project.findUnique({
      where: { slug: claims.slug },
      select: { name: true },
    });
    if (project?.name) board = project.name;
  } catch {
    // keep the fallback — a transient DB error must not 500 a credential download
  }

  const buffer = await renderToBuffer(
    <CertificatePdf claims={claims} board={board} certId={certificateId(token)} />,
  );

  const filename = `otd-certificate-${claims.slug}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
