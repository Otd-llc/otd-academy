"use client";

// Avatar uploader for /account. Pick an image → interactive crop (react-easy-crop:
// drag + zoom, round mask, 1:1) → the confirmed crop is drawn to a 256px webp on
// the client, presigned, and PUT straight to R2, then the user is marked as having
// a custom avatar (server action). A local object-URL gives instant preview;
// router.refresh() then pulls the persisted /api/avatar/{id} URL through the layout
// so the header menu updates too.

import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAvatarUploadUrl,
  saveAvatar,
  removeAvatar,
} from "@/lib/actions/avatar";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

/** Draw the chosen crop region (natural-pixel Area from react-easy-crop) into a
 *  size×size square and encode webp. */
async function getCroppedWebp(
  src: string,
  area: Area,
  size = 256,
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/webp",
      0.9,
    ),
  );
}

const BTN =
  "inline-flex items-center gap-2 rounded-md border border-command-gold px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:outline-none focus-visible:bg-command-gold focus-visible:text-deep-space disabled:opacity-50";
const BTN_QUIET =
  "inline-flex items-center gap-2 rounded-md border border-panel-border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-command-gold hover:text-gold-light disabled:opacity-50";

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

  // crop modal
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setImageSrc(URL.createObjectURL(file));
    if (inputRef.current) inputRef.current.value = "";
  }

  function closeModal() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
  }

  async function onSave() {
    if (!imageSrc || !area) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getCroppedWebp(imageSrc, area);
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
      setPreview(URL.createObjectURL(blob));
      setShowRemove(true);
      closeModal();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
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
          onChange={pick}
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
            <button type="button" disabled={busy} onClick={onRemove} className={BTN_QUIET}>
              Remove
            </button>
          ) : null}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-gray-3">
          Drag to reposition · scroll or pinch to zoom · cropped to a 256px square
        </p>
        {error ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-alert-red">
            {error}
          </p>
        ) : null}
      </div>

      {imageSrc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-deep-space/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Crop your avatar"
        >
          <div className="w-full max-w-sm rounded-lg border border-panel-border bg-deep-space p-5 shadow-[var(--elev-card)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
              ▸ Crop avatar
            </p>
            <div className="relative mt-3 h-[300px] w-full overflow-hidden rounded-md border border-panel-border/70 bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setArea(px)}
              />
            </div>
            <label className="mt-4 flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-command-gold"
                aria-label="Zoom"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" disabled={busy} onClick={closeModal} className={BTN_QUIET}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !area}
                onClick={onSave}
                className="inline-flex items-center gap-2 rounded-md border border-command-gold bg-command-gold px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-deep-space transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save avatar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
