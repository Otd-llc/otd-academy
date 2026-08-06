"use client";

// The configurator loop, in the palette the visitor is actually looking at.
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
// It does not cost a second download. Only the active clip gets
// `preload="auto"`; the other is `preload="none"` and has nothing but its
// poster (~20 kB) until it is needed. `useSyncExternalStore` still tracks the
// theme -- but only to steer that hint, never to do the swap.

import { useEffect, useRef, useSyncExternalStore } from "react";

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

export function ThemedLoop({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const darkRef = useRef<HTMLVideoElement>(null);
  const lightRef = useRef<HTMLVideoElement>(null);

  // A clip hidden with `display: none` is not playing, and autoplay does not
  // re-fire when it is revealed. Nudge whichever one just became visible.
  useEffect(() => {
    const el = theme === "light" ? lightRef.current : darkRef.current;
    if (!el) return;
    const play = () => void el.play().catch(() => {});
    if (el.readyState >= 2) play();
    else el.addEventListener("loadeddata", play, { once: true });
  }, [theme]);

  const common = {
    // Silent, looping, and started without asking: this is furniture, not
    // media. `playsInline` matters most on iOS, where the default is to take
    // the video fullscreen the moment it plays.
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    "aria-label":
      "The hex cluster configurator: a carrier tray opens, tiles and caps are added, then removed",
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
        preload={theme === "dark" ? "auto" : "none"}
        // The poster carries the first paint, so the hero is never an empty box
        // while ~350 kB of video arrives -- and on a toggle it is what shows
        // while the newly-revealed clip loads.
        poster="/hex/configurator-poster.jpg"
      >
        <source src="/hex/configurator.mp4" type="video/mp4" />
      </video>
      <video
        {...common}
        ref={lightRef}
        data-loop="light"
        className={className}
        preload={theme === "light" ? "auto" : "none"}
        poster="/hex/configurator-light-poster.jpg"
      >
        <source src="/hex/configurator-light.mp4" type="video/mp4" />
      </video>
    </>
  );
}
