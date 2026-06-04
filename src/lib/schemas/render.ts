import { z } from "zod";

/** Forced content-type for a derived .glb render. */
export const RENDER_MIME = "model/gltf-binary";

/** Size cap for a derived render .glb. Mirrors MAX_UPLOAD_BYTES (the upload
 *  cap) but is kept as a literal here so this leaf module imports nothing —
 *  importing MAX_UPLOAD_BYTES from upload.ts would re-introduce the cycle. */
export const RENDER_MAX_BYTES = 100 * 1024 * 1024;

/** Bounding sphere the viewer uses to frame the camera. */
export const renderBoundsSchema = z.object({
  center: z.tuple([z.number(), z.number(), z.number()]),
  radius: z.number().positive(),
});
export type RenderBounds = z.infer<typeof renderBoundsSchema>;
