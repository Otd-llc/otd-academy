// YouTube's own furniture, and where it lands on our frame.
//
// Same argument as the feed formats' `chrome` inset: our safe margin is OUR
// margin, and it says nothing about the region the PLATFORM paints over. On a
// feed app that region is fixed (an action rail, a caption block). On YouTube it
// is different in a way that matters - end-screen elements are placed BY THE
// AUTHOR in Studio, so this is not a no-go zone we must avoid. It is a set of
// slots we should DESIGN FOR, and leave empty, so the Studio placement drops
// into space that was meant for it instead of over a headline.
//
// VERIFIED against Google's own documentation 2026-08-13, not recalled:
// support.google.com/youtube/answer/6388789
//
//   - "Your video has to be at least 25 seconds long to have an end screen."
//   - "End screens can be added to the last 5-20 seconds of a video."
//   - "You can add up to four elements to your end screen for videos with
//      standard 16:9 aspect ratio. Other aspect ratios may have a lower limit."
//   - Custom images: "at least 300 x 300 pixel width."
//
// The consequence for an outro: it must run long enough to host one (>= 5 s of
// end-screen window inside a video of >= 25 s), and it must keep its own type
// out of four regions it does not control.
//
// WHAT IS NOT FROM THE DOC, and is therefore marked as judgement: the exact
// pixel geometry of the element wells. Google publishes the grid in Studio, not
// as numbers, and it moves with releases. The wells below are OUR layout - four
// regions we reserve and leave empty - chosen so any reasonable Studio placement
// lands inside one. That is a prompt to look at the result, not a certificate.
//
// ASCII only.

/** A region as fractions of the frame, origin top-left. */
export type Well = { x: number; y: number; w: number; h: number };

/** Video must be at least this long to carry an end screen at all. */
export const MIN_VIDEO_SECONDS = 25;

/** The window an end screen may occupy, measured back from the end. */
export const END_SCREEN_WINDOW = { minSeconds: 5, maxSeconds: 20 };

/** Google's stated minimum for a custom element image. */
export const MIN_ELEMENT_PX = 300;

/**
 * Four reserved wells for 16:9, as fractions.
 *
 * Two-up on the right for video/playlist cards, one lower-left for the
 * subscribe badge, one upper-left kept clear for a channel element. The left
 * column is deliberately narrow: the outro's own copy lives in the centre-left
 * gutter between them, which is the widest continuous run of frame that no
 * element wants.
 */
export const WELLS_16X9: Record<string, Well> = {
  video1: { x: 0.60, y: 0.13, w: 0.30, h: 0.34 },
  video2: { x: 0.60, y: 0.53, w: 0.30, h: 0.34 },
  channel: { x: 0.10, y: 0.13, w: 0.16, h: 0.28 },
  subscribe: { x: 0.10, y: 0.60, w: 0.16, h: 0.27 },
};

/**
 * The player's own bottom bar (progress + controls) on hover.
 *
 * Judgement, not spec: roughly the bottom tenth on desktop, more on mobile
 * where the scrubber sits higher. A LOWER THIRD is the piece this bites - put
 * one in the last 10% and it reads fine in the editor and sits behind the
 * scrubber the moment a viewer moves the mouse.
 */
export const PLAYER_BAR_BOTTOM = 0.12;

/** Does an outro of this length fit the end-screen rules? */
export function outroFits(outroSeconds: number, videoSeconds: number) {
  const reasons: string[] = [];
  if (videoSeconds < MIN_VIDEO_SECONDS) {
    reasons.push(
      `video is ${videoSeconds}s; YouTube requires >= ${MIN_VIDEO_SECONDS}s for any end screen`,
    );
  }
  if (outroSeconds < END_SCREEN_WINDOW.minSeconds) {
    reasons.push(
      `outro is ${outroSeconds}s; an end screen needs >= ${END_SCREEN_WINDOW.minSeconds}s to sit in`,
    );
  }
  if (outroSeconds > END_SCREEN_WINDOW.maxSeconds) {
    reasons.push(
      `outro is ${outroSeconds}s; only the last ${END_SCREEN_WINDOW.maxSeconds}s can carry elements, so the rest is unreachable`,
    );
  }
  return { ok: reasons.length === 0, reasons };
}
