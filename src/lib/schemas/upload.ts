// Zod schemas for the R2 upload flow (design §7, Phase 10 / M8b).
//
// Two server actions touch this file:
//   - createUploadUrl: client requests a presigned PUT. Validates the upload
//     intent — filename / mime / sizeBytes / owner / stage / subkind.
//   - recordArtifact: client confirms the PUT succeeded and the row should be
//     inserted. Carries the cuid + key + originally-declared metadata back so
//     the server can HEAD-verify against the declared sizeBytes (design §7
//     step 7) and re-check ownerMatches (step 8, defense-in-depth).
//
// 100 MB cap mirrors the design §7 step 3 ceiling; the server enforces it
// again before generating the presigned URL.
import { z } from "zod";
import { ArtifactSubkind, Stage } from "@prisma/client";
// Render primitives come from the neutral leaf module `@/lib/schemas/render`
// (imports nothing back), so the part side and the board/artifact side validate
// `renderBounds` against ONE source of truth. Importing render.ts here is safe —
// it never imports upload.ts, so no init-order cycle is reintroduced.
import { RENDER_MAX_BYTES, renderBoundsSchema } from "@/lib/schemas/render";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

const ownerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("revision"), id: z.cuid() }),
  z.object({ kind: z.literal("build"), id: z.cuid() }),
]);

export const createUploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  sizeBytes: z.int().positive().max(MAX_UPLOAD_BYTES),
  owner: ownerSchema,
  stage: z.enum(Stage),
  subkind: z.enum(ArtifactSubkind),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;

// `recordArtifact` takes the token the server returned from `createUploadUrl`
// plus a user-supplied title. The server re-validates everything against the
// real R2 state (HEAD the key) — we don't trust the token's `sizeBytes` to
// match the actual uploaded bytes.
export const recordArtifactSchema = z.object({
  cuid: z.string().min(1).max(64),
  key: z.string().min(1).max(1024),
  owner: ownerSchema,
  stage: z.enum(Stage),
  subkind: z.enum(ArtifactSubkind),
  title: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(255),
  sizeBytes: z.int().positive().max(MAX_UPLOAD_BYTES),
  filename: z.string().trim().min(1).max(255),
  // Optional derived-.glb render (board stub) — present only when the client's
  // MODEL_3D conversion succeeded. Persisting is best-effort + null-on-failure
  // (mirrors the part side); existing FILE/NOTE/LINK records omit these.
  renderKey: z.string().trim().min(1).max(1024).optional(),
  renderBytes: z.int().positive().max(RENDER_MAX_BYTES).optional(),
  renderBounds: renderBoundsSchema.optional(),
});

export type RecordArtifactInput = z.infer<typeof recordArtifactSchema>;

// Presigned-PUT request for an Artifact's DERIVED .glb render (board stub).
// Kind is implicitly MODEL_3D (only models carry a render); the key is minted
// server-side from owner + stage so this carries only the owner, stage, and the
// render byte size to sign into the PUT ContentLength.
export const createArtifactRenderUploadUrlSchema = z.object({
  owner: ownerSchema,
  stage: z.enum(Stage),
  byteSize: z.int().positive().max(RENDER_MAX_BYTES),
});

export type CreateArtifactRenderUploadUrlInput = z.infer<
  typeof createArtifactRenderUploadUrlSchema
>;
