// @react-pdf registration for the Library PDF's OTD display faces, on top of the
// certificate Serif/Script. Brings the four-face house system into the print
// document (see the otd-frontend-design system):
//   Bebas Neue      -> "Bebas"   display: cover title, section headings (CAPS)
//   Space Mono      -> "Mono"    labels, eyebrows, captions, footer, table heads
//   Saira Condensed -> "Numeral" contents / stat numbers
//   Crimson Text    -> "Serif"   body reading voice (via registerCertFonts)
// STATIC TTFs only (variable fonts break the renderers). Bundled, not fetched, so
// the serverless PDF routes never depend on a font CDN (traced via
// outputFileTracingIncludes: src/lib/pdf/fonts/**).
import { Font } from "@react-pdf/renderer";
import path from "node:path";
import { registerCertFonts } from "@/lib/pdf/cert-fonts";

const DIR = path.join(process.cwd(), "src/lib/pdf/fonts");

let registered = false;
/** Register the cert Serif/Script + the OTD display faces (idempotent). */
export function registerLibraryFonts(): void {
  if (registered) return;
  registerCertFonts(); // "Serif" (Crimson) + "Script" + no-hyphenation callback
  Font.register({ family: "Bebas", src: path.join(DIR, "BebasNeue-Regular.ttf") });
  Font.register({
    family: "Mono",
    fonts: [
      { src: path.join(DIR, "SpaceMono-Regular.ttf") },
      { src: path.join(DIR, "SpaceMono-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "Numeral", src: path.join(DIR, "SairaCondensed-Bold.ttf") });
  registered = true;
}
