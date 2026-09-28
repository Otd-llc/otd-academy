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
// The images are the v2 still and its light twin, rendered by
// `tools/hex-stills.mjs hero` from the same film as the loop (tools/hex-film.mjs)
// at 1920x1080, with the build fitted inside the part of the frame that
// survives this element's `object-fit: cover` on a desktop band and a phone.
export function HexStill({ className }: { className?: string }) {
  const alt =
    "A Hex Cluster build in the configurator: a column of three stacked hex bases " +
    "with a cover on top, in a row of open bases that a PVC pipe runs through";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size hero pair toggled by CSS; next/image adds nothing here */}
      <img
        data-still="dark"
        src="/hex/hero-dark.webp"
        alt={alt}
        className={className}
        fetchPriority="high"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        data-still="light"
        src="/hex/hero-light.webp"
        alt={alt}
        className={className}
        loading="lazy"
      />
    </>
  );
}
