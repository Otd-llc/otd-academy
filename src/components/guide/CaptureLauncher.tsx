"use client";

// Admin placeholder affordance: a glowing gold "+" that hands off to the OTD
// Capture desktop app via the otd-capture:// deep link. The flow:
//   click + → createCaptureSession mints a slot-scoped token + returns the
//   block's description → we launch otd-capture://capture?… → the desktop app
//   pops up showing that description → frame → Space → review → approve uploads
//   straight into THIS block. A small "or capture in browser" link falls back to
//   the in-page MediaCapture when the desktop app isn't installed.
import { useState } from "react";
import { createCaptureSession } from "@/lib/actions/guide-images";
import { MediaCapture } from "@/components/guide/MediaCapture";

type Status =
  | { kind: "idle" }
  | { kind: "opened"; message: string }
  | { kind: "error"; message: string };

export function CaptureLauncher({
  kind,
  cardId,
  blockIndex,
  captureHint,
  caption,
}: {
  kind: "image" | "video";
  cardId: string;
  blockIndex: number;
  captureHint?: string;
  caption?: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [browser, setBrowser] = useState(false);

  const label = kind === "video" ? "Add clip" : "Add screenshot";

  async function launch() {
    try {
      const s = await createCaptureSession({ cardId, blockIndex, kind });
      const params = new URLSearchParams({
        api: window.location.origin,
        token: s.token,
        kind: s.kind,
        hint: s.hint,
        caption: s.caption,
      });
      // Hand off to the desktop app through the registered protocol.
      window.location.href = `otd-capture://capture?${params.toString()}`;
      setStatus({
        kind: "opened",
        message:
          "Opening OTD Capture — frame it, press Space, approve, then refresh this page.",
      });
    } catch {
      setStatus({
        kind: "error",
        message:
          "Couldn't start a capture session — make sure you're signed in as admin.",
      });
    }
  }

  if (browser) {
    return (
      <MediaCapture
        kind={kind}
        cardId={cardId}
        blockIndex={blockIndex}
        captureHint={captureHint}
        caption={caption}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={launch}
        className="inline-flex items-center gap-2 rounded-md border border-command-gold/40 bg-command-gold/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-command-gold shadow-[0_0_12px_rgba(212,175,55,0.15)] transition hover:border-command-gold hover:bg-command-gold/10 hover:text-gold-light hover:shadow-[0_0_18px_rgba(212,175,55,0.35)]"
      >
        <span className="text-base leading-none">+</span>
        {label}
      </button>
      {captureHint ? (
        <p className="text-[11px] text-muted">Capture: {captureHint}</p>
      ) : null}
      {status.kind !== "idle" ? (
        <p
          className={
            status.kind === "error"
              ? "text-[11px] text-red-400"
              : "text-[11px] text-command-gold/80"
          }
        >
          {status.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setBrowser(true)}
        className="block text-[10px] uppercase tracking-wider text-muted underline-offset-2 transition-colors hover:text-command-gold hover:underline"
      >
        or capture in browser
      </button>
    </div>
  );
}
