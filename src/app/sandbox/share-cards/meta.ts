// Share-card sandbox — option catalog (Task 2).
//
// The gallery page and the image route share this list: the page captions each
// option from it, the route validates the requested id against it. Six base-card
// families, chosen to span the design axes (frame vs open field, hex placement,
// wash on/off, Bebas-title-hero vs Saira-readout-hero, eyebrow ▸ vs //). Josh
// picks the family (and any mix-and-match notes) before any variant is built.
//
// NOTE: this sandbox GRADUATES to the permanent dev-only visual-regression
// gallery (Task 9); it is NOT deleted. Both routes keep a prod notFound guard.

export type OptionId = "A" | "B" | "C" | "D" | "E" | "F";
export type TitleLen = "short" | "long";

export const OPTIONS: {
  id: OptionId;
  label: string;
  blurb: string;
}[] = [
  {
    id: "A",
    label: "Framed masthead",
    blurb:
      "The kit default. Hairline frame + radial wash, wordmark top, ▸ eyebrow over a Bebas title, gold footer rule. Closest to the current guide card.",
  },
  {
    id: "B",
    label: "Left rail + hex",
    blurb:
      "Open field, no frame. A left registration rail (hex badge over a gold hairline) with a // eyebrow and Bebas title set to its right.",
  },
  {
    id: "C",
    label: "Corner registration mark",
    blurb:
      "Framed document look. Hex badge as a top-right registration mark, ▸ eyebrow + title centered, a mono baseline row (url · rev) instead of a tagline.",
  },
  {
    id: "D",
    label: "Saira readout hero",
    blurb:
      "The instrument variant for tool / part cards. A big Saira numeral readout is the hero; the title is a smaller Bebas line beneath. Open field, wash on.",
  },
  {
    id: "E",
    label: "Blueprint (flat, no wash)",
    blurb:
      "Editorial and minimal. No radial wash (flat deep-space), full-width hairlines top and bottom, a large Bebas title and a // eyebrow. No hex.",
  },
  {
    id: "F",
    label: "Split panel",
    blurb:
      "The layout the library / part cards need. Title left ~60%, a hairline-framed panel right ~40% (a hex stands in for the diagram / part render).",
  },
];

// Sample titles. SHORT is a realistic board name; LONG deliberately stresses the
// wrap behavior where OG cards usually break. No em-dash (house rule).
export const TITLES: Record<TitleLen, string> = {
  short: "ESP32-S3 USB-C Breakout Board",
  long: "Designing and Bringing Up the ESP32-S3 USB-C Breakout Board, From Schematic Capture to First Blink",
};
