"use client";

import { useEffect } from "react";

// Posts the embed document's height to the parent window so the host iframe can
// resize to fit (calculators differ in height, and the 2-column shell stacks on
// narrow frames). The matching listener ships in the copy-paste snippet
// (EmbedSnippet); a no-JS host falls back to the iframe's fixed `height`.
export function EmbedAutosize({ slug }: { slug: string }) {
  useEffect(() => {
    function post() {
      const height = document.documentElement.scrollHeight;
      window.parent?.postMessage({ otdEmbed: slug, height }, "*");
    }
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    window.addEventListener("load", post);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
    };
  }, [slug]);

  return null;
}
