"use client";

import { useState } from "react";

// Privacy-enhanced, click-to-load YouTube facade. Until the learner clicks, we
// render only the static thumbnail (one image request) — no youtube.com JS — so
// a Library page with several embeds stays fast (CWV). On click we swap in the
// youtube-nocookie iframe with autoplay. `videoId` is a bare, schema-validated id.
export function YouTubeEmbed({
  videoId,
  title,
  start,
}: {
  videoId: string;
  title: string;
  start?: number;
}) {
  const [active, setActive] = useState(false);
  const startParam = start ? `&start=${start}` : "";
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-panel-border bg-black">
      {active ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0${startParam}`}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex h-full w-full items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-command-gold/90 text-black shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
