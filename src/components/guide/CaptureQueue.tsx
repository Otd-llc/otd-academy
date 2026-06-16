// Admin "capture queue" panel for the guide hub — lists every empty media slot
// (screenshot/clip placeholder) across the guide, grouped by stage, each a jump
// link to that stage card where the in-place capture tool fills it. Renders
// nothing when there's nothing to shoot. Server component (presentational).

import Link from "next/link";
import { PhotoIcon, VideoIcon } from "@/components/icons";
import type { StageMediaQueue } from "@/lib/guide-media-queue";
import { STAGE_LABELS, type StageName } from "@/lib/stages";

export function CaptureQueue({
  queue,
  total,
  cardHref,
}: {
  queue: StageMediaQueue[];
  total: number;
  cardHref: (stage: string) => string;
}) {
  if (total === 0) return null;
  return (
    <section className="glass-card mb-8 border-command-gold/30 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
        Capture queue · {total} {total === 1 ? "slot" : "slots"} to shoot
      </p>
      <p className="mt-1 font-serif text-sm text-muted">
        Empty screenshot / clip placeholders across this guide. Jump to a stage to
        capture them in place.
      </p>
      <ul className="mt-3 space-y-2">
        {queue.map((q) => (
          <li key={q.stage}>
            <Link
              href={cardHref(q.stage)}
              className="group flex items-center justify-between gap-3 rounded border border-panel-border bg-deep-space/40 px-3 py-2 transition-colors hover:border-command-gold/50"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-gray-1 group-hover:text-command-gold">
                {STAGE_LABELS[q.stage as StageName] ?? q.stage}
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                {q.slots.length} {q.slots.length === 1 ? "slot" : "slots"}
                <span aria-hidden="true" className="text-command-gold">
                  →
                </span>
              </span>
            </Link>
            <ul className="ml-3 mt-1 space-y-0.5">
              {q.slots.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-gray-3"
                >
                  {s.type === "video" ? (
                    <VideoIcon className="h-3 w-3 shrink-0" />
                  ) : (
                    <PhotoIcon className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{s.captureHint || s.alt}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
