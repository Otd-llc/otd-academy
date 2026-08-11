// Open Graph card for /beta.
//
// This is a PUBLIC campaign, so for most people this card IS the beta: they see
// it in a feed or a link preview before they ever see the page. Until now /beta
// inherited the site default, which says nothing about a board or a beta.
//
// THE FIRST CARD IN THE SET TO CARRY ART, and the reason is narrow rather than a
// change of house style: the other surfaces have nothing embeddable. The parts
// card says so in as many words, that a part's render asset is a `.glb` Satori
// cannot embed and there is no PNG thumbnail. /beta has one, because the hero
// capture already produced a 38 kB poster of the board, so the card can show the
// thing the course produces instead of describing it.
//
// IT USES THE TRANSPARENT CUTOUT, NOT THE VIDEO POSTER, and the difference is
// the whole reason the first attempt looked wrong. The poster has the theme
// background BAKED IN, which is what makes the page's hero frameless against a
// flat field. This card is not a flat field: `Field wash` paints a radial navy
// gradient, so the poster's flat #08090d sat on it as a visible rectangle. That
// is the documented constraint in docs/beta-media.md arriving in practice.
//
// `board-cutout.png` is the same rest-pose frame with its alpha intact, so it
// composites correctly over the wash, the ghost, and anything else the card
// grows later.
//
// Runtime is nodejs for `fs`. Every failure path falls back to the text-only
// card rather than throwing, because a crawler must never get a 500 and a
// missing image is not a reason to have no share card at all.
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  CardTitle,
  DefaultFooter,
} from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";

export const runtime = "nodejs";
export const size = SIZE;
export const contentType = "image/png";
export const alt =
  "Open beta: design a real ESP32-S3 USB-C breakout board in KiCad, free while in beta.";

/** The transparent board cutout as a data URI, or null if it cannot be read. */
async function boardCutout(): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), "public", "beta", "board-cutout.png");
    const bytes = await readFile(file);
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    // No art is a worse card, not a broken one.
    return null;
  }
}

export default async function Image() {
  const cutout = await boardCutout();

  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 48,
          paddingBottom: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Eyebrow tri>Open beta · L1.01</Eyebrow>
          <CardTitle size={86} maxWidth={560}>
            Build it for real
          </CardTitle>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              maxWidth: 540,
              fontFamily: "Space Mono",
              fontSize: 22,
              lineHeight: 1.5,
              color: OG.MUTED,
            }}
          >
            You design an ESP32-S3 USB-C breakout in KiCad, from requirements to
            bring-up. Free while it is in beta.
          </div>
        </div>

        {cutout ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders
          // a raw <img>; next/image does not exist inside an ImageResponse.
          <img
            src={cutout}
            alt=""
            width={520}
            height={293}
            style={{ objectFit: "contain" }}
          />
        ) : null}
      </div>

      <DefaultFooter tagline="Eight gated cards · a final exam · a board you drew" />
    </Field>,
  );
}
