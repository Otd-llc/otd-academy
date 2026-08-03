"use server";

// Resolving `/hex?build=<shareCode>` into a build the embedded configurator can
// open.
//
// "use server" rule: this file exports ONLY async functions. `HexRecall` and
// `HexRecallResult` live in @/lib/hex-recall, because a type re-exported from
// here compiles fine and crashes at runtime.
//
// WHY THIS EXISTS RATHER THAN A LONG URL. The obvious way to recall a build
// into the frame is to put the payload in the academy's own URL fragment and
// forward it to the iframe. That leaks: PostHog captures `location.href` for a
// pageview, FRAGMENT INCLUDED, so every recalled build would land in analytics.
// Resolving a short share code here keeps the payload off the address bar
// entirely, and the URL stays something a person can look at.
//
// NO SESSION, deliberately, and it is not an oversight. This reads exactly what
// the public `/c/<shareCode>` page already renders for anyone holding the code
// -- that page is what a printed QR resolves to. Adding an ownership check here
// would not protect anything (the same bytes are one public page away) and
// would break recalling a build someone shared with you, which is the point of
// a share code.
//
// Every failure returns the SAME `{ ok: false }`. Distinguishing "unknown code"
// from "archived" would turn this into an oracle for which codes exist.

import { loadClusterByShareCode } from "@/lib/hex-cluster-load";
import type { HexRecallResult } from "@/lib/hex-recall";

export async function loadHexRecall(
  shareCode: string,
): Promise<HexRecallResult> {
  if (typeof shareCode !== "string") return { ok: false };

  // The loader validates the code's shape before it queries or caches, so a
  // scanner cannot mint a cache entry per nonsense path.
  const lookup = await loadClusterByShareCode(shareCode);
  if (lookup.outcome !== "hit") return { ok: false };

  const c = lookup.cluster;
  return {
    ok: true,
    payload: c.payload,
    recall: {
      drawingLabel: c.drawingLabel,
      revLabel: c.revLabel,
      shareCode: c.shareCode,
      payloadHash: c.payloadHash,
      // The name AT SAVE, never the drawing's current name: the sheet this
      // reprints says what the name was when it was printed.
      name: c.nameAtSave,
      savedAt: c.savedAt,
    },
  };
}
