// The shapes we deliver into. A PLAIN MODULE, so the preview grid, the capture
// route and the renderer all read ONE definition.
//
// That is not tidiness. The safe areas drive the composition, not just the
// hatching drawn over it, so a preview whose numbers had drifted from the
// encoder's would be a preview of a film nobody ships. Same reason the bed's
// event times are imported rather than re-typed.
//
// `px` is the DELIVERY size and it is what the renderer sets as its viewport,
// so the screenshot is the frame at 1:1 with no resample. The `w` field is only
// the preview's display width.
//
// SAFE AREAS ARE APPROXIMATE AND NOT A SPEC. No platform publishes its chrome,
// and it moves between releases. These are the commonly-cited bands; they are a
// prompt to look, not a certificate.
//
// ASCII only.

export type FormatId = "16x9" | "1x1" | "4x5" | "9x16";

export type Safe = { top?: number; right?: number; bottom?: number; left?: number };

export type Fmt = {
  id: FormatId;
  label: string;
  px: string;
  /** Delivery pixels: [width, height]. */
  out: [number, number];
  where: string;
  aspect: number;
  /** Preview display width only. */
  w: number;
  safe?: Safe;
};

export const FORMATS: Fmt[] = [
  {
    id: "16x9",
    label: "16:9",
    px: "1920 x 1080",
    out: [1920, 1080],
    where: "YouTube, X, LinkedIn, site embed",
    aspect: 16 / 9,
    w: 360,
  },
  {
    id: "1x1",
    label: "1:1",
    px: "1080 x 1080",
    out: [1080, 1080],
    where: "feed square, LinkedIn, X",
    aspect: 1,
    w: 258,
  },
  {
    id: "4x5",
    label: "4:5",
    px: "1080 x 1350",
    out: [1080, 1350],
    where: "Instagram / Facebook feed",
    aspect: 4 / 5,
    w: 238,
    // A modest bottom band: the feed puts the caption and the account row under
    // the video rather than over it, but the last 8% is where a "see more"
    // overlay lands.
    safe: { bottom: 0.08 },
  },
  {
    id: "9x16",
    label: "9:16",
    px: "1080 x 1920",
    out: [1080, 1920],
    where: "Shorts, Reels, TikTok",
    aspect: 9 / 16,
    w: 206,
    // The band a caption block and the action rail tend to occupy.
    safe: { top: 0.08, right: 0.13, bottom: 0.2 },
  },
];
