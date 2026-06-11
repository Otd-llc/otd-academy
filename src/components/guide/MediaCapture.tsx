"use client";

// Admin-only in-app media capture for an empty-src image OR video placeholder.
// getDisplayMedia → live preview → (image: grab a frame · video: record a clip) →
// review (approve / retake) → encode in the browser (WebP frame · or a clip via
// StreamRecorder, with the MP4/WebM duration fixes) → presigned PUT to R2 → point
// the card's block at the served URL → refresh. The whole loop stays on the page.
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

const BTN =
  "inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold";

type Phase = "prep" | "live" | "recording" | "review" | "saving";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function MediaCapture({
  kind,
  cardId,
  blockIndex,
  captureHint,
}: {
  kind: "image" | "video";
  cardId: string;
  blockIndex: number;
  captureHint?: string;
}) {
  const isVideo = kind === "video";
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("prep");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobRef = useRef<Blob | null>(null);
  const extRef = useRef<"webp" | "webm" | "mp4">("webp");
  const recorderRef = useRef<StreamRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Attach the live screen-share stream to the <video> once both exist.
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

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }
  function cleanup() {
    clearTimer();
    recorderRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setPhase("prep");
    setError(null);
  }
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) cleanup();
  }

  async function startCapture() {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        "This browser can't capture the screen here — use desktop Chrome, Edge, or Firefox.",
      );
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: isVideo ? 30 : 8 },
        audio: false,
      });
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        setPhase((p) => (p === "live" ? "prep" : p));
      });
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
    if (!video || !video.videoWidth) return;
    const w = Math.min(video.videoWidth, MAX_WIDTH);
    const h = Math.round((video.videoHeight * w) / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
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
    if (!stream) return;
    try {
      const rec = new StreamRecorder(stream);
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setPhase("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start recording.");
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    clearTimer();
    try {
      const result: RecordResult = await rec.stop();
      stopStream();
      blobRef.current = result.blob;
      extRef.current = result.ext;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(result.blob));
      setPhase("review");
    } catch (e) {
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
      await setGuideBlockMedia({ cardId, blockIndex, shotId, ext });
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the capture.");
      setPhase("review");
    }
  }

  const showLiveVideo = phase === "live" || phase === "recording";

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
        <Dialog.Content className="glass-card fixed left-1/2 top-1/2 z-50 w-[min(94vw,48rem)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-panel-border p-6">
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

          <div className="mt-4">
            {phase === "prep" && (
              <div className="space-y-3">
                <p className="font-serif text-sm text-gray-2">
                  Click below, then pick the window to share (e.g. KiCad). You&apos;ll
                  get a live preview —{" "}
                  {isVideo
                    ? "start recording, do the thing, then stop."
                    : "frame it, then grab the shot."}
                </p>
                <button type="button" onClick={startCapture} className={BTN}>
                  Start capture
                </button>
              </div>
            )}

            {showLiveVideo && (
              <div className="space-y-3">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full rounded border border-panel-border bg-black"
                  />
                  {phase === "recording" && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded bg-deep-space/80 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-alert-red">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-alert-red" />
                      Rec {fmt(elapsed)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isVideo && phase === "live" && (
                    <button type="button" onClick={captureFrame} className={BTN}>
                      Capture frame
                    </button>
                  )}
                  {isVideo && phase === "live" && (
                    <button type="button" onClick={startRecording} className={BTN}>
                      Start recording
                    </button>
                  )}
                  {isVideo && phase === "recording" && (
                    <button type="button" onClick={stopRecording} className={BTN}>
                      Stop recording
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
                    Retake
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
