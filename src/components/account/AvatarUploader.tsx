"use client";

// Avatar uploader for /account. Picks an image, center-crops it to a 256px square
// webp on the client, presigns a PUT, uploads straight to R2, then marks the user
// as having a custom avatar (server action). A local object-URL gives instant
// preview; router.refresh() then pulls the persisted /api/avatar/{id} URL through
// the layout so the header menu updates too.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAvatarUploadUrl,
  saveAvatar,
  removeAvatar,
} from "@/lib/actions/avatar";

function cropToWebp(file: File, size = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
        "image/webp",
        0.9,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

const BTN =
  "inline-flex items-center gap-2 rounded-md border border-command-gold px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:outline-none focus-visible:bg-command-gold focus-visible:text-deep-space disabled:opacity-50";

export function AvatarUploader({
  current,
  initial,
  hasCustom,
}: {
  current: string | null;
  initial: string;
  hasCustom: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [showRemove, setShowRemove] = useState(hasCustom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await cropToWebp(file);
      setPreview(URL.createObjectURL(blob));
      const { uploadUrl, contentType } = await createAvatarUploadUrl({
        byteSize: blob.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!put.ok) throw new Error("Upload failed. Try again.");
      await saveAvatar({ byteSize: blob.size });
      setShowRemove(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(current);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeAvatar();
      setPreview(null);
      setShowRemove(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not remove the avatar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-5">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          referrerPolicy="no-referrer"
          className="h-20 w-20 rounded-full border border-command-gold object-cover"
        />
      ) : (
        <span className="grid h-20 w-20 place-items-center rounded-full border border-command-gold bg-command-gold/10 font-numeral text-3xl font-bold text-command-gold">
          {initial}
        </span>
      )}

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={BTN}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Working…" : hasCustom || showRemove ? "Change avatar" : "Upload avatar"}
          </button>
          {showRemove ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="inline-flex items-center gap-2 rounded-md border border-panel-border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-command-gold hover:text-gold-light disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-gray-3">
          Square, cropped to 256px · JPG / PNG / WebP
        </p>
        {error ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-alert-red">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
