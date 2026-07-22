// Stable, cacheable URL for a part's derived .glb render. Two modes:
//
//   • NEXT_PUBLIC_R2_PUBLIC_BASE_URL set (audit Phase 9, R2 custom domain
//     provisioned) → the DIRECT R2 object URL. Zero Vercel egress, zero fn
//     time — R2 egress is free, and a BOM card can float one .glb per row.
//   • unset → the /api/part-model/[id] proxy (the original behaviour), which
//     replaced the per-render presigned URL (fresh signature every render →
//     never cache-hit).
//
// The `?v` version busts the immutable cache when the model is replaced (pass
// PartAsset.updatedAt, which bumps on a replace). Pure — no R2 calls, safe to
// import anywhere (the env value is a public URL).
import { env } from "@/env";

export function partModelSrc(
  assetId: string,
  version: Date | number | string,
  /** PartAsset.renderKey — enables the direct-R2 mode when the public base is
   *  configured. Omitted (or null) → proxy URL. */
  renderKey?: string | null,
): string {
  const v = version instanceof Date ? version.getTime() : version;
  const base = env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (base && renderKey) {
    return `${base.replace(/\/$/, "")}/${renderKey}?v=${v}`;
  }
  return `/api/part-model/${assetId}?v=${v}`;
}
