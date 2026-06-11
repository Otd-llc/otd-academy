"use client";

// Admin-only in-app media capture for an empty-src image OR video placeholder.
//
// A web page CAN'T draw a frame over other apps (sandbox), so the framing happens
// on the IN-PAGE preview: getDisplayMedia → live preview with an aspect-locked,
// drag/resize crop box → arrange the target window to fill the box → SPACEBAR to
// grab a still / start-stop a clip of the BOXED region → review (approve/redo) →
// crop + encode (WebP still · WebM/MP4 clip via the OTD recorder, with the duration
// fixes) → presigned PUT to R2 → set the block's src + caption → refresh.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createGuideShotUploadUrl,
  setGuideBlockMedia,
} from "@/lib/actions/guide-images";
import { StreamRecorder, type RecordResult } from "@/lib/record-stream";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 0.9;
const ASPECTS = [
  { label: "16:10", value: 16 / 10 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "Free", value: 0 },
];

const BTN =
  "inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold";

type Phase = "prep" | "live" | "recording" | "review" | "saving";
type Box = { x: number; y: number; w: number; h: number };
type Rect = { sx: number; sy: number; sw: number; sh: number; outW: number; outH: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Box (CSS px over the preview) → native source rect, output capped to MAX_WIDTH.
function nativeRect(video: HTMLVideoElement, box: Box): Rect {
  const scaleX = video.videoWidth / video.clientWidth;
  const scaleY = video.videoHeight / video.clientHeight;
  const sw = box.w * scaleX;
  const sh = box.h * scaleY;
  const outW = Math.max(1, Math.min(Math.round(sw), MAX_WIDTH));
  const outH = Math.max(1, Math.round(sh * (outW / sw)));
  return { sx: box.x * scaleX, sy: box.y * scaleY, sw, sh, outW, outH };
}

export function MediaCapture({
  kind,
  cardId,
  blockIndex,
  captureHint,
  caption: initialCaption,
}: {
  kind: "image" | "video";
  cardId: string;
  blockIndex: number;
  captureHint?: string;
  caption?: string;
}) {
  const isVideo = kind === "video";
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("prep");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState(initialCaption || captureHint || "");
  const [aspect, setAspect] = useState(16 / 10);
  const [box, setBox] = useState<Box | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const blobRef = useRef<Blob | null>(null);
  const extRef = useRef<"webp" | "webm" | "mp4">("webp");
  const recorderRef = useRef<StreamRecorder | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const recRectRef = useRef<Rect | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; x: number; y: number; box: Box } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.srcObject = stream;
      void v.play().catch(() => {});
    }
    return () => {
      if (v) v.srcObject = null;
    };
  }, [stream]);

  // Spacebar drives capture (but not while typing the caption).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (phase === "live") {
        e.preventDefault();
        if (isVideo) startRecording();
        else captureFrame();
      } else if (phase === "recording") {
        e.preventDefault();
        void stopRecording();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, isVideo]);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function stopRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }
  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }
  function cleanup() {
    clearTimer();
    stopRaf();
    recorderRef.current = null;
    recRectRef.current = null;
    cropCanvasRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setBox(null);
    setPhase("prep");
    setError(null);
  }
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) cleanup();
    else setCaption(initialCaption || captureHint || "");
  }

  // Center a default box at the current aspect once the video has real dimensions.
  function initBox() {
    const v = videoRef.current;
    if (!v || !v.clientWidth) return;
    const W = v.clientWidth;
    const H = v.clientHeight;
    let w = Math.round(W * 0.75);
    let h = aspect > 0 ? w / aspect : Math.round(H * 0.75);
    if (h > H * 0.9) {
      h = H * 0.9;
      if (aspect > 0) w = h * aspect;
    }
    setBox({ x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h });
  }

  function changeAspect(a: number) {
    setAspect(a);
    setBox((b) => {
      if (!b || a <= 0) return b;
      const v = videoRef.current;
      const maxH = v ? v.clientHeight : b.y + b.h;
      let h = b.w / a;
      if (b.y + h > maxH) h = maxH - b.y;
      return { ...b, h };
    });
  }

  function onBoxPointerDown(e: React.PointerEvent) {
    if (!box) return;
    const isHandle = (e.target as HTMLElement).dataset.handle === "br";
    dragRef.current = { mode: isHandle ? "resize" : "move", x: e.clientX, y: e.clientY, box };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onBoxPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const v = videoRef.current;
    if (!d || !v) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const W = v.clientWidth;
    const H = v.clientHeight;
    if (d.mode === "move") {
      setBox({
        ...d.box,
        x: clamp(d.box.x + dx, 0, W - d.box.w),
        y: clamp(d.box.y + dy, 0, H - d.box.h),
      });
    } else {
      let w = clamp(d.box.w + dx, 48, W - d.box.x);
      let h = aspect > 0 ? w / aspect : clamp(d.box.h + dy, 48, H - d.box.y);
      if (aspect > 0 && d.box.y + h > H) {
        h = H - d.box.y;
        w = h * aspect;
      }
      setBox({ ...d.box, w, h });
    }
  }
  function onBoxPointerUp(e: React.PointerEvent) {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  async function startCapture() {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("This browser can't capture the screen here — use desktop Chrome, Edge, or Firefox.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: isVideo ? 30 : 8 },
        audio: false,
      });
      s.getVideoTracks()[0]?.addEventListener("ended", () =>
        setPhase((p) => (p === "live" ? "prep" : p)),
      );
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setStream(s);
      setPhase("live");
    } catch {
      setPhase("prep");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !box) return;
    const r = nativeRect(video, box);
    const canvas = document.createElement("canvas");
    canvas.width = r.outW;
    canvas.height = r.outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
    stopStream();
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't encode the capture — try again.");
          setPhase("prep");
          return;
        }
        blobRef.current = blob;
        extRef.current = "webp";
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("review");
      },
      "image/webp",
      WEBP_QUALITY,
    );
  }

  function startRecording() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !box) return;
    const r = nativeRect(video, box);
    recRectRef.current = r;
    const canvas = document.createElement("canvas");
    canvas.width = r.outW;
    canvas.height = r.outH;
    cropCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    try {
      const rec = new StreamRecorder(canvas.captureStream(30));
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setPhase("recording");
    } catch (e) {
      stopRaf();
      setError(e instanceof Error ? e.message : "Couldn't start recording.");
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    clearTimer();
    try {
      const result: RecordResult = await rec.stop();
      stopRaf();
      stopStream();
      blobRef.current = result.blob;
      extRef.current = result.ext;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(result.blob));
      setPhase("review");
    } catch (e) {
      stopRaf();
      setError(e instanceof Error ? e.message : "Recording failed.");
      setPhase("prep");
    } finally {
      recorderRef.current = null;
    }
  }

  async function approve() {
    const blob = blobRef.current;
    if (!blob) return;
    setPhase("saving");
    setError(null);
    try {
      const ext = extRef.current;
      const contentType = ext === "webp" ? "image/webp" : `video/${ext}`;
      const { uploadUrl, shotId } = await createGuideShotUploadUrl({
        ext,
        contentType,
        byteSize: blob.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!put.ok) throw new Error("Upload to storage failed — try again.");
      await setGuideBlockMedia({
        cardId,
        blockIndex,
        shotId,
        ext,
        caption: caption.trim() || undefined,
      });
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the capture.");
      setPhase("review");
    }
  }

  const showLive = phase === "live" || phase === "recording";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={isVideo ? "Add a clip" : "Add a screenshot"}
          className="group inline-flex items-center gap-2 rounded-full border border-command-gold/70 bg-command-gold/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold shadow-[0_0_20px_-4px_var(--color-command-gold)] transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          <span className="text-base leading-none">+</span>{" "}
          {isVideo ? "Add clip" : "Add screenshot"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-deep-space/80 backdrop-blur-sm" />
        <Dialog.Content className="glass-card fixed left-1/2 top-1/2 z-50 w-[min(94vw,52rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-panel-border p-6">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl uppercase tracking-wide text-command-gold">
              {isVideo ? "Record a clip" : "Capture a screenshot"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="shrink-0 rounded border border-panel-border px-2 py-0.5 font-mono text-sm text-muted transition-colors hover:border-command-gold hover:text-command-gold"
            >
              ✕
            </Dialog.Close>
          </div>

          {captureHint ? (
            <p className="mt-2 font-serif text-sm text-gray-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                Capture:{" "}
              </span>
              {captureHint}
            </p>
          ) : null}

          <label className="mt-3 block">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Caption (saved as the {isVideo ? "clip" : "image"}&apos;s description)
            </span>
            <input
              type="text"
              maxLength={200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-sm text-gray-1"
            />
          </label>

          <div className="mt-4">
            {phase === "prep" && (
              <div className="space-y-3">
                <p className="font-serif text-sm text-gray-2">
                  Click below and pick the window/screen to share. A crop box appears
                  on the preview — drag it to frame what you want, arrange the target
                  to fill it, then press <kbd className="rounded border border-panel-border px-1">Space</kbd>{" "}
                  {isVideo ? "to start, and again to stop." : "to grab the shot."}
                </p>
                <button type="button" onClick={startCapture} className={BTN}>
                  Start capture
                </button>
              </div>
            )}

            {showLive && (
              <div className="space-y-3">
                {phase === "live" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                      Aspect:
                    </span>
                    {ASPECTS.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => changeAspect(a.value)}
                        className={`rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                          aspect === a.value
                            ? "border-command-gold bg-command-gold/10 text-command-gold"
                            : "border-panel-border text-muted hover:border-command-gold"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative inline-block w-full select-none">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={initBox}
                    className="block w-full rounded border border-panel-border bg-black"
                  />
                  {box && (
                    <div
                      onPointerDown={onBoxPointerDown}
                      onPointerMove={onBoxPointerMove}
                      onPointerUp={onBoxPointerUp}
                      style={{
                        left: box.x,
                        top: box.y,
                        width: box.w,
                        height: box.h,
                        boxShadow: "0 0 0 9999px rgba(8,9,13,0.55)",
                      }}
                      className={`absolute cursor-move border-2 border-dashed border-command-gold ${
                        phase === "recording" ? "pointer-events-none" : ""
                      }`}
                    >
                      {phase === "live" && (
                        <span
                          data-handle="br"
                          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-deep-space bg-command-gold"
                        />
                      )}
                    </div>
                  )}
                  {phase === "recording" && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded bg-deep-space/80 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-alert-red">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-alert-red" />
                      Rec {fmt(elapsed)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {phase === "live" && (
                    <button
                      type="button"
                      onClick={isVideo ? startRecording : captureFrame}
                      className={BTN}
                    >
                      {isVideo ? "Start recording" : "Capture frame"} (Space)
                    </button>
                  )}
                  {phase === "recording" && (
                    <button type="button" onClick={stopRecording} className={BTN}>
                      Stop recording (Space)
                    </button>
                  )}
                  {phase === "live" && (
                    <button
                      type="button"
                      onClick={() => {
                        stopStream();
                        setPhase("prep");
                      }}
                      className={BTN_GHOST}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {(phase === "review" || phase === "saving") && previewUrl && (
              <div className="space-y-3">
                {isVideo ? (
                  <video
                    src={previewUrl}
                    controls
                    loop
                    className="w-full rounded border border-panel-border bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Captured preview"
                    className="w-full rounded border border-panel-border bg-black"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={phase === "saving"}
                    onClick={approve}
                    className={`${BTN} disabled:opacity-50`}
                  >
                    {phase === "saving" ? "Saving…" : "Approve & use"}
                  </button>
                  <button
                    type="button"
                    disabled={phase === "saving"}
                    onClick={startCapture}
                    className={`${BTN_GHOST} disabled:opacity-50`}
                  >
                    Redo
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 font-mono text-xs uppercase tracking-wider text-alert-red">
                {error}
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
