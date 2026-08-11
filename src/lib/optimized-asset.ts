// Route a static `public/` raster through Next's image optimizer, for the art
// that is painted by CSS rather than by a component.
//
// WHY NOT next/image. The honeycomb's art is a `background-image` and a
// `mask-image`; neither can be rendered by <Image>. The optimizer is a plain
// endpoint though, and a `/_next/image?...` URL works perfectly well inside a
// CSS `url()` — browsers send the same `Accept` header on a CSS-initiated
// fetch, so content negotiation still happens.
//
// WHY IT IS WORTH IT. These tiles are 1113px and 1782px squares painted into a
// box that measures at most 437 CSS px. Measured on the real pages:
//
//   /guide-stages/REQUIREMENTS.png   1113px   133,721 B -> 34,960 B at w=1080
//   /guide-stages/BRINGUP.png        1782px   535,824 B ->  (see w=1080 below)
//
// That is resampling, not recompression, and it is why this beats any amount of
// re-encoding the source: the bytes nobody needed were resolution.
//
// THE CONSTRAINTS ARE MEASURED, NOT ASSUMED. Probed against this app:
//   widths accepted: 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080
//                    (150, 200, 300 and 512 all return 400)
//   qualities accepted: 75 only (50, 90 and 100 return 400)
// Both come from Next 16 defaults; there is no `images` block in next.config.
// A width off that list is a 400, and a 400 inside a CSS url() renders NOTHING
// with no console error, so the allowed set is enforced here rather than
// trusted at each call site.
//
// NOT FOR MASKS. See the note on the ghost helpers: resampling a sparse alpha
// map raises its mean alpha by up to 190%, which is a different drawing.

/** Widths this app's optimizer actually accepts. Anything else 400s. */
const ALLOWED_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080] as const;

/**
 * 1080 because the largest painted box measured 437 CSS px (the guide hub comb
 * at a laptop viewport and up), and a 2x display samples that at 874. 828 is
 * the next size down and would under-sample it; 1080 is the smallest allowed
 * width that covers it.
 */
const DEFAULT_WIDTH = 1080;

export function optimized(path: string, width: number = DEFAULT_WIDTH): string {
  if (!path.startsWith("/")) {
    throw new Error(`optimized() takes a site-root path, got "${path}"`);
  }
  if (!(ALLOWED_WIDTHS as readonly number[]).includes(width)) {
    throw new Error(
      `optimized(): width ${width} is not one of ${ALLOWED_WIDTHS.join(", ")} — the optimizer would 400 and the CSS would paint nothing`,
    );
  }
  // q=75 is the only quality this app permits (Next 16 default `qualities`).
  return `/_next/image?url=${encodeURIComponent(path)}&w=${width}&q=75`;
}
