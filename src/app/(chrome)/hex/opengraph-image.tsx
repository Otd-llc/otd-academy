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
// TODO(phase-8): item 6.4 wants the OG PNG to be the v2 still at 1200x630.
// Until that still exists this card stays a composed numeral card.
//
// The part count is deliberately absent. hex-spec says in as many words that it
// is NOT page copy: the published set grows when a part is added, so printing it
// anywhere a test does not check is a promise the surface cannot keep.
//
// Composes Field + primitives rather than `ShareCard`, because this card has a
// numeral hero, which is the documented reason to compose directly.
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

export const size = SIZE;
export const contentType = "image/png";
export const alt = `Hex Cluster: a printable bench mounting standard, ${HEX_LICENSE.name}.`;

export default function Image() {
  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <Center>
        <Eyebrow tri>Open hardware release</Eyebrow>
        <CardTitle size={74} maxWidth={760}>
          Hex Cluster
        </CardTitle>
        <div style={{ display: "flex", marginTop: 28 }}>
          <SairaReadout
            value={HEX_V2_PITCH_MM.toFixed(3)}
            unit="mm"
            label="cell pitch, centre to centre"
          />
        </div>
      </Center>
      {/* The licence rides on the card, because the people most likely to see
          this share arrived from an attribution line in someone else's file. */}
      <DefaultFooter tagline={`${HEX_LICENSE.name} · Release ${HEX_V2_RELEASE}`} />
    </Field>,
  );
}
