// Public download URLs for the hex-cluster printables. Two modes, exactly like
// `part-model-url.ts`:
//
//   • NEXT_PUBLIC_R2_PUBLIC_BASE_URL set (R2 custom domain provisioned) → the
//     DIRECT R2 object URL. Zero Vercel egress, zero function time.
//   • unset → the `/api/printable/...` proxy, which streams the object from R2
//     through a Vercel function. Metered egress, but downloads WORK.
//
// The second mode is why this file exists. The custom domain is a Cloudflare +
// DNS change nobody in the codebase can make, and gating the whole download
// section on it meant a CC BY release with no way to get the files. The repo
// already solved this shape once for part models; this is the same solution.
//
// Pure: no R2 calls, no secrets. The env value is a public URL, so this is safe
// to import from a client component.
import { env } from "@/env";
import { printableLicenseKey, printableSetKey } from "@/lib/r2";

/** Direct-R2 when configured, proxy otherwise. `key` is an R2 object key. */
function publicUrl(key: string, proxyPath: string): string {
  const base = env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  return proxyPath;
}

/** The complete-set archive (3MF + STL + README + LICENSE). */
export function printableSetUrl(release: string, set: string): string {
  return publicUrl(
    printableSetKey(release, set),
    `/api/printable/${release}/sets/${set}.zip`,
  );
}

/** The standalone CC BY notice that sits beside the meshes. */
export function printableLicenseUrl(release: string): string {
  return publicUrl(
    printableLicenseKey(release),
    `/api/printable/${release}/LICENSE.txt`,
  );
}
