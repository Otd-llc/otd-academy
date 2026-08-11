"use client";

// The /beta hero loop, captured from the real board.
//
// BoardLoop — the L1.01 board turning through one exact revolution, twelve
// seconds at 30 degrees per second. Above the fold, so its poster is the LCP
// candidate and carries `fetchPriority="high"`.
//
// A guide-scroll loop lived here too and was cut: small type in a video is
// unreadable on a phone, and the section it filled is now a real question from
// the course instead. `ThemedVideoLoop` keeps its `lazy` option for the next
// below-fold clip that needs it.
//
// It was captured deterministically (see docs/beta-media.md) rather than
// screen-recorded, so a re-capture after a board revision reproduces the shot
// instead of approximating it.

import { ThemedVideoLoop } from "@/components/media/ThemedVideoLoop";

export function BoardLoop({ className }: { className?: string }) {
  return (
    <ThemedVideoLoop
      className={className}
      priority
      dark={{ src: "/beta/board.mp4", poster: "/beta/board-poster.jpg" }}
      light={{ src: "/beta/board-light.mp4", poster: "/beta/board-light-poster.jpg" }}
      label="The L1.01 ESP32-S3 USB-C breakout board, turning slowly through one full revolution"
    />
  );
}
