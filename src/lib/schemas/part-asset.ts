import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

export const PART_ASSET_KINDS = ["SYMBOL", "FOOTPRINT", "MODEL_3D"] as const;
export type PartAssetKindT = (typeof PART_ASSET_KINDS)[number];

/** Per-kind upload policy: allowed extensions, the SERVER-FORCED content-type
 *  (signed into the PUT + echoed by the client), and the size cap. KiCad files
 *  report an empty browser `file.type`, so we validate by EXTENSION and force
 *  the content-type ourselves. */
export const ASSET_KIND_CONFIG: Record<
  PartAssetKindT,
  { exts: readonly string[]; contentType: string; maxBytes: number; label: string }
> = {
  SYMBOL:    { exts: [".kicad_sym"], contentType: "text/plain",               maxBytes: 5 * 1024 * 1024, label: "Symbol" },
  FOOTPRINT: { exts: [".kicad_mod"], contentType: "text/plain",               maxBytes: 5 * 1024 * 1024, label: "Footprint" },
  MODEL_3D:  { exts: [".step", ".stp", ".wrl"], contentType: "application/octet-stream", maxBytes: MAX_UPLOAD_BYTES, label: "3D Model" },
};

/** Lowercased extension incl. the dot, e.g. "ESP32.STEP" → ".step". "" if none. */
export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i).toLowerCase();
}

export function isExtAllowed(kind: PartAssetKindT, filename: string): boolean {
  return ASSET_KIND_CONFIG[kind].exts.includes(extOf(filename));
}

export const createPartAssetUploadUrlSchema = z
  .object({
    partId: z.cuid(),
    kind: z.enum(PART_ASSET_KINDS),
    filename: z.string().trim().min(1).max(255),
    byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
  })
  .superRefine((v, ctx) => {
    const cfg = ASSET_KIND_CONFIG[v.kind];
    if (!isExtAllowed(v.kind, v.filename)) {
      ctx.addIssue({ code: "custom", path: ["filename"],
        message: `${v.kind} must be one of: ${cfg.exts.join(", ")}` });
    }
    if (v.byteSize > cfg.maxBytes) {
      ctx.addIssue({ code: "custom", path: ["byteSize"],
        message: `${v.kind} exceeds the ${Math.round(cfg.maxBytes / 1024 / 1024)} MB cap.` });
    }
  });

export const recordPartAssetSchema = z.object({
  partId: z.cuid(),
  kind: z.enum(PART_ASSET_KINDS),
  r2Key: z.string().trim().min(1).max(1024),
  filename: z.string().trim().min(1).max(255),
  byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
});

/** Metadata edit (no file). `.strict()` so a typo'd key is rejected, not dropped. */
export const editPartAssetSchema = z
  .object({
    id: z.cuid(),
    updatedAt: z.coerce.date(),
    ref: z.string().trim().max(200).optional(),
    source: z.string().trim().max(200).optional(),
    license: z.string().trim().max(200).optional(),
  })
  .strict();

/** Pure auto-demote decision: a `ref` OR `source` change demotes a VERIFIED
 *  asset; a `license`-only change does NOT (cosmetic). Mirrors fact shouldDemote. */
export function shouldDemoteAsset(
  stored: { ref: string | null; source: string | null },
  next: { ref?: string | null; source?: string | null },
): boolean {
  const norm = (s: string | null | undefined) => (s == null || s === "" ? null : s);
  return norm(stored.ref) !== norm(next.ref) || norm(stored.source) !== norm(next.source);
}
