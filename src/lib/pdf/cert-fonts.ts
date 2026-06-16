// @react-pdf registration for the bundled certificate fonts (see cert-font-files
// for the paths + the satori data). Bundled (not fetched) so the serverless PDF
// route never depends on a font CDN.
import { Font } from "@react-pdf/renderer";
import { SERIF, SERIF_SEMIBOLD, SERIF_ITALIC, SCRIPT } from "@/lib/pdf/cert-font-files";

let registered = false;
/** Register the certificate fonts with @react-pdf (idempotent). */
export function registerCertFonts(): void {
  if (registered) return;
  Font.register({
    family: "Serif",
    fonts: [
      { src: SERIF },
      { src: SERIF_SEMIBOLD, fontWeight: 600 },
      { src: SERIF_ITALIC, fontStyle: "italic" },
    ],
  });
  Font.register({ family: "Script", src: SCRIPT });
  // No hyphenation — long board names should never get a stray hyphen.
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}
