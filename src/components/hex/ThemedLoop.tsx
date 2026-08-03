"use client";

// The configurator loop, in the palette the visitor is actually looking at.
//
// A `<source media="...">` cannot do this. Media queries see the OS preference,
// and this site's theme is a `data-theme` attribute the visitor sets with a
// toggle -- so the dark clip would keep playing on the ivory theme, where it is
// a black slab. The toggle already announces itself with an `otd-theme-change`
// event (see ThemeToggle); subscribing to that is the only thing that tracks it.
//
// `useSyncExternalStore`, matching ThemeToggle: the DOM attribute is the store,
// `getServerSnapshot` returns the default so SSR and hydration agree, and React
// re-reads the real value immediately after hydration.
//
// Swapping `src` on a <video> is a load, so the element is KEYED by theme. That
// restarts the loop from frame one on a toggle, which is correct here -- the clip
// is a closed loop with no state worth preserving, and a half-faded cross-swap
// would be more distracting than a clean restart.

import { useSyncExternalStore } from "react";

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
  const suffix = theme === "light" ? "-light" : "";

  return (
    <video
      key={theme}
      className={className}
      // Silent, looping, and started without asking: this is furniture, not
      // media. `playsInline` matters most on iOS, where the default is to take
      // the video fullscreen the moment it plays.
      autoPlay
      muted
      loop
      playsInline
      // The poster carries the first paint, so the hero is never an empty box
      // while ~500 kB of video arrives.
      poster={`/hex/configurator${suffix}-poster.jpg`}
      aria-label="The hex cluster configurator: a carrier tray opens, tiles and caps are added, then removed"
    >
      {/* MP4 only, deliberately. The VP9 encode of this clip came out LARGER
          than the H.264 one, so offering it would hand the bigger file to every
          browser that prefers WebM -- the opposite of why you would offer it. */}
      <source src={`/hex/configurator${suffix}.mp4`} type="video/mp4" />
    </video>
  );
}
