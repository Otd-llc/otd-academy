// Open Graph card for /hex.
//
// THIS SURFACE NEEDED ONE MORE THAN ANY OTHER. `/hex` is the CC BY attribution
// target: every published .3mf/.stl/.step in every release carries a LICENSE.txt
// pointing at it, so the link travels wherever the geometry does, and until now
// every one of those shares rendered whatever the site default happened to be.
//
// NUMERALS COME FROM `@/lib/hex-v2-page`, never typed in here: the page and
// its share card must never state two different numbers for one dimension.
// HEX_V2_PITCH_MM is derived from the vars it depends on, so the card cannot
// drift from the geometry either.
//
// THE v2 STILL IS ON THE CARD (launch 6.4). `public/hex/og-cutout.png` is the
// same build and the same instant as the /hex hero still, rendered on
// transparency by `tools/hex-stills.mjs og`, so it sits on the card's own wash.
// Read from disk at request time (nodejs runtime, as /beta's card does), and a
// missing file degrades to the numeral card rather than a 500: a crawler must
// never get an error, and a missing image is not a reason to have no card.
//
// The part count is deliberately absent. hex-spec says in as many words that it
// is NOT page copy: the published set grows when a part is added, so printing it
// anywhere a test does not check is a promise the surface cannot keep.
//
// Composes Field + primitives rather than `ShareCard`, because this card has a
// numeral hero, which is the documented reason to compose directly.
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Center,
  Eyebrow,
  CardTitle,
  SairaReadout,
  DefaultFooter,
} from "@/lib/og/card";
import { SIZE } from "@/lib/og/tokens";
import { HEX_LICENSE } from "@/lib/hex-license";
import { HEX_V2_PITCH_MM, HEX_V2_RELEASE } from "@/lib/hex-v2-page";

// Node.js, which this card needs to read from disk, is the default runtime. Next 16.3
// rejects an explicit `runtime` segment config under cacheComponents, so none is set.
export const size = SIZE;
export const contentType = "image/png";
export const alt = `Hex Cluster: a printable bench mounting standard, ${HEX_LICENSE.name}. A stacked column of hex bases in a row that a PVC pipe runs through.`;

/** The transparent v2 cutout as a data URI, or null if it cannot be read. */
async function buildCutout(): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), "public", "hex", "og-cutout.png");
    const bytes = await readFile(file);
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image() {
  const cutout = await buildCutout();
  const readout = (
    <div style={{ display: "flex", marginTop: 28 }}>
      <SairaReadout
        value={HEX_V2_PITCH_MM.toFixed(3)}
        unit="mm"
        label="cell pitch, centre to centre"
      />
    </div>
  );
  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      {cutout ? (
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
            <Eyebrow tri>Open hardware release</Eyebrow>
            <CardTitle size={74} maxWidth={520}>
              Hex Cluster
            </CardTitle>
            {readout}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders
              a raw <img>; next/image does not exist inside an ImageResponse. */}
          <img src={cutout} alt="" width={520} height={320} style={{ objectFit: "contain" }} />
        </div>
      ) : (
        <Center>
          <Eyebrow tri>Open hardware release</Eyebrow>
          <CardTitle size={74} maxWidth={760}>
            Hex Cluster
          </CardTitle>
          {readout}
        </Center>
      )}
      {/* The licence rides on the card, because the people most likely to see
          this share arrived from an attribution line in someone else's file. */}
      <DefaultFooter tagline={`${HEX_LICENSE.name} · Release ${HEX_V2_RELEASE}`} />
    </Field>,
  );
}
