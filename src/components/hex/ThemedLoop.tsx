"use client";

// A looping clip, in the palette the visitor is actually looking at.
//
// A `<source media="...">` cannot do this. Media queries see the OS preference,
// and this site's theme is a `data-theme` attribute the visitor sets with a
// toggle -- so the dark clip would keep playing on the ivory theme, where it is
// a black slab. The toggle already announces itself with an `otd-theme-change`
// event (see ThemeToggle); subscribing to that is the only thing that tracks it.
//
// BOTH CLIPS ARE MOUNTED, AND CSS PICKS ONE. This used to be a single <video>
// KEYED by theme, which made the swap a React remount -- and a remount lands a
// frame after the attribute does. Measured: at the instant `data-theme` flipped
// to dark the light clip was still the one painted (mean luma 219 against the
// dark clip's 15), and the correct one arrived ~49 ms later. That is the
// flicker, and no amount of preloading fixes it, because the old element is
// still in the DOM until React commits.
//
// With both elements present the swap is a CSS rule keyed off the same
// attribute the toggle sets, so it lands in the SAME paint. There is no window
// for the wrong one to show.
//
// REDUCED MOTION IS A POSTER, AND NOTHING IS FETCHED FOR IT. Both clips render
// with preload="none" and no autoplay attribute, so the server HTML asks for no
// video at all. After mount, and only when the visitor has not asked for
// reduced motion, the active clip is told to load and play. The poster is a
// real frame of the film, so the reduced-motion picture is the film's own
// still rather than a separate render. tools/check-hex-hero.mjs measures this
// in a browser: zero .mp4 requests under `reducedMotion: 'reduce'`.
//
// It does not cost a second download: only the active clip is ever loaded; the
// other has nothing but its poster (~20 kB) until the theme flips to it.

import { useEffect, useRef, useSyncExternalStore } from "react";

const CHANGE_EVENT = "otd-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  // The attribute itself, too: the theme's first paint comes from a script
  // that sets `data-theme` from the stored or OS preference without firing the
  // toggle's event. Measured 2026-10-02 in a light-scheme browser: the
  // snapshot stayed "dark", the effect loaded and played the HIDDEN dark clip,
  // and the visible light clip sat on its poster.
  const mo = new MutationObserver(callback);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    mo.disconnect();
  };
}
function getSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

export type LoopClip = { src: string; poster: string };

const CONFIGURATOR_DARK: LoopClip = {
  src: "/hex/configurator.mp4",
  poster: "/hex/configurator-poster.jpg",
};
const CONFIGURATOR_LIGHT: LoopClip = {
  src: "/hex/configurator-light.mp4",
  poster: "/hex/configurator-light-poster.jpg",
};
const CONFIGURATOR_LABEL =
  "The Hex Cluster configurator: a PVC pipe slides through a row of bases beside a " +
  "stacked column, the cover snaps on, the build explodes, and every printed part " +
  "flies onto a print bed before the build reassembles";

/** True when the visitor asked for reduced motion; false on the server. */
function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ThemedLoop({
  className,
  dark = CONFIGURATOR_DARK,
  light = CONFIGURATOR_LIGHT,
  label = CONFIGURATOR_LABEL,
}: {
  className?: string;
  dark?: LoopClip;
  light?: LoopClip;
  /** What the clip shows, for assistive tech. The canvas is pointer-only. */
  label?: string;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const darkRef = useRef<HTMLVideoElement>(null);
  const lightRef = useRef<HTMLVideoElement>(null);

  // Start the ACTIVE clip, once the visitor's motion preference is known. A
  // clip hidden with `display: none` is not playing and autoplay would not
  // re-fire on reveal, so this also nudges whichever clip a theme flip just
  // revealed.
  useEffect(() => {
    if (reducedMotion()) return;
    // Read the theme off the DOM here, not from the closed-over `theme`: the
    // hydration commit's effect runs with the SERVER snapshot ("dark") even
    // though the no-flash bootstrap already set `data-theme="light"`, and that
    // started the hidden dark clip in a light browser (measured: both clips
    // loaded and playing, 4 range requests instead of 2). `theme` stays the
    // dependency so a flip re-runs this.
    const live = getSnapshot();
    const el = live === "light" ? lightRef.current : darkRef.current;
    const other = live === "light" ? darkRef.current : lightRef.current;
    if (other && !other.paused) other.pause();
    if (!el) return;
    el.preload = "auto";
    const play = () => void el.play().catch(() => {});
    if (el.readyState >= 2) play();
    else {
      el.addEventListener("loadeddata", play, { once: true });
      el.load();
    }
  }, [theme]);

  const common = {
    // Silent, looping, inline: this is furniture, not media. `playsInline`
    // matters most on iOS, where the default is to take the video fullscreen
    // the moment it plays. NOT autoPlay: that is a fetch the reduced-motion
    // visitor never asked for; the effect above starts the clip instead.
    muted: true,
    loop: true,
    playsInline: true,
    preload: "none",
    "aria-label": label,
  } as const;

  return (
    <>
      {/* MP4 only, deliberately. The VP9 encode of this clip came out LARGER
          than the H.264 one, so offering it would hand the bigger file to every
          browser that prefers WebM -- the opposite of why you would offer it. */}
      <video
        {...common}
        ref={darkRef}
        data-loop="dark"
        className={className}
        // The poster carries the first paint, so the hero is never an empty box
        // while the video arrives -- and on a toggle it is what shows while the
        // newly-revealed clip loads. Under reduced motion it IS the hero.
        poster={dark.poster}
      >
        <source src={dark.src} type="video/mp4" />
      </video>
      <video
        {...common}
        ref={lightRef}
        data-loop="light"
        className={className}
        poster={light.poster}
      >
        <source src={light.src} type="video/mp4" />
      </video>
    </>
  );
}
