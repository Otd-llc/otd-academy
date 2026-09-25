// The /hex hero as a STILL, in the palette the visitor is looking at.
//
// A still rather than a loop, so there is nothing to pause under
// `prefers-reduced-motion`: the reduced-motion render and the default render
// are the same picture, which is the "poster-only" the launch item asks for
// without a second code path.
//
// Both themes are mounted and `globals.css` shows one, keyed on the same
// `data-theme` attribute the toggle sets (the rule beside `video[data-loop]`),
// so a theme flip lands in the same paint with no client component at all.
//
// TODO(phase-8): the images are the existing configurator posters, used as a
// stand-in. Replace both with the v2 still (and its light twin) when Phase 8
// renders it; nothing else here changes.
export function HexStill({ className }: { className?: string }) {
  // TODO(phase-8): describe the v2 still once it replaces the stand-in.
  const alt = "The Hex Cluster configurator";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size hero pair toggled by CSS; next/image adds nothing here */}
      <img
        data-still="dark"
        src="/hex/configurator-poster.jpg"
        alt={alt}
        className={className}
        fetchPriority="high"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        data-still="light"
        src="/hex/configurator-light-poster.jpg"
        alt={alt}
        className={className}
        loading="lazy"
      />
    </>
  );
}
