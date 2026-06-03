// Zod schemas for the PartDatasheet upload flow (design §3.1 / Stage A Task 9).
//
// Mirrors `schemas/upload.ts` but PART-scoped: the cached datasheet is net-new
// infra (`PartDatasheet`), NOT the revision/build-scoped `Artifact` model. Two
// server actions in `actions/part-datasheet.ts` touch this file:
//   - createPartDatasheetUploadUrl: client requests a presigned PUT. Validates
//     the intent — partId / filename / byteSize / contentType. Datasheets are
//     PDF-only, so contentType is constrained to `application/pdf`.
//   - recordPartDatasheet: client confirms the PUT succeeded; server HEADs the
//     key and upserts the row (partId is @unique — one cached PDF per part).
//
// The 100 MB ceiling is reused from the upload pipeline (design §7 step 3) so
// the cap is identical to revision/build artifacts.
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

// Datasheets are PDFs only — this both narrows the presigned ContentType and
// lets us name the key `…/datasheet-<id>.pdf` with confidence.
export const DATASHEET_CONTENT_TYPE = "application/pdf";

export const createPartDatasheetUploadUrlSchema = z.object({
  partId: z.cuid(),
  filename: z.string().trim().min(1).max(255),
  byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
  contentType: z.literal(DATASHEET_CONTENT_TYPE),
});

export type CreatePartDatasheetUploadUrlInput = z.infer<
  typeof createPartDatasheetUploadUrlSchema
>;

// `recordPartDatasheet` takes the `r2Key` the server minted in
// createPartDatasheetUploadUrl plus the declared filename / byteSize. The
// server re-validates against real R2 state (HEAD the key) before upserting —
// we don't trust the client's `byteSize` to match the uploaded bytes.
export const recordPartDatasheetSchema = z.object({
  partId: z.cuid(),
  r2Key: z.string().trim().min(1).max(1024),
  filename: z.string().trim().min(1).max(255),
  byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
});

export type RecordPartDatasheetInput = z.infer<typeof recordPartDatasheetSchema>;
