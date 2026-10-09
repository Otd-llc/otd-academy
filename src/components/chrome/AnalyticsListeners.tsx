"use client";

// Page-wide listeners for two things no component handler can reach, because
// the markup that produces them is server-rendered (GuideBlocks, the /hex page):
//
//   - DOWNLOADS GA4 CANNOT SEE. Its automatic `file_download` fires only for a
//     fixed list of extensions (pdf, zip, txt, csv, mp4…). The hex jigs are
//     `.3mf` and the custom print pack is `/api/printable-pack` with no
//     extension at all, so both were invisible. A link GA already counts is left
//     alone, so nothing is reported twice.
//   - VIDEO PLAYS. GA's video tracking only understands YouTube embeds with the
//     JS API on; a lesson's plain <video> never registered. `play` does not
//     bubble, so this listens in the capture phase. Muted autoplay loops are
//     decoration, not plays, and are skipped.
//
// Renders nothing. Mounted once, inside the consent providers.
import { useEffect } from "react";
import { trackFileDownload, trackVideoStart } from "@/lib/analytics-client";

// GA4 enhanced measurement's own file_download list (Google's documentation).
const GA_AUTO_EXT =
  /\.(pdf|xlsx?|docx?|txt|rtf|csv|exe|key|pp[st]x?|7z|pkg|rar|gz|zip|avi|mov|mp4|mpe?g|wmv|midi?|mp3|wav|wma)$/i;
// Ours: CAD and print files, and images offered as downloads.
const OWN_EXT = /\.(3mf|stl|step|stp|f3d|png|svg)$/i;
const PACK_PATH = "/api/printable-pack";

export function AnalyticsListeners() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      // Other hosts are GA's outbound-click tracking, not ours.
      if (url.origin !== window.location.origin) return;
      const path = url.pathname;
      if (GA_AUTO_EXT.test(path)) return;
      const ext = path === PACK_PATH ? "zip" : path.match(OWN_EXT)?.[1]?.toLowerCase();
      // An image is only a download when the link says so.
      if (!ext || ((ext === "png" || ext === "svg") && !a.hasAttribute("download"))) return;
      trackFileDownload({
        fileName: path.split("/").pop() || path,
        fileExtension: ext,
        linkUrl: url.href,
      });
    };

    const played = new WeakSet<EventTarget>();
    const onPlay = (e: Event) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || played.has(v)) return;
      if (v.muted && v.autoplay) return;
      played.add(v);
      trackVideoStart({ provider: "self" });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("play", onPlay, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("play", onPlay, true);
    };
  }, []);

  return null;
}
