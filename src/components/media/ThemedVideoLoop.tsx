"use client";

// A looping hero clip, in the palette the visitor is actually looking at.
//
// Generalised out of the /hex configurator loop, unchanged in behaviour. The
// reasoning it encodes was expensive and is worth restating where it lives:
//
// A `<source media="...">` cannot do this. Media queries see the OS preference,
// and this site's theme is a `data-theme` attribute the visitor sets with a
// toggle, so the dark clip would keep playing on the ivory theme, where it is a
// black slab.
//
// BOTH CLIPS ARE MOUNTED AND CSS PICKS ONE. A single <video> keyed by theme
// makes the swap a React remount, and a remount lands a frame after the
// attribute does. Measured on the hex loop: at the instant `data-theme` flipped
// to dark the light clip was still painted (mean luma 219 against the dark
// clip's 15) and the correct one arrived ~49 ms later. That is the flicker, and
// preloading does not fix it, because the old element is in the DOM until React
// commits. The `video[data-loop]` rules in globals.css do the swap in the SAME
// paint as the attribute.
//
// It does not cost a second download: only the active clip gets `preload`, the
// other has nothing but its poster until it is needed.
//
// `lazy` gates playback AND download on the clip entering the viewport. That
// matters for anything below the fold, because `autoplay` starts downloading
// immediately even when the element is nowhere near the screen.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CHANGE_EVENT = "otd-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

export interface ThemedVideoLoopProps {
  /** Dark-theme clip + its poster. */
  dark: { src: string; poster: string };
  /** Light-theme clip + its poster. */
  light: { src: string; poster: string };
  /** Describes the motion for anyone who cannot see it. Required, not optional. */
  label: string;
  className?: string;
  /**
   * Defer download and playback until the clip is near the viewport. Use for
   * anything below the fold: `autoplay` alone downloads immediately regardless
   * of position, so an ungated below-fold clip competes with the hero for
   * bandwidth at exactly the wrong moment.
   */
  lazy?: boolean;
  /** Marks this clip's poster as the LCP candidate. At most one per page. */
  priority?: boolean;
}

export function ThemedVideoLoop({
  dark,
  light,
  label,
  className,
  lazy = false,
  priority = false,
}: ThemedVideoLoopProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const darkRef = useRef<HTMLVideoElement>(null);
  const lightRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy);

  useEffect(() => {
    if (!lazy || near) return;
    const el = wrapRef.current;
    if (!el) return;
    // No IntersectionObserver (or an old engine): show it rather than hide it.
    // This cannot be decided in the initial state: the server always lacks the
    // API, so branching on it at init would render `near` differently on the
    // server than on a client that has it, which is a hydration mismatch. The
    // one-shot post-mount set is the correction, and it runs at most once
    // because `near` then short-circuits the effect.
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above: a hydration-safe capability fallback, fires once
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, near]);

  // A clip hidden with `display: none` is not playing, and autoplay does not
  // re-fire when it is revealed. Nudge whichever one just became visible.
  useEffect(() => {
    if (!near) return;
    const el = theme === "light" ? lightRef.current : darkRef.current;
    if (!el) return;
    const play = () => void el.play().catch(() => {});
    if (el.readyState >= 2) play();
    else el.addEventListener("loadeddata", play, { once: true });
  }, [theme, near]);

  const common = {
    // Silent, looping, and started without asking: this is furniture, not media.
    // `playsInline` matters most on iOS, where the default is to take the video
    // fullscreen the moment it plays.
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    "aria-label": label,
  } as const;

  const preloadFor = (which: "dark" | "light") => {
    if (!near) return "none" as const;
    return theme === which ? ("auto" as const) : ("none" as const);
  };

  return (
    <div ref={wrapRef} className={className}>
      <video
        {...common}
        ref={darkRef}
        data-loop="dark"
        className="h-full w-full object-cover"
        preload={preloadFor("dark")}
        poster={dark.poster}
        // The poster is the LCP candidate for a <video>, not the stream, so the
        // hero's first paint costs a ~40 kB JPEG rather than a video download.
        {...(priority ? { fetchPriority: "high" as const } : {})}
      >
        {near ? <source src={dark.src} type="video/mp4" /> : null}
      </video>
      <video
        {...common}
        ref={lightRef}
        data-loop="light"
        className="h-full w-full object-cover"
        preload={preloadFor("light")}
        poster={light.poster}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      >
        {near ? <source src={light.src} type="video/mp4" /> : null}
      </video>
    </div>
  );
}
