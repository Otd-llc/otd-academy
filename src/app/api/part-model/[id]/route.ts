// Public 3D-model proxy — streams a part's derived .glb render from R2 at a
// STABLE, cacheable URL (keyed by PartAsset.id), so <ModelViewer> loads it once
// and the browser/CDN cache it. This replaces the per-render presigned URL, whose
// signature changed every render and defeated caching entirely. Public (exempted
// from the auth middleware in src/proxy.ts) because 3D models render on public
// lessons for signed-out visitors, and the geometry is non-sensitive.
//
// A `?v=<PartAsset.updatedAt epoch>` cache-buster rides in from the caller
// (partModelSrc); it bumps on a model replace, so the response is safely
// immutable. 404 when R2 is off, the asset is unknown, or it has no render.
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";
import { getR2ObjectBytes } from "@/lib/part-r2";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await db.partAsset
    .findUnique({
      where: { id },
      select: { renderKey: true, renderMime: true },
    })
    .catch(() => null);
  if (!asset?.renderKey) {
    return new Response("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getR2ObjectBytes(asset.renderKey);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.renderMime ?? "model/gltf-binary",
      "Content-Length": String(bytes.byteLength),
      // ?v busts on replace, so the render is immutable for a given URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
