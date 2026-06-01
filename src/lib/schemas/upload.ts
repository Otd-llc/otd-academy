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
});

export type RecordArtifactInput = z.infer<typeof recordArtifactSchema>;
