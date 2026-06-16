// Bundled certificate font FILES + satori font data. No @react-pdf import here, so
// the satori image route can use it without pulling the PDF renderer into its
// bundle. (The @react-pdf registration lives in cert-fonts.ts.)
//   - "Serif"  — Crimson Text (old-style Garamond-esque serif; STATIC TTFs so
//                satori's parser handles it — variable fonts crash satori)
//   - "Script" — Great Vibes (the recipient name + signature hand)
import { readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
export const SERIF = path.join(DIR, "CrimsonText-Regular.ttf");
export const SERIF_SEMIBOLD = path.join(DIR, "CrimsonText-SemiBold.ttf");
export const SERIF_ITALIC = path.join(DIR, "CrimsonText-Italic.ttf");
export const SCRIPT = path.join(DIR, "GreatVibes-Regular.ttf");

/** Font buffers for satori's ImageResponse `fonts` option. */
export function certFontData() {
  return [
    { name: "Serif", data: readFileSync(SERIF), weight: 400 as const, style: "normal" as const },
    { name: "Serif", data: readFileSync(SERIF_SEMIBOLD), weight: 600 as const, style: "normal" as const },
    { name: "Serif", data: readFileSync(SERIF_ITALIC), weight: 400 as const, style: "italic" as const },
    { name: "Script", data: readFileSync(SCRIPT), weight: 400 as const, style: "normal" as const },
  ];
}
