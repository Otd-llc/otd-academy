// Public download proxy for the hex-cluster printables — streams an object from
// R2 at a stable, cacheable URL. Mirrors `/api/part-model/[id]`, and exists for
// the same reason: the R2 custom domain (NEXT_PUBLIC_R2_PUBLIC_BASE_URL) is a
// Cloudflare + DNS change, and without it a CC BY release has no way to be
// downloaded at all. When that domain lands, `printable-url.ts` switches to
// direct-R2 URLs and this route simply stops being used.
//
// PUBLIC by design. The release is CC BY 4.0 and deliberately ungated: lead
// capture belongs on the configurator ("save your build"), not on the download.
// Exempted from the auth middleware in `src/proxy.ts`.
//
// Traversal is structurally impossible rather than filtered — see
// `@/lib/printable-key`, which rebuilds every key from validated tokens.
import type { NextRequest } from "next/server";

import { env } from "@/env";
import { getR2ObjectBytes } from "@/lib/part-r2";
import { PRINTABLE_CONTENT_TYPE, resolvePrintable } from "@/lib/printable-key";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  const resolved = resolvePrintable(path ?? []);
  if (!resolved) return new Response("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getR2ObjectBytes(resolved.key);
  } catch {
    // Absent object, or R2 unreachable. A 404 is the honest answer either way:
    // the release either is not published yet or that part is not in it.
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        PRINTABLE_CONTENT_TYPE[resolved.ext] ?? "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      // Attachment, not inline: a browser handed a .stl or a .txt otherwise
      // renders or displays it, and the point of the link is a file on disk.
      "Content-Disposition": `attachment; filename="${resolved.filename}"`,
      // The release segment is immutable by construction (re-cutting the meshes
      // mints a NEW release), so a year is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
