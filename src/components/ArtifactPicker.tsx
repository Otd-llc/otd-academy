"use client";

// Artifact picker (design §9.1, §9.2, §7).
//
// Per-stage create form for NOTE / LINK / FILE artifacts. Mounted twice:
//   - Revision detail page (owner.kind = "revision"), scoped to
//     STAGES[stage].revisionAllowedArtifactSubkinds.
//   - Build detail page (owner.kind = "build"), scoped to
//     STAGES[stage].buildAllowedArtifactSubkinds.
//
// Three kinds, two submission paths:
//   - NOTE + LINK: form-action submission through createArtifactFormAction.
//     useActionState carries the result back.
//   - FILE: manual three-step sequence. Skip the form action entirely:
//       (a) call createUploadUrl to mint a presigned PUT URL,
//       (b) PUT the bytes directly to R2 from the browser,
//       (c) call recordArtifact so the server HEADs the object and inserts
//           the Artifact row.
//     Each step shows a "WORKING…" disabled state via local React state and
//     surfaces failures via InlineBanner.
//
// BRINGUP_COMPLETE is intentionally absent from buildAllowedArtifactSubkinds
// per design §9.2 — that subkind is created ONLY via the dedicated "Mark
// bring-up complete" button. We additionally filter it out client-side here
// as belt-and-braces, and the server rejects it on the stage-allowed check.
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ArtifactSubkind, Stage } from "@prisma/client";
import {
  createArtifactFormAction,
  type ArtifactFormState,
} from "@/lib/actions/artifacts";
import {
  createUploadUrl,
  recordArtifact,
  createArtifactRenderUploadUrl,
} from "@/lib/actions/uploads";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";
import type { RenderBounds } from "@/lib/schemas/part-asset";
import { STAGES } from "@/lib/stages";
import { InlineBanner } from "@/components/InlineBanner";

type Owner = { kind: "revision" | "build"; id: string };
type Kind = "NOTE" | "LINK" | "FILE";

const initialState: ArtifactFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Add artifact"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

export function ArtifactPicker({
  owner,
  stage,
  onCreated,
}: {
  owner: Owner;
  stage: Stage;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    createArtifactFormAction,
    initialState,
  );
  const [kind, setKind] = useState<Kind>("NOTE");
  const [preview, setPreview] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  // FILE-branch local state. Distinct from useActionState so the two
  // submission paths don't fight each other.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subkindSelectRef = useRef<HTMLSelectElement>(null);
  const [fileStatus, setFileStatus] = useState<
    "idle" | "presigning" | "uploading" | "recording"
  >("idle");
  const [fileError, setFileError] = useState<string | null>(null);

  const allAllowed =
    owner.kind === "revision"
      ? STAGES[stage].revisionAllowedArtifactSubkinds
      : STAGES[stage].buildAllowedArtifactSubkinds;
  // Belt-and-braces: filter out BRINGUP_COMPLETE — it's never picker-created
  // per design §9.2 (and not currently in any allowed-list either; this is
  // defensive for the case where the const is later edited carelessly).
  const allowedSubkinds = allAllowed.filter(
    (s) => s !== ("BRINGUP_COMPLETE" satisfies ArtifactSubkind),
  );

  // Clear local form state + fire onCreated callback when a NOTE/LINK
  // create succeeds.
  useEffect(() => {
    if (state.createdId) {
      setNoteBody("");
      setPreview(false);
      onCreated?.();
    }
  }, [state.createdId, onCreated]);

  if (allowedSubkinds.length === 0) {
    // No subkinds allowed for this owner-kind at this stage — render nothing
    // so the surrounding pane can show its own empty/placeholder copy.
    return null;
  }

  // ─── FILE upload handler ─────────────────────────────
  // Not wired through the `<form action>` because:
  //   1. The form action returns plain serializable state via useActionState,
  //      which doesn't let us interleave a fetch() to R2 mid-action.
  //   2. We need finer-grained loading states ("presigning" / "uploading" /
  //      "recording") so the user knows where in the three-step flow they are.
  async function handleFileSubmit() {
    setFileError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFileError("Pick a file first.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(
        `File too large: ${file.size} bytes exceeds ${MAX_UPLOAD_BYTES}.`,
      );
      return;
    }

    const title = (titleInputRef.current?.value ?? "").trim();
    if (!title) {
      setFileError("Title is required.");
      return;
    }

    const subkind = (subkindSelectRef.current?.value ?? "") as ArtifactSubkind;
    if (!subkind) {
      setFileError("Pick a subkind.");
      return;
    }

    const mime = file.type || "application/octet-stream";
    const sizeBytes = file.size;
    const filename = file.name;

    try {
      // Step 1: presign.
      setFileStatus("presigning");
      const token = await createUploadUrl({
        filename,
        mime,
        sizeBytes,
        owner,
        stage,
        subkind,
      });

      // Step 2: PUT direct to R2.
      setFileStatus("uploading");
      const putRes = await fetch(token.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(sizeBytes),
        },
      });
      if (!putRes.ok) {
        throw new Error(
          `R2 upload failed: ${putRes.status} ${putRes.statusText}`,
        );
      }

      // Step 2.5 (board stub): MODEL_3D only — derive a .glb render in-browser
      // (best-effort). Heavy occt/three deps code-split via the dynamic import
      // inside convertToGlb. The WHOLE branch is wrapped in try/catch and
      // swallows to `render = {}` — a chunk-load, conversion, presign, render
      // PUT, or network failure is NON-FATAL: the FILE artifact still records
      // download-only. All other subkinds/kinds are unchanged.
      let render: {
        renderKey?: string;
        renderBytes?: number;
        renderBounds?: RenderBounds;
      } = {};
      if (subkind === "MODEL_3D") {
        try {
          const file3d = file; // narrow capture for the async branch
          const { convertToGlb } = await import("@/lib/model-convert");
          const converted = await convertToGlb(file3d);
          if (converted) {
            const r = await createArtifactRenderUploadUrl({
              owner,
              stage,
              byteSize: converted.glb.size,
            });
            const putR = await fetch(r.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": r.contentType },
              body: converted.glb,
            });
            if (putR.ok) {
              render = {
                renderKey: r.renderKey,
                renderBytes: converted.glb.size,
                renderBounds: converted.bounds,
              };
            }
          }
        } catch {
          // Any render-path failure is NON-FATAL — fall through with render = {}
          // so the source artifact still records. Curation can't be blocked by
          // the derived render.
          render = {};
        }
      }

      // Step 3: record (server HEADs + inserts row).
      setFileStatus("recording");
      await recordArtifact({
        cuid: token.cuid,
        key: token.key,
        owner: token.owner,
        stage: token.stage as Stage,
        subkind: token.subkind as ArtifactSubkind,
        title,
        mime,
        sizeBytes,
        filename,
        ...render,
      });

      // Reset form + refresh.
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (titleInputRef.current) titleInputRef.current.value = "";
      setFileStatus("idle");
      onCreated?.();
      router.refresh();
    } catch (err) {
      setFileStatus("idle");
      setFileError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  const fileBusy = fileStatus !== "idle";

  return (
    <form
      action={kind === "FILE" ? undefined : action}
      onSubmit={
        kind === "FILE"
          ? (e) => {
              e.preventDefault();
              void handleFileSubmit();
            }
          : undefined
      }
      className="space-y-3 font-mono text-sm text-link-muted"
    >
      <input type="hidden" name="ownerKind" value={owner.kind} />
      <input type="hidden" name="ownerId" value={owner.id} />
      <input type="hidden" name="stage" value={stage} />

      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}
      {fileError && (
        <InlineBanner variant="error">{fileError}</InlineBanner>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Subkind
          </label>
          <select
            ref={subkindSelectRef}
            name="subkind"
            defaultValue={allowedSubkinds[0]}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            {allowedSubkinds.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError messages={state.errors?.subkind} />
        </div>

        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Kind
          </label>
          <div className="mt-1 flex gap-3 font-mono text-xs uppercase tracking-wider text-link-muted">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="kind"
                value="NOTE"
                checked={kind === "NOTE"}
                onChange={() => setKind("NOTE")}
              />
              NOTE
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="kind"
                value="LINK"
                checked={kind === "LINK"}
                onChange={() => setKind("LINK")}
              />
              LINK
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="kind"
                value="FILE"
                checked={kind === "FILE"}
                onChange={() => setKind("FILE")}
              />
              FILE
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Title
        </label>
        <input
          ref={titleInputRef}
          name="title"
          required
          maxLength={200}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.title} />
      </div>

      {kind === "NOTE" ? (
        <div>
          <div className="flex items-center justify-between">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Note (markdown)
            </label>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-link-muted hover:border-command-gold"
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <pre className="mt-1 max-h-60 w-full overflow-auto rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-sm text-link-muted whitespace-pre-wrap">
              {noteBody || "(empty)"}
            </pre>
          ) : (
            <textarea
              name="noteBody"
              required
              rows={6}
              maxLength={50_000}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
          )}
          <FieldError messages={state.errors?.noteBody} />
        </div>
      ) : kind === "LINK" ? (
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Link URL
          </label>
          <input
            name="linkUrl"
            type="url"
            required
            maxLength={2048}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.linkUrl} />
        </div>
      ) : (
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            File (≤ 100 MB)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            required
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted file:mr-3 file:rounded file:border-0 file:bg-navy-dark file:px-2 file:py-1 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-command-gold"
          />
        </div>
      )}

      <div>
        {kind === "FILE" ? (
          <button
            type="submit"
            disabled={fileBusy}
            className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
          >
            {fileStatus === "presigning"
              ? "WORKING… (presigning)"
              : fileStatus === "uploading"
                ? "WORKING… (uploading)"
                : fileStatus === "recording"
                  ? "WORKING… (recording)"
                  : "Add artifact"}
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}
