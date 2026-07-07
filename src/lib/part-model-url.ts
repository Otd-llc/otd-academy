// Stable, cacheable URL for a part's derived .glb render, served by the
// /api/part-model/[id] proxy. Replaces the per-render presigned R2 URL (fresh
// signature every render → never cache-hit). The `?v` version busts the immutable
// cache when the model is replaced (pass PartAsset.updatedAt, which bumps on a
// replace). Pure — no R2, safe to import anywhere.
export function partModelSrc(
  assetId: string,
  version: Date | number | string,
): string {
  const v = version instanceof Date ? version.getTime() : version;
  return `/api/part-model/${assetId}?v=${v}`;
}
